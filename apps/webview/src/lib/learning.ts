import { randomBytes } from 'node:crypto';

import { courseQuota, deleteFreeCourses, isPlus, kstDayLabel, type Quota, track } from './service';
import { getStore } from './store';
import type { Course, Drop, User } from './types';
import { daysBetween, kstDate, kstWeekday, newId, nowIso, pickRecallDrop } from './util';

/* ---------- 기억에 남게: 어제 되짚기 · 이번 주 복습 ---------- */

/** 'Drop 제목: 개념' 형식이면 개념만 */
const conceptOf = (title: string) => (title.includes(':') ? title.slice(title.lastIndexOf(':') + 1).trim() : title);

export interface Recall {
  /** 제목의 콜론 뒤 조각 (없으면 제목 전체) */
  concept: string;
  /** Drop 제목 전체 */
  title: string;
  takeaway: string;
  courseTopic: string;
  /** 지금 열려는 Drop과 같은 코스의 Drop인지 */
  sameCourse: boolean;
  /** 어제(KST) 읽었으면 'yesterday', 아니면 'M월 D일' */
  when: 'yesterday' | string;
}

/**
 * 되짚을 Drop: 오늘 전에 완료한 Drop 중 (지운 코스 제외) 같은 코스의 직전 완료 Drop, 없으면 가장 최근 완료 Drop
 */
async function recallFrom(user: User, current: { id?: string; courseId?: string } | null): Promise<(Recall & { dropId: string }) | null> {
  const store = getStore();
  const courses = await store.listCourses(user.id);
  const last = pickRecallDrop(await store.listDropsByUser(user.id), courses, current);
  if (!last) return null;
  return {
    dropId: last.id,
    concept: conceptOf(last.title),
    title: last.title,
    takeaway: last.body!.takeaway!,
    courseTopic: courses.find(c => c.id === last.courseId)?.topic ?? '',
    sameCourse: Boolean(current?.courseId && last.courseId === current.courseId),
    when: daysBetween(last.completedAt!, nowIso()) === 1 ? 'yesterday' : kstDayLabel(last.completedAt!),
  };
}

/** 새 Drop을 열 때 맨 위에 보여 줄 '어제 되짚기' */
export async function recallFor(user: User, drop: Drop): Promise<Recall | null> {
  if (drop.completedAt) return null;
  return recallFrom(user, drop);
}

/** 홈 카드용: 오늘 Drop을 읽기 전에 마지막으로 읽은 Drop의 한 문장 */
export async function recallForToday(user: User): Promise<(Recall & { dropId: string }) | null> {
  return recallFrom(user, null);
}

export interface ReviewItem {
  dropId: string;
  meta: string;
  title: string;
  takeaway: string;
}

export interface WeekReviewData {
  range: string;
  items: ReviewItem[];
  /** 월·화요일(KST)에는 지난주(월~일)에 읽은 것도 함께 (없으면 없음) */
  lastWeek?: { range: string; items: ReviewItem[] };
}

/** 이번 주(월~일, KST)에 읽은 Drop의 '한 문장으로'. 지운 코스의 Drop은 빼고, 월·화에는 지난주도 채운다 */
export async function weekReview(user: User): Promise<WeekReviewData> {
  const store = getStore();
  const courses = await store.listCourses(user.id);
  const alive = new Set(courses.filter(c => c.status === 'active' || c.status === 'completed').map(c => c.id));
  const topicOf = new Map(courses.map(c => [c.id, c.topic]));
  const drops = (await store.listDropsByUser(user.id))
    .filter(d => d.completedAt && d.body?.takeaway && alive.has(d.courseId))
    .sort((a, b) => a.completedAt!.localeCompare(b.completedAt!));
  const label = (d: Date) => `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일`;
  const week = (monday: Date) => {
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    const from = monday.toISOString().slice(0, 10);
    const to = sunday.toISOString().slice(0, 10);
    const items: ReviewItem[] = drops
      .filter(d => kstDate(d.completedAt!) >= from && kstDate(d.completedAt!) <= to)
      .map(d => ({ dropId: d.id, meta: `${topicOf.get(d.courseId) ?? ''} · Drop ${d.index + 1}`, title: d.title, takeaway: d.body!.takeaway }));
    return { range: `${label(monday)} ~ ${label(sunday)}`, items };
  };
  const today = new Date(kstDate());
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7));
  const lastMonday = new Date(monday);
  lastMonday.setUTCDate(monday.getUTCDate() - 7);
  const lastWeek = [1, 2].includes(kstWeekday()) ? week(lastMonday) : undefined;
  return { ...week(monday), lastWeek: lastWeek?.items.length ? lastWeek : undefined };
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

export type CopyResult =
  | { ok: true; courseId: string; firstDropId: string }
  | { ok: false; reason: Exclude<Quota, { ok: true }>['reason'] | 'missing' }
  /** 이미 받았거나 내가 만든 코스. 그 코스로 바로 갈 수 있게 id를 준다 */
  | { ok: false; reason: 'already'; courseId: string };

/**
 * 추천 코스 받기: 목차와 다 만든 Drop을 그대로 복사해 내 코스로 만든다 (AI 생성 없음).
 * 새 코스 만들기와 같은 한도를 쓴다. 무료 사용자가 replace로 보내면 지금 코스를 지우고 받는다
 */
export async function copyRecommended(user: User, sourceId: string, replace: boolean): Promise<CopyResult> {
  const store = getStore();
  const source = await store.getCourse(sourceId);
  if (!source || source.status !== 'completed' || !source.shared || !source.featured) return { ok: false, reason: 'missing' };
  const already = (await store.listCourses(user.id)).find(c => c.status !== 'deleted' && (c.id === sourceId || c.copiedFrom === sourceId));
  if (already) return { ok: false, reason: 'already', courseId: already.id };
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
      generatingAt: undefined,
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
