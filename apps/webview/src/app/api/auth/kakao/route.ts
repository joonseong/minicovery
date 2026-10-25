import { signInWithSocial } from '@/lib/social';

/**
 * 카카오로 계속하기. 앱(네이티브)이 받은 액세스 토큰을 카카오 서버에 물어
 * 우리 앱(KAKAO_APP_ID)에서 발급된 토큰인지 확인하고 회원번호를 얻는다.
 */
export async function POST(request: Request) {
  const { accessToken } = (await request.json()) as { accessToken?: string };
  if (!accessToken || !process.env.KAKAO_APP_ID) return Response.json({ error: 'token' }, { status: 400 });
  const headers = { Authorization: `Bearer ${accessToken}` };
  const info = await fetch('https://kapi.kakao.com/v1/user/access_token_info', { headers });
  const token = info.ok ? ((await info.json()) as { id?: number; app_id?: number }) : null;
  if (!token?.id || String(token.app_id) !== process.env.KAKAO_APP_ID) {
    return Response.json({ error: '카카오 로그인을 확인하지 못했어요.' }, { status: 401 });
  }
  // 이메일은 동의한 경우에만 온다
  const me = await fetch('https://kapi.kakao.com/v2/user/me', { headers });
  const account = me.ok ? ((await me.json()) as { kakao_account?: { email?: string; is_email_verified?: boolean } }).kakao_account : undefined;
  const email = account?.is_email_verified && account.email ? account.email.toLowerCase() : undefined;
  return signInWithSocial('kakaoId', String(token.id), email);
}
