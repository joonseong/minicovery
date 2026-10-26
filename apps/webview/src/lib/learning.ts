import { randomBytes } from 'node:crypto';

import { courseQuota, deleteFreeCourses, isPlus, type Quota, track } from './service';
import { getStore } from './store';
import type { Course, Drop, User } from './types';
import { kstDate, newId, nowIso } from './util';

/* ---------- 기억에 남게: 어제 되짚기 · 이번 주 복습 ---------- */

/** 'Drop 제목: 개념' 형식이면 개념만 */
const conceptOf = (title: string) => (title.includes(':') ? title.slice(title.lastIndexOf(':') + 1).trim() : title);

export interface Recall {
  concept: string;
  takeaway: string;
}

/** 새 Drop을 열 때 맨 위에 보여 줄 '어제 되짚기': 오늘 전에 마지막으로 읽은 Drop의 '한 문장으로' */
export async function recallFor(user: User, drop: Drop): Promise<Recall | null> {
  if (drop.completedAt) return null;
  const today = kstDate();
  const last = (await getStore().listDropsByUser(user.id))
    .filter(d => d.completedAt && d.id !== drop.id && kstDate(d.completedAt) < today && d.body?.takeaway)
    .sort((a, b) => b.completedAt!.localeCompare(a.completedAt!))[0];
  return last ? { concept: conceptOf(last.title), takeaway: last.body!.takeaway } : null;
}

export interface ReviewItem {
  dropId: string;
  meta: string;
  title: string;
  takeaway: string;
}

/** 이번 주(월~일, KST)에 읽은 Drop의 '한 문장으로' */
export async function weekReview(user: User): Promise<{ range: string; items: ReviewItem[] }> {
  const store = getStore();
  const today = new Date(kstDate());
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7));
  const sunday = new Date(monday);
  sunday.setUTCDate(monday.getUTCDate() + 6);
  const from = monday.toISOString().slice(0, 10);
  const drops = (await store.listDropsByUser(user.id))
    .filter(d => d.completedAt && kstDate(d.completedAt) >= from && d.body?.takeaway)
    .sort((a, b) => a.completedAt!.localeCompare(b.completedAt!));
  const topics = new Map<string, string>();
  const items: ReviewItem[] = [];
  for (const d of drops) {
    if (!topics.has(d.courseId)) topics.set(d.courseId, (await store.getCourse(d.courseId))?.topic ?? '');
    items.push({ dropId: d.id, meta: `${topics.get(d.courseId)} · Drop ${d.index + 1}`, title: d.title, takeaway: d.body!.takeaway });
  }
  const label = (d: Date) => `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
  return { range: `${label(monday)} ~ ${label(sunday)}`, items };
}

/* ---------- 완주 공유 카드 ---------- */

export interface ShareCard {
  title: string;
  topic: string;
  total: number;
  takeaway: string;
  completedLabel: string;
}

/** 완주한 코스의 공유 링크 id (처음 공유할 때 만든다) */
export async function shareLink(user: User, courseId: string): Promise<string | null> {
  const store = getStore();
  const course = await store.getCourse(courseId);
  if (!course || course.userId !== user.id || course.status !== 'completed') return null;
  if (!course.shareId) {
    course.shareId = randomBytes(6).toString('base64url');
    await store.saveCourse(course);
    await track(user.id, 'course_share_link', { courseId });
  }
  return course.shareId;
}

/** 공개 공유 페이지에 보여 줄 값 (이름·계정 정보는 넣지 않는다) */
export async function shareCard(shareId: string): Promise<ShareCard | null> {
  const store = getStore();
  const course = await store.findCourseByShareId(shareId);
  if (!course || course.status !== 'completed') return null;
  const drops = await store.listDrops(course.id);
  const pick = drops.find(d => d.body?.takeaway);
  const [, m, d] = kstDate(course.completedAt ?? course.createdAt).split('-').map(Number);
  return {
    title: course.title,
    topic: course.topic,
    total: course.outline.length,
    takeaway: pick?.body?.takeaway ?? '',
    completedLabel: `${m}월 ${d}일`,
  };
}

/* ---------- 다른 사람이 만든 추천 코스 ---------- */

export interface Recommended {
  id: string;
  title: string;
  category: string;
  total: number;
  copies: number;
}

const toRec = (c: Course): Recommended => ({ id: c.id, title: c.title, category: c.category, total: c.outline.length, copies: c.copies ?? 0 });

/** 완주한 사람이 추천을 켰고, 운영자가 고른 코스. 만든 사람은 드러내지 않는다 */
export async function recommendedCourses(user: User, limit = 5): Promise<Recommended[]> {
  const mine = new Set((await getStore().listCourses(user.id)).flatMap(c => [c.id, c.copiedFrom].filter(Boolean)));
  return (await getStore().listSharedCourses())
    .filter(c => c.featured && !mine.has(c.id))
    .sort((a, b) => (b.copies ?? 0) - (a.copies ?? 0))
    .slice(0, limit)
    .map(toRec);
}

export async function recommendedCourse(id: string): Promise<(Recommended & { level: Course['level']; titles: string[] }) | null> {
  const course = await getStore().getCourse(id);
  if (!course || course.status !== 'completed' || !course.shared || !course.featured) return null;
  return { ...toRec(course), level: course.level, titles: course.outline.map(o => o.title) };
}

/** 완주 화면에서 추천 코스로 내놓기 켜고 끄기 */
export async function setCourseShared(user: User, courseId: string, on: boolean) {
  const store = getStore();
  const course = await store.getCourse(courseId);
  if (!course || course.userId !== user.id || course.status !== 'completed') return false;
  course.shared = on;
  if (!on) course.featured = false;
  await store.saveCourse(course);
  await track(user.id, on ? 'course_shared' : 'course_unshared', { courseId });
  return true;
}

/**
 * 추천 코스 받기: 목차와 다 만든 Drop을 그대로 복사해 내 코스로 만든다 (AI 생성 없음).
 * 새 코스 만들기와 같은 한도를 쓴다. 무료 사용자가 replace로 보내면 지금 코스를 지우고 받는다
 */
export async function copyRecommended(
  user: User,
  sourceId: string,
  replace: boolean,
): Promise<{ ok: true; courseId: string; firstDropId: string } | { ok: false; reason: Exclude<Quota, { ok: true }>['reason'] | 'missing' }> {
  const store = getStore();
  const source = await store.getCourse(sourceId);
  if (!source || source.status !== 'completed' || !source.shared || !source.featured) return { ok: false, reason: 'missing' };
  const quota = await courseQuota(user);
  if (!quota.ok) {
    if (quota.reason === 'free' && replace && !isPlus(user)) await deleteFreeCourses(user);
    else return { ok: false, reason: quota.reason };
  }
  const now = nowIso();
  const course: Course = {
    ...source,
    id: newId(),
    userId: user.id,
    status: 'active',
    createdAt: now,
    completedAt: undefined,
    explainAnswer: undefined,
    lastReadAt: undefined,
    openedAllAt: undefined,
    deletedAt: undefined,
    shared: undefined,
    featured: undefined,
    copies: undefined,
    shareId: undefined,
    copiedFrom: source.id,
  };
  await store.saveCourse(course);
  let firstDropId = '';
  for (const d of await store.listDrops(source.id)) {
    const copy: Drop = {
      ...d,
      id: newId(),
      courseId: course.id,
      userId: user.id,
      completedAt: undefined,
      signal: undefined,
      readAt: undefined,
      reportedAt: undefined,
      batchId: undefined,
    };
    await store.saveDrop(copy);
    if (copy.index === 0) firstDropId = copy.id;
  }
  source.copies = (source.copies ?? 0) + 1;
  await store.saveCourse(source);
  await track(user.id, 'course_copied', { sourceId, courseId: course.id });
  return { ok: true, courseId: course.id, firstDropId };
}

/** 어드민: 추천 후보(추천을 켠 완주 코스) */
export async function sharedCandidates() {
  return (await getStore().listSharedCourses()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function setFeatured(courseId: string, on: boolean) {
  const store = getStore();
  const course = await store.getCourse(courseId);
  if (!course || !course.shared) return false;
  course.featured = on;
  await store.saveCourse(course);
  return true;
}
