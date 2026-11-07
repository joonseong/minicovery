import { randomBytes } from 'node:crypto';

import { kstDayLabel, track } from './service';
import { getStore } from './store';
import type { Course, Drop, DropBody, Report, Source, User } from './types';
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
  category: string;
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
  const categoryOf = new Map(courses.map(c => [c.id, c.category]));
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
      .map(d => ({ dropId: d.id, category: categoryOf.get(d.courseId) ?? '기타', meta: `${topicOf.get(d.courseId) ?? ''} · Drop ${d.index + 1}`, title: d.title, takeaway: d.body!.takeaway }));
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
  category: string;
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
    category: course.category,
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
  /** 'N명이 읽었어요': 열람한 사람 + 열람으로 바뀌기 전에 받아 간 사람 */
  readers: number;
  opens: number;
}

const readersOf = (c: Course) => (c.readers ?? 0) + (c.copies ?? 0);

const toRec = (c: Course): Recommended => ({
  id: c.id,
  title: c.title,
  category: c.category,
  total: c.outline.length,
  readers: readersOf(c),
  opens: c.opens ?? 0,
});

/** 다른 사람들이 만든 코스: 완주한 사람이 추천을 켠 코스. 운영자가 숨긴 것(featured: false)만 뺀다. 만든 사람은 드러내지 않는다 */
const listed = (c: Course) => c.status === 'completed' && Boolean(c.shared) && c.featured !== false;

/** 새 코스 화면에 한 번에 불러오는 수 (아래로 내리면 이어서) */
export const RECOMMEND_PAGE = 20;

/** 많이 눌러본(미리보기를 연) 순 → 많이 읽은 순 → 최근 순. 내가 만들었거나 전에 받은 코스는 뺀다 */
export async function recommendedCourses(user: User, offset = 0, limit = RECOMMEND_PAGE): Promise<{ items: Recommended[]; hasMore: boolean }> {
  const mine = new Set((await getStore().listCourses(user.id)).flatMap(c => [c.id, c.copiedFrom].filter(Boolean)));
  const all = (await getStore().listSharedCourses())
    .filter(c => listed(c) && !mine.has(c.id))
    .sort((a, b) => (b.opens ?? 0) - (a.opens ?? 0) || readersOf(b) - readersOf(a) || b.createdAt.localeCompare(a.createdAt));
  return { items: all.slice(offset, offset + limit).map(toRec), hasMore: all.length > offset + limit };
}

/** 추천 코스 미리보기를 열 때마다 하나 센다 (인기순). 만든 사람 본인은 세지 않는다 */
export async function recordRecommendOpen(user: User, id: string) {
  const store = getStore();
  const course = await store.getCourse(id);
  if (!course || !listed(course) || course.userId === user.id) return;
  course.opens = (course.opens ?? 0) + 1;
  await store.saveCourse(course);
}

/** 열람할 수 있는 Drop: 글이 다 만들어진 것 (건너뛴 Drop은 목차에만 남는다) */
const readable = (d: Drop) => d.status === 'ready' && Boolean(d.body);

/** 추천 코스 미리보기: 목차와 편마다 열람할 수 있는지 */
export async function recommendedCourse(id: string): Promise<(Recommended & { level: Course['level']; titles: string[]; readable: boolean[] }) | null> {
  const store = getStore();
  const course = await store.getCourse(id);
  if (!course || !listed(course)) return null;
  const drops = await store.listDrops(course.id);
  return {
    ...toRec(course),
    level: course.level,
    titles: course.outline.map(o => o.title),
    readable: course.outline.map((_, i) => drops.some(d => d.index === i && readable(d))),
  };
}

export interface SharedDrop {
  courseId: string;
  courseTitle: string;
  category: string;
  total: number;
  /** 몇 번째 Drop인지 (1부터, 주소에도 쓴다) */
  n: number;
  title: string;
  body: DropBody;
  imageUrl?: string;
  sources: Source[];
  corrected: boolean;
  /** 다음에 열람할 수 있는 Drop (1부터). 마지막이면 없음 */
  nextN?: number;
}

/**
 * 추천 코스의 n번째 Drop을 그 자리에서 열람한다 (받지 않음, 2026-11-07 대표 결정).
 * 하루 한 편·코스 한도·내 학습과 상관없고, 만든 사람의 기록(읽음·신고 표시)은 건드리지 않는다
 */
export async function sharedDrop(courseId: string, n: number): Promise<SharedDrop | null> {
  const store = getStore();
  const course = await store.getCourse(courseId);
  if (!course || !listed(course)) return null;
  const drops = (await store.listDrops(course.id)).filter(readable).sort((a, b) => a.index - b.index);
  const drop = drops.find(d => d.index === n - 1);
  if (!drop?.body) return null;
  const next = drops.find(d => d.index > drop.index);
  return {
    courseId: course.id,
    courseTitle: course.title,
    category: course.category,
    total: course.outline.length,
    n,
    title: drop.title,
    body: drop.body,
    imageUrl: drop.image?.url,
    sources: drop.sources,
    corrected: Boolean(drop.corrected),
    nextN: next ? next.index + 1 : undefined,
  };
}

/** 추천 코스 Drop을 열람함. 'N명이 읽었어요'는 사람마다 한 번 센다. 만든 사람 본인은 세지 않는다 */
export async function recordSharedRead(user: User, courseId: string, n: number) {
  const store = getStore();
  const course = await store.getCourse(courseId);
  if (!course || !listed(course) || course.userId === user.id) return;
  if (!user.readShared?.includes(course.id)) {
    user.readShared = [...(user.readShared ?? []), course.id];
    await store.saveUser(user);
    course.readers = (course.readers ?? 0) + 1;
    await store.saveCourse(course);
  }
  await track(user.id, 'shared_drop_read', { courseId, n });
}

/** 열람한 추천 코스 Drop 신고. 만든 사람의 Drop에는 표시하지 않고 운영자 신고 목록에만 남긴다 */
export async function reportSharedDrop(user: User, courseId: string, n: number, reason?: Report['reason']) {
  const store = getStore();
  const course = await store.getCourse(courseId);
  if (!course || !listed(course)) return false;
  const drop = (await store.listDrops(course.id)).find(d => d.index === n - 1);
  if (!drop) return false;
  await store.addReport({ id: newId(), userId: user.id, dropId: drop.id, at: nowIso(), reason });
  await track(user.id, 'shared_drop_reported', { courseId, dropId: drop.id, reason });
  return true;
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
