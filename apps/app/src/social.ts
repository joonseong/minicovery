import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { login as kakaoLogin } from '@react-native-seoul/kakao-login';

import { GOOGLE_IOS_CLIENT_ID, KAKAO_LOGIN } from './config';

/** 앱이 지원하는 소셜 로그인 (웹이 버튼을 보일지 정한다) */
export const socialAvailable = { kakao: KAKAO_LOGIN, google: Boolean(GOOGLE_IOS_CLIENT_ID) };

if (socialAvailable.google) GoogleSignin.configure({ iosClientId: GOOGLE_IOS_CLIENT_ID });

/** 카카오톡이 있으면 카카오톡으로, 없으면 카카오계정 웹 로그인. 서버는 액세스 토큰을 카카오에 확인한다 */
export async function signInWithKakao(): Promise<{ accessToken?: string; error?: string }> {
  try {
    const token = await kakaoLogin();
    return { accessToken: token.accessToken };
  } catch (error) {
    const message = String((error as { message?: string }).message ?? error);
    return { error: /cancel/i.test(message) ? 'canceled' : 'failed' };
  }
}

/** Google 로그인. 서버는 ID 토큰을 Google 공개키로 검증한다 */
export async function signInWithGoogle(): Promise<{ idToken?: string; error?: string }> {
  try {
    const res = await GoogleSignin.signIn();
    if (res.type !== 'success') return { error: 'canceled' };
    return res.data.idToken ? { idToken: res.data.idToken } : { error: 'failed' };
  } catch (error) {
    const code = (error as { code?: string }).code;
    return { error: code === statusCodes.SIGN_IN_CANCELLED ? 'canceled' : 'failed' };
  }
}
