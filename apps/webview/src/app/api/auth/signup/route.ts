import { hashPassword, isEmail } from '@/lib/auth';
import { currentUser } from '@/lib/session';
import { track } from '@/lib/service';
import { getStore } from '@/lib/store';

/** 가입: 지금 쓰던 임시 계정을 그대로 가입 계정으로 바꾼다. 기록 이전이 필요 없다 (US-11) */
export async function POST(request: Request) {
  const { email, password } = (await request.json().catch(() => ({}))) as { email?: string; password?: string };
  if (!email || typeof email !== 'string' || !isEmail(email.trim())) return Response.json({ error: '이메일 형식을 확인해 주세요.' }, { status: 400 });
  if (!password || typeof password !== 'string' || password.length < 8) return Response.json({ error: '비밀번호는 8자 이상이에요.' }, { status: 400 });
  const store = getStore();
  const normalized = email.trim().toLowerCase();
  if (await store.findUserByEmail(normalized)) {
    return Response.json({ error: '이미 가입된 이메일이에요. 로그인해 주세요.' }, { status: 409 });
  }
  const user = await currentUser();
  user.anon = false;
  user.email = normalized;
  user.passwordHash = await hashPassword(password);
  await store.saveUser(user);
  await track(user.id, 'signup', { method: 'email' });
  return Response.json({ ok: true });
}
