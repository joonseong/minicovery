import { cookies } from 'next/headers';

import { appleServerConfig, revokeAppleToken } from '@/lib/auth';
import { currentUser, UID_COOKIE } from '@/lib/session';
import { track } from '@/lib/service';
import { getStore } from '@/lib/store';

/**
 * 계정 삭제 (App Store 심사 기준 5.1.1(v)). 사용자·코스·Drop·이벤트·신고·실패 기록을 지우고 쿠키를 지운다.
 * 사용량 로그(비용 집계)는 사용자 id만 남는다. 익명의 '학습 기록 지우기'도 같은 라우트.
 * Apple 로그인 계정은 Apple 쪽 연결(refresh token)도 끊는다 — 실패해도 삭제는 진행한다
 */
export async function POST() {
  const user = await currentUser();
  if (user.appleRefreshToken && appleServerConfig()) {
    const revoked = await revokeAppleToken(user.appleRefreshToken);
    if (!revoked) console.error('[delete] apple revoke failed', user.id);
  }
  await getStore().deleteUserData(user.id);
  await track(user.id, 'account_deleted', { anon: user.anon });
  cookies().delete(UID_COOKIE);
  return Response.json({ ok: true });
}
