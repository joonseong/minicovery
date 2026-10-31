import { isEmail, verifyPassword } from '@/lib/auth';
import { LOGIN_FAIL_LIMIT } from '@/lib/constants';
import { currentUser, setUidCookie } from '@/lib/session';
import { mergeDeviceIntoAccount, recentLoginFailures, track } from '@/lib/service';
import { getStore } from '@/lib/store';
import { sha256 } from '@/lib/util';

/**
 * 로그인: 이 기기의 임시 계정 기록이 있으면 로그인한 계정으로 옮긴다.
 * 같은 이메일로 15분에 10번 넘게 틀리면 429 (무차별 대입 방어, 이메일은 해시로만 기록)
 */
export async function POST(request: Request) {
  const { email, password } = (await request.json().catch(() => ({}))) as { email?: string; password?: string };
  const normalized = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!normalized || !isEmail(normalized) || typeof password !== 'string' || !password) {
    return Response.json({ error: '이메일 또는 비밀번호가 맞지 않아요.' }, { status: 401 });
  }
  const emailHash = sha256(normalized).slice(0, 16);
  if ((await recentLoginFailures(emailHash)) >= LOGIN_FAIL_LIMIT) return Response.json({ error: 'too_many' }, { status: 429 });

  const store = getStore();
  const device = await currentUser();
  const account = await store.findUserByEmail(normalized);
  if (!account?.passwordHash || !(await verifyPassword(password, account.passwordHash))) {
    await track(device.id, 'login_failed', { emailHash });
    return Response.json({ error: '이메일 또는 비밀번호가 맞지 않아요.' }, { status: 401 });
  }
  if (device.anon && device.id !== account.id) {
    try {
      await mergeDeviceIntoAccount(device, account);
    } catch (error) {
      // 이전에 실패해도 임시 데이터는 지우지 않는다 (US-11)
      console.error('[login] merge', error);
    }
  }
  setUidCookie(account.id);
  await track(account.id, 'login', { method: 'email' });
  return Response.json({ ok: true });
}
