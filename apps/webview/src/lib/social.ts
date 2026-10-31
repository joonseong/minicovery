import { mergeDeviceIntoAccount, track } from './service';
import { currentUser, setUidCookie } from './session';
import { getStore } from './store';
import type { SocialField, User } from './types';

const METHOD: Record<SocialField, string> = { appleSub: 'apple', kakaoId: 'kakao', googleSub: 'google' };

/**
 * 소셜 로그인 공통 처리 (토큰 검증은 각 라우트에서 끝낸 뒤 부른다).
 * 처음이면 지금 쓰던 임시 계정을 그대로 가입 계정으로 바꾸고, 이미 있는 계정이면 기록을 옮겨 로그인한다.
 * patch: 로그인한 계정에 함께 저장할 값 (예: Apple refresh token)
 */
export async function signInWithSocial(field: SocialField, id: string, email?: string, patch: Partial<Pick<User, 'appleRefreshToken'>> = {}) {
  const store = getStore();
  const method = METHOD[field];
  const device = await currentUser();
  const account = await store.findUserBySocial(field, id);
  if (!account) {
    device.anon = false;
    device[field] = id;
    // 이메일은 계정마다 하나라서, 다른 계정이 이미 쓰는 주소면 넣지 않는다
    if (!device.email && email && !(await store.findUserByEmail(email))) device.email = email;
    Object.assign(device, patch);
    await store.saveUser(device);
    await track(device.id, 'signup', { method });
    return Response.json({ ok: true, created: true });
  }
  if (device.anon && device.id !== account.id) {
    try {
      await mergeDeviceIntoAccount(device, account);
    } catch (error) {
      console.error(`[${method}] merge`, error);
    }
  }
  if (Object.keys(patch).length) {
    Object.assign(account, patch);
    await store.saveUser(account);
  }
  setUidCookie(account.id);
  await track(account.id, 'login', { method });
  return Response.json({ ok: true, created: false });
}
