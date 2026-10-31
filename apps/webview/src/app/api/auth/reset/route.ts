import { createHash } from 'node:crypto';

import { hashPassword } from '@/lib/auth';
import { setUidCookie } from '@/lib/session';
import { track } from '@/lib/service';
import { getStore } from '@/lib/store';

/**
 * 새 비밀번호 저장 { token, password }. 성공하면 그 계정으로 로그인까지 한다 (D4).
 * 400 { error: 'password' | 'invalid' | 'expired' }
 */
export async function POST(request: Request) {
  const { token, password } = (await request.json().catch(() => ({}))) as { token?: string; password?: string };
  if (typeof password !== 'string' || password.length < 8) return Response.json({ error: 'password' }, { status: 400 });
  if (typeof token !== 'string' || !token) return Response.json({ error: 'invalid' }, { status: 400 });

  const store = getStore();
  const user = await store.findUserByResetHash(createHash('sha256').update(token).digest('base64url'));
  if (!user?.passwordReset) return Response.json({ error: 'invalid' }, { status: 400 });
  if (Date.parse(user.passwordReset.expiresAt) < Date.now()) {
    user.passwordReset = undefined;
    await store.saveUser(user);
    return Response.json({ error: 'expired' }, { status: 400 });
  }

  user.passwordHash = await hashPassword(password);
  user.passwordReset = undefined;
  await store.saveUser(user);
  setUidCookie(user.id);
  await track(user.id, 'password_reset');
  return Response.json({ ok: true });
}
