import { createRemoteJWKSet, jwtVerify } from 'jose';

import { signInWithSocial } from '@/lib/social';

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
/** iOS OAuth 클라이언트 ID (GoogleService-Info.plist의 CLIENT_ID). 여러 개면 쉼표로 */
const AUDIENCE = (process.env.GOOGLE_CLIENT_IDS ?? '').split(',').map(s => s.trim()).filter(Boolean);

/** Google로 계속하기. 앱(네이티브)이 받은 ID 토큰을 Google 공개키로 검증한다 */
export async function POST(request: Request) {
  const { idToken } = (await request.json()) as { idToken?: string };
  if (!idToken || !AUDIENCE.length) return Response.json({ error: 'token' }, { status: 400 });
  try {
    const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: AUDIENCE,
    });
    const email = payload.email_verified === true && typeof payload.email === 'string' ? payload.email.toLowerCase() : undefined;
    return signInWithSocial('googleSub', String(payload.sub), email);
  } catch {
    return Response.json({ error: 'Google 로그인을 확인하지 못했어요.' }, { status: 401 });
  }
}
