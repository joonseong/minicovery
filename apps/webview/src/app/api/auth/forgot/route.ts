import { createHash, randomBytes } from 'node:crypto';

import { isEmail } from '@/lib/auth';
import { mailConfigured, sendMail } from '@/lib/mail';
import { track } from '@/lib/service';
import { getStore } from '@/lib/store';

/** 토큰 유효 1시간, 같은 계정의 재요청은 5분에 한 번만 (메일 폭탄 방지) */
const TOKEN_TTL_MS = 60 * 60_000;
const RESEND_AFTER_MS = 5 * 60_000;

/**
 * 비밀번호 재설정 메일 { email }. 계정이 있는지 드러내지 않으려고 항상 200 { ok: true } (2026-10-31 대표 결정 D4).
 * 이메일 가입 계정(passwordHash 있음)에만 보낸다. 토큰은 해시만 저장한다
 */
export async function POST(request: Request) {
  const { email } = (await request.json().catch(() => ({}))) as { email?: string };
  const normalized = typeof email === 'string' ? email.trim().toLowerCase() : '';
  if (!normalized || !isEmail(normalized)) return Response.json({ error: 'email' }, { status: 400 });
  // 운영에서 메일 설정이 없으면 보낼 수 없다고 알린다 (개발은 콘솔에 찍고 진행)
  if (!mailConfigured() && process.env.VERCEL_ENV === 'production') return Response.json({ error: 'mail' }, { status: 503 });

  const store = getStore();
  const user = await store.findUserByEmail(normalized);
  if (!user?.passwordHash) return Response.json({ ok: true });
  // 방금 보낸 메일이 있으면 조용히 넘어간다
  if (user.passwordReset && Date.parse(user.passwordReset.expiresAt) - TOKEN_TTL_MS + RESEND_AFTER_MS > Date.now()) {
    return Response.json({ ok: true });
  }

  const token = randomBytes(32).toString('base64url');
  user.passwordReset = {
    hash: createHash('sha256').update(token).digest('base64url'),
    expiresAt: new Date(Date.now() + TOKEN_TTL_MS).toISOString(),
  };
  await store.saveUser(user);

  const origin = (process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin).replace(/\/$/, '');
  const link = `${origin}/reset?token=${token}`;
  const text = [
    '미니커버리 비밀번호 재설정',
    '',
    '아래 링크를 열어 새 비밀번호를 정해 주세요. 링크는 1시간 동안만 쓸 수 있어요.',
    link,
    '',
    '비밀번호 재설정을 요청하지 않았다면 이 메일은 무시해 주세요. 비밀번호는 바뀌지 않아요.',
  ].join('\n');
  const html = `<p>미니커버리 비밀번호 재설정</p>
<p>아래 링크를 열어 새 비밀번호를 정해 주세요. 링크는 <b>1시간</b> 동안만 쓸 수 있어요.</p>
<p><a href="${link}">${link}</a></p>
<p style="color:#666">비밀번호 재설정을 요청하지 않았다면 이 메일은 무시해 주세요. 비밀번호는 바뀌지 않아요.</p>`;
  await sendMail({ to: normalized, subject: '미니커버리 비밀번호 재설정', html, text });
  await track(user.id, 'password_reset_requested');
  return Response.json({ ok: true });
}
