import { getGenerator } from './ai';
import { costUsd } from './ai/pricing';
import type { Metered } from './ai/types';
import {
  DAILY_PREMIUM_REALTIME,
  FREE_COURSE_LIMIT,
  LEARNED_COMPLETION_RATIO,
  NOTIFY_ASK_INTERVAL_DAYS,
  PLUS_MONTHLY_COURSES,
  REVIEW_AT_DROPS,
  STAGES,
} from './constants';
import { formatDropText, isCompleteBody, parseDropText } from './drop-format';
import { getStore } from './store';
import type {
  Course,
  Drop,
  EasyBody,
  ExplainAnswer,
  GenerationMode,
  Level,
  ModelTier,
  TaskType,
  UnderstandingSignal,
  User,
  UsageLog,
} from './types';
import { kstDate, newId, nowIso } from './util';

/* ---------- 기록 ---------- */

export async function track(userId: string, name: string, props?: Record<string, unknown>) {
  await getStore().addEvent({ id: newId(), userId, name, props, at: nowIso() });
}

async function logUsage(userId: string, purpose: UsageLog['purpose'], m: Metered<unknown>, mode: GenerationMode) {
  await getStore().addUsage({
    id: newId(),
    userId,
    at: nowIso(),
    purpose,
    model: m.model,
    mode,
    inputTokens: m.usage.inputTokens,
    outputTokens: m.usage.outputTokens,
    cacheReadTokens: m.usage.cacheReadTokens,
    searches: m.usage.searches,
    costUsd: costUsd(m.model, m.usage, mode === 'batch'),
  });
}

async function logFailure(userId: string, stage: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[${stage}]`, error);
  await getStore().addFailure({ id: newId(), userId, at: nowIso(), stage, message });
}

/* ---------- 스트리밍 응답 (NDJSON) ---------- */

export type StreamEvent = Record<string, unknown> & { type: string };

export function ndjsonStream(run: (send: (e: StreamEvent) => void) => Promise<void>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      let closed = false;
      const send = (e: StreamEvent) => {
        if (closed) return;
        try {
          controller.enqueue(encoder.encode(JSON.stringify(e) + '\n'));
        } catch {
          // 사용자가 화면을 떠나 연결이 끊겨도 생성은 끝까지 진행해 저장한다 (US-03 재진입)
          closed = true;
        }
      };
      try {
        await run(send);
      } finally {
        if (!closed) controller.close();
      }
    },
  });
  return new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}

/* ---------- 주제 검사 ---------- */

export async function checkTopic(user: User, input: string) {
  const g = getGenerator();
  const m = await g.checkTopic(input);
  await logUsage(user.id, 'check', m, 'realtime');
  return m.result;
}

/* ---------- 코스 ---------- */

/** App Store 구독이 유효하거나, 베타(PLUS_BETA_FREE) 동안 무료로 켠 경우. 갱신 처리 지연을 감안해 만료 뒤 6시간은 봐준다 */
export const isPlus = (user: User) =>
  (user.plusExpiresAt ? Date.parse(user.plusExpiresAt) + 6 * 3600_000 > Date.now() : false) ||
  (process.env.PLUS_BETA_FREE === 'true' && Boolean(user.plusSince));

export type Quota = { ok: true } | { ok: false; reason: 'free' | 'monthly' };

const addMonths = (iso: string, n: number) => {
  const d = new Date(iso);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString();
};

/**
 * Plus 혜택을 세는 한 달: 구독 시작일 기준으로 한 달씩 (2026-10-27 대표 결정, 달력 월 아님).
 * App Store 구독은 만료일(다음 결제일)에서 한 달 전부터, 체험 중이면 구독 시작부터. 베타는 시작일 기준으로 돌린다
 */
export function plusPeriod(user: User): { start: string; end: string } | null {
  if (!isPlus(user) || !user.plusSince) return null;
  if (user.plusExpiresAt) {
    const start = addMonths(user.plusExpiresAt, -1);
    return { start: start > user.plusSince ? start : user.plusSince, end: user.plusExpiresAt };
  }
  const now = nowIso();
  let start = user.plusSince;
  while (addMonths(start, 1) <= now) start = addMonths(start, 1);
  return { start, end: addMonths(start, 1) };
}

/** 'M월 D일' (KST) */
const kstDayLabel = (iso: string) => {
  const [, m, d] = kstDate(iso).split('-').map(Number);
  return `${m}월 ${d}일`;
};

/** 무료는 한 번에 진행 중인 코스 1개(다 배운 코스는 세지 않음), Plus는 구독 한 달에 새 코스 3개 */
export async function courseQuota(user: User): Promise<Quota> {
  const courses = (await getStore().listCourses(user.id)).filter(c => c.status !== 'failed');
  const period = plusPeriod(user);
  if (!period) {
    const going = courses.filter(c => (c.status === 'active' || c.status === 'generating') && !c.openedAllAt);
    return going.length < FREE_COURSE_LIMIT ? { ok: true } : { ok: false, reason: 'free' };
  }
  const made = courses.filter(c => c.createdAt >= period.start).length;
  return made < PLUS_MONTHLY_COURSES ? { ok: true } : { ok: false, reason: 'monthly' };
}

export interface PlusUsage {
  coursesLeft: number;
  openAllLeft: number;
  /** 다시 채워지는 날 'M월 D일' */
  resetLabel: string;
}

/** Plus 남은 횟수 (프로필·설정·오늘 화면 표시용) */
export async function plusUsage(user: User): Promise<PlusUsage | null> {
  const period = plusPeriod(user);
  if (!period) return null;
  const made = (await getStore().listCourses(user.id)).filter(c => c.status !== 'failed' && c.createdAt >= period.start).length;
  return {
    coursesLeft: Math.max(0, PLUS_MONTHLY_COURSES - made),
    openAllLeft: user.openAllAt && user.openAllAt >= period.start ? 0 : 1,
    resetLabel: kstDayLabel(period.end),
  };
}

/** 무료 사용자가 새 주제로 바꿀 때: 진행 중인 코스와 Drop은 지우고, 다 배운 코스·전체 열린 코스와 기록(user.learned)은 남긴다 */
export async function deleteFreeCourses(user: User) {
  const store = getStore();
  for (const c of await store.listCourses(user.id)) {
    if ((c.status !== 'active' && c.status !== 'generating') || c.openedAllAt) continue;
    c.status = 'deleted';
    await store.saveCourse(c);
  }
  if (user.tomorrowCourseId) {
    user.tomorrowCourseId = undefined;
    user.todayPick = undefined;
    await store.saveUser(user);
  }
  await track(user.id, 'course_replaced');
}

export async function createCourse(
  user: User,
  input: { topic: string; level: Level; category: string; taskType: TaskType },
  send: (e: StreamEvent) => void,
  existing?: Course,
) {
  const store = getStore();
  const isFirstCourse = (await store.listCourses(user.id)).filter(c => c.status !== 'failed').length <= (existing ? 1 : 0);
  const course: Course = existing ?? {
    id: newId(),
    userId: user.id,
    topic: input.topic,
    title: input.topic,
    level: input.level,
    category: input.category,
    taskType: input.taskType,
    status: 'generating',
    outline: [],
    related: [],
    regenUsed: false,
    createdAt: nowIso(),
  };
  course.status = 'generating';
  await store.saveCourse(course);
  send({ type: 'course', courseId: course.id });

  const g = getGenerator();
  let m: Metered<{ title: string; drops: string[]; related: string[] }> | undefined;
  for (let attempt = 0; attempt < 2 && !m; attempt++) {
    try {
      if (attempt > 0) send({ type: 'retry' });
      m = await g.curriculum(
        { topic: course.topic, level: course.level, isFirstCourse },
        {
          title: title => send({ type: 'title', title }),
          drop: (title, index) => send({ type: 'drop', title, index }),
        },
      );
    } catch (error) {
      await logFailure(user.id, 'curriculum', error);
    }
  }
  if (!m) {
    course.status = 'failed';
    await store.saveCourse(course);
    send({ type: 'error', message: '코스를 만들지 못했어요.' });
    return;
  }
  await logUsage(user.id, 'curriculum', m, 'realtime');

  // 재생성이면 이전 Drop을 버린다
  for (const d of await store.listDrops(course.id)) {
    d.status = 'failed';
    await store.saveDrop({ ...d, courseId: `${course.id}:discarded` });
  }

  course.title = m.result.title;
  course.outline = m.result.drops.map(title => ({ title }));
  course.related = m.result.related.slice(0, 2);
  course.status = 'active';
  await store.saveCourse(course);
  for (const [index, title] of m.result.drops.entries()) {
    await store.saveDrop({ id: newId(), courseId: course.id, userId: user.id, index, title, status: 'pending', sources: [] });
  }
  const first = (await store.listDrops(course.id))[0];
  // 새 코스는 바로 읽을 수 있게 오늘의 코스로 고른다
  if (!(await completedToday(user.id))) {
    user.todayPick = { date: kstDate(), courseId: course.id };
    await store.saveUser(user);
  }
  await track(user.id, existing ? 'course_regenerated' : 'course_created', {
    courseId: course.id,
    category: course.category,
    taskType: course.taskType,
    level: course.level,
  });
  send({ type: 'done', courseId: course.id, firstDropId: first?.id });
}

/* ---------- Drop 생성 ---------- */

/** 오늘 실시간으로 Opus 생성한 개수가 기준을 넘으면 Sonnet (PRD §29.3) */
async function pickRealtimeModel(userId: string): Promise<ModelTier> {
  const today = kstDate();
  const usage = await getStore().listUsage(new Date(Date.now() - 36 * 3600_000).toISOString());
  const premiumToday = usage.filter(
    u => u.userId === userId && u.purpose === 'drop' && u.mode !== 'batch' && u.model === 'opus' && kstDate(u.at) === today,
  ).length;
  return premiumToday >= DAILY_PREMIUM_REALTIME ? 'sonnet' : 'opus';
}

async function learnedTitles(course: Course, beforeIndex: number) {
  const drops = await getStore().listDrops(course.id);
  return drops.filter(d => d.index < beforeIndex && d.completedAt).map(d => d.title);
}

/**
 * 실시간 생성(스트리밍). 이미 생성 중이면 완료를 기다렸다가 결과를 보낸다.
 * done 이후에도 연결을 유지한 채 사실 검증을 돌려, 고친 경우 corrected를 보낸다 (PRD §14.3).
 */
export async function generateDrop(user: User, dropId: string, mode: GenerationMode, send: (e: StreamEvent) => void) {
  const store = getStore();
  let drop = await store.getDrop(dropId);
  if (!drop || drop.userId !== user.id) {
    send({ type: 'error', message: 'Drop을 찾을 수 없어요.' });
    return;
  }
  if (drop.status === 'ready') {
    send({ type: 'ready', drop });
    return;
  }
  if (drop.status === 'generating') {
    send({ type: 'status', message: '거의 다 됐어요' });
    for (let i = 0; i < 120; i++) {
      await new Promise(r => setTimeout(r, 1000));
      drop = (await store.getDrop(dropId))!;
      if (drop.status !== 'generating') break;
    }
    if (drop.status === 'ready') send({ type: 'ready', drop });
    else send({ type: 'error', message: 'Drop을 만들지 못했어요.' });
    return;
  }

  const course = (await store.getCourse(drop.courseId))!;
  drop.status = 'generating';
  drop.mode = mode;
  await store.saveDrop(drop);

  const g = getGenerator();
  const model = await pickRealtimeModel(user.id);
  const params = {
    courseTitle: course.title,
    level: course.level,
    outline: course.outline.map(o => o.title),
    index: drop.index,
    learnedTitles: await learnedTitles(course, drop.index),
    model,
  };

  let output: Awaited<ReturnType<typeof g.drop>> | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      if (attempt > 0) send({ type: 'retry' });
      const m = await g.drop(params, {
        status: message => send({ type: 'status', message }),
        text: delta => send({ type: 'text', delta }),
      });
      await logUsage(user.id, 'drop', m, mode);
      if (m.result.refused) {
        drop.status = 'failed';
        await store.saveDrop(drop);
        send({ type: 'refused' });
        return;
      }
      const body = parseDropText(m.result.text);
      // 출처 0개면 발행하지 않고 다시 생성 (PRD §14.2)
      if (!isCompleteBody(body) || m.result.sources.length === 0) {
        throw new Error(isCompleteBody(body) ? 'no sources' : 'incomplete body');
      }
      output = m;
      break;
    } catch (error) {
      await logFailure(user.id, 'drop', error);
    }
  }

  if (!output) {
    drop.status = 'failed';
    await store.saveDrop(drop);
    send({ type: 'error', message: 'Drop을 만들지 못했어요.' });
    return;
  }

  const body = parseDropText(output.result.text);
  drop.body = isCompleteBody(body) ? body : undefined;
  drop.sources = output.result.sources.slice(0, 3);
  drop.evidence = output.result.evidence.slice(0, 20);
  drop.model = model;
  drop.status = 'ready';
  drop.verify = 'pending';
  drop.generatedAt = nowIso();
  await store.saveDrop(drop);
  send({ type: 'done', drop });

  const verified = await verifyDrop(user.id, drop.id);
  if (verified?.corrected) send({ type: 'corrected', drop: verified });
  if (verified?.status === 'failed') send({ type: 'error', message: '내용을 다시 확인하고 있어요.' });
}

export async function verifyDrop(userId: string, dropId: string): Promise<Drop | null> {
  const store = getStore();
  const drop = await store.getDrop(dropId);
  if (!drop?.body) return null;
  try {
    const m = await getGenerator().verify(formatDropText(drop.body), drop.evidence ?? []);
    await logUsage(userId, 'verify', m, 'realtime');
    const { verdict, fixedText } = m.result;
    drop.verify = verdict;
    if (verdict === 'fixed') {
      const fixed = parseDropText(fixedText);
      if (isCompleteBody(fixed)) {
        drop.body = fixed;
        drop.corrected = true;
      }
    }
    if (verdict === 'conflict') {
      // 근거와 충돌 → 발행 취소, 다음에 열 때 다시 생성
      drop.status = 'failed';
      drop.body = undefined;
    }
    await store.saveDrop(drop);
    return drop;
  } catch (error) {
    await logFailure(userId, 'verify', error);
    return null;
  }
}

/* ---------- 읽기·완료 ---------- */

export async function markRead(user: User, dropId: string) {
  const store = getStore();
  const drop = await store.getDrop(dropId);
  if (!drop || drop.userId !== user.id || drop.readAt) return;
  drop.readAt = nowIso();
  await store.saveDrop(drop);
  await track(user.id, 'drop_read', { dropId });
}

export async function completeDrop(user: User, dropId: string, signal: UnderstandingSignal) {
  const store = getStore();
  const drop = await store.getDrop(dropId);
  if (!drop || drop.userId !== user.id) throw new Error('not found');
  const doneBefore = (await store.listDropsByUser(user.id)).filter(d => d.completedAt && d.id !== dropId).length;
  const firstEver = doneBefore === 0;
  const already = Boolean(drop.completedAt);
  drop.signal = signal;
  drop.completedAt ??= nowIso();
  await store.saveDrop(drop);

  const course = (await store.getCourse(drop.courseId))!;
  course.lastReadAt = nowIso();
  if (!already) await track(user.id, 'drop_completed', { dropId, courseId: course.id, index: drop.index, signal });

  // 첫 Drop을 읽은 시각을 기본 알림 시각으로 (PRD §17.2)
  if (firstEver && !user.notifyTime) user.notifyTime = nextQuietSafeTime();

  const isLast = drop.index === course.outline.length - 1;
  let levelUp = false;
  if (isLast && course.status !== 'completed') {
    course.status = 'completed';
    course.completedAt = nowIso();
    await track(user.id, 'course_completed', { courseId: course.id });
    const before = stageOf(user).key;
    user.learned = [...(user.learned ?? []).filter(l => l.courseId !== course.id), {
      topic: course.topic,
      category: course.category,
      courseId: course.id,
      at: nowIso(),
    }];
    levelUp = stageOf(user).key !== before;
  }
  await store.saveCourse(course);

  // 내일 받을 코스: 이 코스가 끝났으면 다른 진행 중 코스. 전체 열린 코스는 하루 한 편과 따로라 건드리지 않는다
  if (!course.openedAllAt) {
    if (!isLast) user.tomorrowCourseId = course.id;
    else {
      const other = (await store.listCourses(user.id)).find(c => c.status === 'active' && c.id !== course.id && !c.openedAllAt);
      user.tomorrowCourseId = other?.id;
    }
  } else if (isLast && user.tomorrowCourseId === course.id) user.tomorrowCourseId = undefined;
  // 알림이 꺼져 있으면 Drop을 다 읽을 때 다시 묻는다 (3일에 한 번까지)
  const askNotify =
    !already &&
    user.notifyPermission !== 'granted' &&
    (!user.notifyAskedAt || Date.now() - Date.parse(user.notifyAskedAt) > NOTIFY_ASK_INTERVAL_DAYS * 86_400_000);
  if (askNotify) user.notifyAskedAt = nowIso();
  const askSignup = firstEver && user.anon;
  await store.saveUser(user);

  return {
    firstEver,
    courseCompleted: isLast,
    courseId: course.id,
    levelUp,
    askNotify,
    notifyDenied: user.notifyPermission === 'denied',
    askSignup,
    // 리뷰 요청: 몇 편째에서만, 다른 팝업이 없을 때 (iOS가 1년에 3번까지로 막는다)
    askReview: !already && !askNotify && !askSignup && REVIEW_AT_DROPS.includes(doneBefore + 1),
  };
}

function nextQuietSafeTime() {
  const hhmm = new Date(Date.now() + 9 * 3600_000).toISOString().slice(11, 16);
  // 21시~08시에는 보내지 않는다
  if (hhmm >= '21:00' || hhmm < '08:00') return '08:00';
  return hhmm;
}

export async function answerExplain(user: User, courseId: string, answer: ExplainAnswer) {
  const store = getStore();
  const course = await store.getCourse(courseId);
  if (!course || course.userId !== user.id) return;
  course.explainAnswer = answer;
  await store.saveCourse(course);
  await track(user.id, 'course_explain_answer', { courseId, answer });
}

export async function reportDrop(user: User, dropId: string) {
  const store = getStore();
  const drop = await store.getDrop(dropId);
  if (!drop || drop.userId !== user.id) return;
  drop.reportedAt = nowIso();
  await store.saveDrop(drop);
  await store.addReport({ id: newId(), userId: user.id, dropId, at: nowIso() });
  await track(user.id, 'drop_reported', { dropId });
}

/* ---------- 화면용 조회 ---------- */

export function isLearned(course: Course, drops: Drop[]) {
  const done = drops.filter(d => d.completedAt);
  if (course.outline.length === 0) return false;
  const ratio = done.length / course.outline.length;
  const understood = done.filter(d => d.signal === 'understood').length;
  return ratio >= LEARNED_COMPLETION_RATIO && understood > done.length / 2;
}

export async function weekLearningDays(userId: string) {
  const drops = await getStore().listDropsByUser(userId);
  const today = new Date(kstDate());
  // 이번 주 = 월요일부터 (KST)
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7));
  const days = new Set(drops.filter(d => d.completedAt).map(d => kstDate(d.completedAt!)));
  return [...days].filter(d => d >= monday.toISOString().slice(0, 10)).length;
}

/** 이번 주(월~일, KST) 요일별 학습 여부 */
export async function weekDone(userId: string): Promise<boolean[]> {
  const drops = await getStore().listDropsByUser(userId);
  const today = new Date(kstDate());
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7));
  const days = new Set(drops.filter(d => d.completedAt).map(d => kstDate(d.completedAt!)));
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + i);
    return days.has(d.toISOString().slice(0, 10));
  });
}

export interface TodayItem {
  course: Course;
  drop: Drop | null;
  readToday: boolean;
  nextTitle?: string;
}

export async function todayView(user: User): Promise<TodayItem[]> {
  const store = getStore();
  const courses = (await store.listCourses(user.id)).filter(c => c.status === 'active');
  const today = kstDate();
  const items: TodayItem[] = [];
  for (const course of courses) {
    const drops = await store.listDrops(course.id);
    const next = drops.find(d => !d.completedAt) ?? null;
    const readToday = drops.some(d => d.completedAt && kstDate(d.completedAt) === today);
    items.push({ course, drop: next, readToday, nextTitle: next?.title });
  }
  return items.sort((a, b) => (b.course.lastReadAt ?? b.course.createdAt).localeCompare(a.course.lastReadAt ?? a.course.createdAt));
}

/* ---------- 하루 한 편 ---------- */

/**
 * 오늘(KST) 완료한 Drop. 하루에 한 편만 열린다.
 * 전체 열린 코스에서 연 뒤 읽은 Drop은 하루 한 편에 세지 않는다
 */
export async function completedToday(userId: string): Promise<Drop | null> {
  const store = getStore();
  const today = kstDate();
  const openedAt = new Map((await store.listCourses(userId)).filter(c => c.openedAllAt).map(c => [c.id, c.openedAllAt!]));
  const drops = await store.listDropsByUser(userId);
  return (
    drops.find(d => {
      if (!d.completedAt || kstDate(d.completedAt) !== today) return false;
      const opened = openedAt.get(d.courseId);
      return !opened || d.completedAt < opened;
    }) ?? null
  );
}

/* ---------- 전체 열기 (Plus, 구독 한 달에 한 코스) ---------- */

/** 이번 구독 기간에 전체 열기를 쓸 수 있는지, 썼다면 다시 쓸 수 있는 날 (다음 결제일). 열린 코스는 해지 뒤에도 계속 읽는다 */
export function openAllStatus(user: User): { available: boolean; nextLabel?: string } {
  const period = plusPeriod(user);
  if (!period) return { available: false };
  if (!user.openAllAt || user.openAllAt < period.start) return { available: true };
  return { available: false, nextLabel: kstDayLabel(period.end) };
}

export async function openAllCourse(user: User, courseId: string) {
  const store = getStore();
  const course = await store.getCourse(courseId);
  if (!course || course.userId !== user.id || course.status !== 'active' || course.openedAllAt) return false;
  if (!openAllStatus(user).available) return false;
  course.openedAllAt = nowIso();
  user.openAllAt = course.openedAllAt;
  // 내일 받을 코스였다면 다른 진행 중 코스로 넘긴다 (전체 열린 코스는 따로 읽는다)
  if (user.tomorrowCourseId === course.id) {
    const other = (await store.listCourses(user.id)).find(c => c.status === 'active' && c.id !== course.id && !c.openedAllAt);
    user.tomorrowCourseId = other?.id;
  }
  await store.saveCourse(course);
  await store.saveUser(user);
  await track(user.id, 'course_opened_all', { courseId });
  return true;
}

export interface CourseNext {
  course: Course;
  next: Drop | null;
  doneCount: number;
}

export async function activeCourses(userId: string): Promise<CourseNext[]> {
  const store = getStore();
  const out: CourseNext[] = [];
  for (const course of await store.listCourses(userId)) {
    if (course.status !== 'active') continue;
    const drops = await store.listDrops(course.id);
    out.push({ course, next: drops.find(d => !d.completedAt) ?? null, doneCount: drops.filter(d => d.completedAt).length });
  }
  return out.sort((a, b) => (b.course.lastReadAt ?? b.course.createdAt).localeCompare(a.course.lastReadAt ?? a.course.createdAt));
}

/** 오늘 받을 코스: 오늘 고른 코스 → 어제 정해 둔 내일 코스 → 최근 코스 */
export function pickedCourseId(user: User, items: CourseNext[]): string | undefined {
  // 전체 열린 코스는 하루 한 편과 따로 읽는다
  const ids = items.filter(i => !i.course.openedAllAt).map(i => i.course.id);
  const today = kstDate();
  if (user.todayPick?.date === today && ids.includes(user.todayPick.courseId)) return user.todayPick.courseId;
  if (user.tomorrowCourseId && ids.includes(user.tomorrowCourseId)) return user.tomorrowCourseId;
  return ids[0];
}

export async function pickToday(user: User, courseId: string) {
  const store = getStore();
  const course = await store.getCourse(courseId);
  if (!course || course.userId !== user.id || course.status !== 'active') return false;
  if (await completedToday(user.id)) return false;
  user.todayPick = { date: kstDate(), courseId };
  await store.saveUser(user);
  await track(user.id, 'today_picked', { courseId });
  return true;
}

export async function pickTomorrow(user: User, courseId: string) {
  const course = await getStore().getCourse(courseId);
  if (!course || course.userId !== user.id || course.status !== 'active' || course.openedAllAt) return false;
  user.tomorrowCourseId = courseId;
  await getStore().saveUser(user);
  await track(user.id, 'tomorrow_picked', { courseId });
  return true;
}

/**
 * 이 Drop을 지금 열 수 있는지. 읽은 Drop은 언제든 다시 볼 수 있고,
 * 새 Drop은 하루 한 편 (오늘 고른 코스의 다음 Drop). 오늘 만든 코스의 첫 Drop은 바로 읽을 수 있다.
 */
export async function canOpenDrop(user: User, drop: Drop): Promise<boolean> {
  if (drop.completedAt) return true;
  const store = getStore();
  const course = await store.getCourse(drop.courseId);
  if (!course || course.status !== 'active') return false;
  if (course.openedAllAt) return true;
  const next = (await store.listDrops(course.id)).find(d => !d.completedAt);
  if (next?.id !== drop.id) return false;
  if (drop.index === 0 && kstDate(course.createdAt) === kstDate()) return true;
  if (await completedToday(user.id)) return false;
  const picked = pickedCourseId(user, await activeCourses(user.id));
  return picked === course.id;
}

/* ---------- 캐릭터 단계 ---------- */

export function stageOf(user: User) {
  const n = user.learned?.length ?? 0;
  let stage: (typeof STAGES)[number] = STAGES[0];
  for (const s of STAGES) if (n >= s.min) stage = s;
  const next = STAGES.find(s => s.min > n);
  return { key: stage.key, name: stage.name, learned: n, next: next ? { name: next.name, left: next.min - n, min: next.min } : null };
}

/* ---------- 조금 헷갈려요: 쉽게 다시 설명 ---------- */

export async function easyExplain(user: User, dropId: string): Promise<EasyBody | null> {
  const store = getStore();
  const drop = await store.getDrop(dropId);
  if (!drop || drop.userId !== user.id || !drop.body) return null;
  if (drop.easy) return drop.easy;
  const course = (await store.getCourse(drop.courseId))!;
  try {
    const m = await getGenerator().easy({ courseTitle: course.title, title: drop.title, text: formatDropText(drop.body) });
    await logUsage(user.id, 'easy', m, 'realtime');
    drop.easy = m.result;
    drop.signal = 'confused';
    await store.saveDrop(drop);
    await track(user.id, 'drop_easy', { dropId });
    return m.result;
  } catch (error) {
    await logFailure(user.id, 'easy', error);
    return null;
  }
}

/* ---------- Plus ---------- */

/** 인앱 결제 연동 전 베타: PLUS_BETA_FREE=true면 결제 없이 Plus를 켠다 */
export async function grantPlus(user: User) {
  if (process.env.PLUS_BETA_FREE !== 'true') return false;
  if (!user.plusSince) {
    user.plusSince = nowIso();
    await getStore().saveUser(user);
    await track(user.id, 'plus_started', { beta: true });
  }
  return true;
}

/** 로그인할 때 이 기기 임시 계정의 다 배운 기록도 계정으로 합친다 (코스·Drop은 store.moveUserData가 옮김) */
export async function mergeDeviceRecords(device: User, account: User) {
  // 가입 전에 이 기기에서 산 구독은 계정으로 옮긴다
  if (device.plusExpiresAt && (!account.plusExpiresAt || device.plusExpiresAt > account.plusExpiresAt)) {
    account.plusSince ??= device.plusSince;
    account.plusExpiresAt = device.plusExpiresAt;
    account.plusOriginalTxId = device.plusOriginalTxId;
    await getStore().saveUser(account);
  }
  if (!device.learned?.length) return;
  const seen = new Set((account.learned ?? []).map(l => l.courseId));
  account.learned = [...(account.learned ?? []), ...device.learned.filter(l => !seen.has(l.courseId))];
  await getStore().saveUser(account);
}
