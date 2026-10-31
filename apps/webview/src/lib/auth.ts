import { randomBytes, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

import { importPKCS8, SignJWT } from 'jose';

const scrypt = promisify(scryptCb) as (password: string, salt: string, keylen: number) => Promise<Buffer>;

/* ---------- 비밀번호 ---------- */

/** scrypt는 일부러 느려서(수십 ms) 이벤트 루프를 막지 않게 비동기로 돈다 */
export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${(await scrypt(password, salt, 32)).toString('hex')}`;
}

export async function verifyPassword(password: string, stored: string) {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;
  const a = Buffer.from(hash, 'hex');
  const b = await scrypt(password, salt, 32);
  return a.length === b.length && timingSafeEqual(new Uint8Array(a), new Uint8Array(b));
}

export const isEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

/* ---------- 어드민 토큰 ---------- */

export const ADMIN_COOKIE = 'mc_admin';

/** 길이가 달라도 시간 차로 새지 않게 비교한다. 토큰이 설정돼 있지 않으면 항상 false (어드민은 404) */
export function adminTokenOk(candidate: string | null | undefined): boolean {
  const expected = process.env.ADMIN_TOKEN;
  if (!expected || !candidate) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(candidate);
  return a.length === b.length && timingSafeEqual(new Uint8Array(a), new Uint8Array(b));
}

export const ADMIN_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 60 * 60 * 24 * 30,
  path: '/',
};

/** 어드민 API: 쿠키(mc_admin) 또는 x-admin-token 헤더 */
export function isAdminRequest(request: Request): boolean {
  const cookie = request.headers
    .get('cookie')
    ?.split(';')
    .map(s => s.trim())
    .find(s => s.startsWith(`${ADMIN_COOKIE}=`))
    ?.slice(ADMIN_COOKIE.length + 1);
  return adminTokenOk(request.headers.get('x-admin-token')) || adminTokenOk(cookie ? decodeURIComponent(cookie) : undefined);
}

/* ---------- Sign in with Apple 서버 연동 (토큰 교환·계정 삭제 때 revoke) ---------- */

const APPLE_AUD = 'https://appleid.apple.com';

/** 개발자 포털 Sign in with Apple 키(.p8)가 세 변수로 설정돼 있을 때만 쓴다 */
export function appleServerConfig() {
  const { APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_PRIVATE_KEY } = process.env;
  if (!APPLE_TEAM_ID || !APPLE_KEY_ID || !APPLE_PRIVATE_KEY) return null;
  return { teamId: APPLE_TEAM_ID, keyId: APPLE_KEY_ID, privateKey: APPLE_PRIVATE_KEY.replace(/\\n/g, '\n'), bundleId: process.env.APPLE_BUNDLE_ID ?? 'com.minicovery.app' };
}

/** client_secret: ES256 JWT (iss=팀, sub=번들, aud=Apple, 5분 유효) */
async function appleClientSecret(cfg: NonNullable<ReturnType<typeof appleServerConfig>>) {
  const key = await importPKCS8(cfg.privateKey, 'ES256');
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: cfg.keyId })
    .setIssuer(cfg.teamId)
    .setIssuedAt()
    .setExpirationTime('5m')
    .setAudience(APPLE_AUD)
    .setSubject(cfg.bundleId)
    .sign(key);
}

async function appleAuthPost(path: string, params: Record<string, string>) {
  const cfg = appleServerConfig();
  if (!cfg) return null;
  const body = new URLSearchParams({ client_id: cfg.bundleId, client_secret: await appleClientSecret(cfg), ...params });
  return fetch(`${APPLE_AUD}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
}

/** authorizationCode → refresh_token (계정 삭제 때 revoke에 쓴다). 실패하면 undefined */
export async function exchangeAppleCode(code: string): Promise<string | undefined> {
  try {
    const res = await appleAuthPost('/auth/token', { code, grant_type: 'authorization_code' });
    if (!res?.ok) return undefined;
    const data = (await res.json()) as { refresh_token?: string };
    return data.refresh_token;
  } catch (error) {
    console.error('[apple] token exchange', error);
    return undefined;
  }
}

/** 계정 삭제: Apple 쪽 연결도 끊는다 (App Store 심사 5.1.1(v)). 실패해도 삭제는 진행한다 */
export async function revokeAppleToken(refreshToken: string): Promise<boolean> {
  try {
    const res = await appleAuthPost('/auth/revoke', { token: refreshToken, token_type_hint: 'refresh_token' });
    return Boolean(res?.ok);
  } catch (error) {
    console.error('[apple] revoke', error);
    return false;
  }
}
