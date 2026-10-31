import { createRemoteJWKSet, jwtVerify } from 'jose';

import { appleServerConfig, exchangeAppleCode } from '@/lib/auth';
import { signInWithSocial } from '@/lib/social';

const APPLE_JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
const BUNDLE_ID = process.env.APPLE_BUNDLE_ID ?? 'com.minicovery.app';

/**
 * Apple로 계속하기. 앱(네이티브)이 받은 identity token을 Apple 공개키로 검증한다.
 * 처음이면 지금 쓰던 임시 계정을 그대로 가입 계정으로 바꾸고, 이미 있는 계정이면 기록을 옮겨 로그인한다.
 * authorizationCode가 함께 오고 Apple 서버 키(APPLE_TEAM_ID·KEY_ID·PRIVATE_KEY)가 있으면
 * refresh token으로 바꿔 저장한다 — 계정 삭제 때 Apple 쪽 연결을 끊기 위해 (실패해도 로그인은 진행)
 */
export async function POST(request: Request) {
  const { identityToken, authorizationCode } = (await request.json().catch(() => ({}))) as { identityToken?: string; authorizationCode?: string };
  if (!identityToken) return Response.json({ error: 'token' }, { status: 400 });
  let sub: string;
  let email: string | undefined;
  try {
    const { payload } = await jwtVerify(identityToken, APPLE_JWKS, { issuer: 'https://appleid.apple.com', audience: BUNDLE_ID });
    sub = String(payload.sub);
    email = typeof payload.email === 'string' ? payload.email.toLowerCase() : undefined;
  } catch {
    return Response.json({ error: 'Apple 로그인을 확인하지 못했어요.' }, { status: 401 });
  }

  const refreshToken = authorizationCode && appleServerConfig() ? await exchangeAppleCode(authorizationCode) : undefined;
  return signInWithSocial('appleSub', sub, email, refreshToken ? { appleRefreshToken: refreshToken } : {});
}
