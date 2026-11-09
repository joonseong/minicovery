import { currentUser } from '@/lib/session';
import { track } from '@/lib/service';
import { getStore } from '@/lib/store';
import { nowIso } from '@/lib/util';

/**
 * 알림 권한 결과, 푸시 토큰, 재안내 배너 닫기. 알림 시간은 모두 아침 8시라 받지 않는다 (2026-11-10).
 * 재질문(D3): later → '나중에' 횟수를 늘리고 다음 질문을 미룬다, never → 다시 묻지 않는다,
 * permission denied → 거절 횟수 +1, granted → 횟수 초기화
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    permission?: 'granted' | 'denied';
    pushToken?: string;
    dismissBanner?: boolean;
    later?: boolean;
    never?: boolean;
  };
  const user = await currentUser();
  if (body.permission === 'granted' || body.permission === 'denied') {
    user.notifyPermission = body.permission;
    if (body.permission === 'granted') {
      user.notifyDeclines = 0;
      user.notifyNever = false;
    } else user.notifyDeclines = (user.notifyDeclines ?? 0) + 1;
    await track(user.id, 'notify_permission', { permission: body.permission });
  }
  if (body.later === true) {
    user.notifyDeclines = (user.notifyDeclines ?? 0) + 1;
    user.notifyAskedAt = nowIso();
    await track(user.id, 'notify_later', { declines: user.notifyDeclines });
  }
  if (body.never === true) {
    user.notifyNever = true;
    await track(user.id, 'notify_never');
  }
  if (typeof body.pushToken === 'string' && body.pushToken) user.pushToken = body.pushToken;
  if (body.dismissBanner) user.notifyBannerDismissedAt = nowIso();
  await getStore().saveUser(user);
  return Response.json({ ok: true });
}
