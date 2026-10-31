import { cookies } from 'next/headers';

import { getStore } from './store';
import type { User } from './types';
import { newId, nowIso } from './util';

export const UID_COOKIE = 'mc_uid';

/**
 * 가입 전에는 기기 임시 계정(쿠키)으로 학습 기록을 저장한다 (PRD §17.1).
 * 앱 껍데기의 웹뷰도 같은 쿠키를 쓴다.
 * 저장소에 없는 id는 저장하지 않고 메모리 객체만 돌려준다 — 처음 무언가를 쓸 때(saveUser) 만들어진다.
 * 그냥 둘러보기만 하는 방문(크롤러·열어만 본 사람)으로 사용자 행이 쌓이지 않게
 */
export async function currentUser(): Promise<User> {
  const store = getStore();
  const jar = cookies();
  // 쿠키는 middleware가 첫 방문에 심는다
  const id = jar.get(UID_COOKIE)?.value ?? newId();
  const existing = await store.getUser(id);
  if (existing) return existing;
  return { id, anon: true, createdAt: nowIso(), notifyPermission: 'unknown' };
}

export const UID_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax' as const,
  secure: process.env.NODE_ENV === 'production',
  maxAge: 60 * 60 * 24 * 365 * 2,
  path: '/',
};

/** 가입·로그인 시 계정 id로 바꾼다 (route handler에서만 호출) */
export function setUidCookie(id: string) {
  cookies().set(UID_COOKIE, id, UID_COOKIE_OPTIONS);
}
