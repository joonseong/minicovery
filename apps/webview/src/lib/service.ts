import { getGenerator } from './ai';
import { costUsd } from './ai/pricing';
import type { Metered } from './ai/types';
import {
  ANON_IP_DAILY_LIMIT,
  APPROVED_TOPIC_HOURS,
  APPROVED_TOPIC_MAX,
  DAILY_PREMIUM_REALTIME,
  FREE_COURSE_LIMIT,
  GENERATING_STALE_MIN,
  LEARNED_COMPLETION_RATIO,
  LOGIN_FAIL_WINDOW_MIN,
  NOTIFY_ASK_INTERVALS_DAYS,
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
  Report,
  TaskType,
  UnderstandingSignal,
  User,
  UsageLog,
} from './types';
import { allDropsDone, kstDate, newId, nextDrop, normalizeTopic, nowIso, plusPeriodAt, sha256 } from './util';

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

/* ---------- AI 비용 방어 ---------- */

export class AiBudgetError extends Error {
  constructor() {
    super('daily AI budget exceeded');
    this.name = 'AiBudgetError';
  }
}
export const AI_BUSY_MESSAGE = '지금은 이용자가 많아 잠시 뒤 다시 시도해 주세요.';

let budgetCache: { at: number; spentUsd: number } | null = null;

/** 지난 24시간 AI 비용이 DAILY_AI_BUDGET_USD(기본 50달러)를 넘으면 새 생성을 막는다. 저장소 조회는 60초에 한 번 */
export async function assertAiBudget() {
  const limit = Number(process.env.DAILY_AI_BUDGET_USD ?? 50);
  if (!budgetCache || Date.now() - budgetCache.at > 60_000) {
    const usage = await getStore().listUsage(new Date(Date.now() - 86_400_000).toISOString());
    budgetCache = { at: Date.now(), spentUsd: usage.reduce((s, u) => s + u.costUsd, 0) };
  }
  if (budgetCache.spentUsd >= limit) throw new AiBudgetError();
}

/* ---------- 주제 검사 ---------- */

export async function checkTopic(user: User, input: string) {
  const g = getGenerator();
  const m = await g.checkTopic(input);
  await logUsage(user.id, 'check', m, 'realtime');
  return m.result;
}

export type ApprovedTopic = NonNullable<User['approvedTopics']>[number];

const liveApprovedTopics = (user: User) => {
  const since = Date.now() - APPROVED_TOPIC_HOURS * 3600_000;
  return (user.approvedTopics ?? []).filter(e => Date.parse(e.at) > since);
};

/**
 * 주제 검사를 통과한 주제(와 넓은 주제를 좁힌 제안)를 24시간·최근 10개까지 기억한다.
 * 코스 만들기는 이 목록에 있는 주제만 받는다 — 검사를 건너뛴 직접 호출로 비용이 새지 않게
 */
export async function approveTopics(user: User, entries: Omit<ApprovedTopic, 'at'>[]) {
  const at = nowIso();
  const fresh = entries.map(e => ({ ...e, topic: normalizeTopic(e.topic), at }));
  const keys = new Set(fresh.map(e => e.topic));
  user.approvedTopics = [...fresh, ...liveApprovedTopics(user).filter(e => !keys.has(e.topic))].slice(0, APPROVED_TOPIC_MAX);
  await getStore().saveUser(user);
}

export const approvedTopic = (user: User, topic: string): ApprovedTopic | null =>
  liveApprovedTopics(user).find(e => e.topic === normalizeTopic(topic)) ?? null;

/** 익명 사용자가 같은 IP에서 하루에 너무 많은 계정으로 코스를 만들면 막는다. IP는 CRON_SECRET을 섞은 해시로만 남긴다 */
export async function anonCourseAllowed(user: User, ip: string | null | undefined): Promise<boolean> {
  if (!user.anon || !ip) return true;
  const store = getStore();
  const ipHash = sha256(`${process.env.CRON_SECRET ?? ''}${ip}`).slice(0, 32);
  if (user.ipHash !== ipHash) {
    user.ipHash = ipHash;
    await store.saveUser(user);
  }
  const count = await store.countAnonUsersByIpSince(ipHash, new Date(Date.now() - 86_400_000).toISOString());
  // count에는 이 사용자 자신도 들어 있으므로 N명째까지 허용
  if (count <= ANON_IP_DAILY_LIMIT) return true;
  await logFailure(user.id, 'anon_limit', `${count} anon users from one ip in 24h`);
  return false;
}

/** 같은 이메일(해시)로 최근 15분에 틀린 횟수 (무차별 대입 방어) */
export async function recentLoginFailures(emailHash: string) {
  const since = new Date(Date.now() - LOGIN_FAIL_WINDOW_MIN * 60_000).toISOString();
  return (await getStore().listEvents(since)).filter(e => e.name === 'login_failed' && e.props?.emailHash === emailHash).length;
}

/* ---------- 코스 ---------- */

/**
 * App Store 구독이 유효하거나(갱신 처리 지연을 감안해 만료 뒤 6시간은 봐준다), 결제 실패 유예 기간이거나,
 * 베타(PLUS_BETA_FREE) 동안 무료로 켠 경우
 */
export const isPlus = (user: User) =>
  (user.plusExpiresAt ? Date.parse(user.plusExpiresAt) + 6 * 3600_000 > Date.now() : false) ||
  (user.plusGraceUntil ? Date.parse(user.plusGraceUntil) > Date.now() : false) ||
  (process.env.PLUS_BETA_FREE === 'true' && Boolean(user.plusSince));

/**
 * free: 진행 중 코스 1개 → 지우고 바꿀 수 있음 / over: 진행 중 코스가 2개 이상 (Plus 해지 뒤) → 새 코스 불가
 * monthly: Plus 이번 기간 3개를 다 씀 / daily: 오늘 이미 바꿨거나(무료) 만들었음(Plus)
 */
export type Quota = { ok: true } | { ok: false; reason: 'free' | 'over' | 'monthly' | 'daily' };

/**
 * Plus 혜택을 세는 한 달: 구독(체험 포함) 시작일부터 한 달씩 (2026-10-27 대표 결정).
 * 체험 7일도 첫 한 달 안에 들어간다. 결제일과는 따로 돈다. 말일 시작이면 다음 달 말일 (util.plusPeriodAt)
 */
export function plusPeriod(user: User): { start: string; end: string } | null {
  if (!isPlus(user) || !user.plusSince) return null;
  return plusPeriodAt(user.plusSince, nowIso());
}

/** 'M월 D일' (KST) */
export const kstDayLabel = (iso: string) => {
  const [, m, d] = kstDate(iso).split('-').map(Number);
  return `${m}월 ${d}일`;
};

const isGoing = (c: Course) => (c.status === 'active' || c.status === 'generating') && !c.openedAllAt;

/** Plus 이번 기간에 만든 코스. 첫 기간에는 Plus를 켜기 전에 만들어 아직 진행 중인 코스도 센다 (2026-10-31 대표 결정 D2) */
function plusMadeCourses(user: User, courses: Course[], period: { start: string; end: string }) {
  const start = Date.parse(period.start);
  const firstPeriod = start === Date.parse(user.plusSince!);
  return courses.filter(c => c.status !== 'failed' && (Date.parse(c.createdAt) >= start || (firstPeriod && isGoing(c))));
}

/**
 * 무료: 진행 중인 코스 1개(다 배운 코스·전체 열린 코스는 세지 않음). 2개 이상이면(Plus 해지 뒤) 1개 이하가 될 때까지 새 코스 불가.
 * Plus: 구독 한 달에 새 코스 3개. 바꾸기(무료)·새 코스(Plus)는 하루 1번 (2026-10-27 대표 결정)
 */
export async function courseQuota(user: User): Promise<Quota> {
  const courses = (await getStore().listCourses(user.id)).filter(c => c.status !== 'failed');
  const today = kstDate();
  const period = plusPeriod(user);
  if (!period) {
    const going = courses.filter(isGoing);
    if (going.length > FREE_COURSE_LIMIT) return { ok: false, reason: 'over' };
    if (going.length < FREE_COURSE_LIMIT) return { ok: true };
    return courses.some(c => c.deletedAt && kstDate(c.deletedAt) === today) ? { ok: false, reason: 'daily' } : { ok: false, reason: 'free' };
  }
  const made = plusMadeCourses(user, courses, period);
  if (made.length >= PLUS_MONTHLY_COURSES) return { ok: false, reason: 'monthly' };
  return made.some(c => kstDate(c.createdAt) === today) ? { ok: false, reason: 'daily' } : { ok: true };
}

export interface PlusUsage {
  coursesLeft: number;
  openAllLeft: number;
  /** 다시 채워지는 날 'M월 D일' */
  resetLabel: string;
  /** 오늘 이미 새 코스를 만듦 (하루 1개) */
  madeToday: boolean;
}

/** Plus 남은 횟수 (프로필·설정·오늘 화면 표시용) */
export async function plusUsage(user: User): Promise<PlusUsage | null> {
  const period = plusPeriod(user);
  if (!period) return null;
  const made = plusMadeCourses(user, await getStore().listCourses(user.id), period);
  return {
    coursesLeft: Math.max(0, PLUS_MONTHLY_COURSES - made.length),
    openAllLeft: user.openAllAt && user.openAllAt >= period.start ? 0 : 1,
    resetLabel: kstDayLabel(period.end),
    madeToday: made.some(c => kstDate(c.createdAt) === kstDate()),
  };
}

/**
 * 무료 사용자가 새 주제로 바꿀 때: 진행 중인 코스와 Drop은 지우고, 다 배운 코스·전체 열린 코스와 기록(user.learned)은 남긴다.
 * Drop 본문도 비운다 (바꾸기 시트 문구 "읽은 Drop 본문이 지워져요")
 */
export async function deleteFreeCourses(user: User) {
  const store = getStore();
  for (const c of await store.listCourses(user.id)) {
    if (!isGoing(c)) continue;
    c.status = 'deleted';
    c.deletedAt = nowIso();
    await store.saveCourse(c);
    for (const d of await store.listDrops(c.id)) {
      if (!d.body && !d.easy && !d.evidence?.length && !d.sources.length) continue;
      await store.saveDrop({ ...d, body: undefined, easy: undefined, evidence: [], sources: [] });
    }
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
  try {
    await assertAiBudget();
  } catch {
    send({ type: 'error', message: AI_BUSY_MESSAGE });
    return;
  }
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
  // 새 코스는 바로 읽을 수 있게 오늘의 코스로 고른다. 임시 계정은 여기서 처음 저장될 수 있다
  if (!(await completedToday(user.id))) user.todayPick = { date: kstDate(), courseId: course.id };
  await store.saveUser(user);
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

const SKIPPED_MESSAGE = '이 내용은 다룰 수 없어 건너뛰었어요. 다음 Drop으로 이어 가요.';
const CONFLICT_MESSAGE = '근거와 맞지 않는 부분이 있어 다시 쓰고 있어요. 잠시 뒤 다시 열어 주세요.';

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** 배치로 생성 중이거나 실시간 생성이 6분 넘게 멈춰 있으면(옛 데이터로 시각이 없어도) 다른 요청이 넘겨받는다 */
const isStaleGenerating = (drop: Drop) =>
  drop.mode === 'batch' || !drop.generatingAt || Date.now() - Date.parse(drop.generatingAt) > GENERATING_STALE_MIN * 60_000;

/** 같은 코스에서 다음에 열 수 있는 Drop id (건너뛴 뒤 안내용) */
async function nextOpenableDropId(user: User, courseId: string) {
  const next = nextDrop(await getStore().listDrops(courseId));
  return next && (await canOpenDrop(user, next)) ? next.id : undefined;
}

async function sendSkipped(user: User, drop: Drop, send: (e: StreamEvent) => void) {
  send({ type: 'skipped', message: SKIPPED_MESSAGE, nextDropId: await nextOpenableDropId(user, drop.courseId) });
}

/**
 * 이 요청이 생성을 맡는다. pending·failed는 generating으로, 멈춘 generating은 실시간으로 넘겨받는다 (store.claimDrop으로 원자화).
 * 다른 요청이 먼저 잡았거나 아직 신선한 실시간 생성이면 null
 */
async function claimGeneration(drop: Drop, mode: GenerationMode): Promise<Drop | null> {
  const store = getStore();
  if (drop.status === 'pending' || drop.status === 'failed') {
    return store.claimDrop(drop.id, ['pending', 'failed'], { status: 'generating', mode, generatingAt: nowIso() });
  }
  if (drop.status === 'generating' && isStaleGenerating(drop)) {
    return store.claimDrop(drop.id, ['generating'], { mode: 'realtime', generatingAt: nowIso(), batchId: undefined });
  }
  return null;
}

/** 다른 요청이 만들고 있는 Drop을 최대 120초 기다린다. 끝나지 않아도 마지막 상태를 돌려준다 */
async function waitForGeneration(dropId: string, send: (e: StreamEvent) => void): Promise<Drop> {
  const store = getStore();
  send({ type: 'status', message: '거의 다 됐어요' });
  let drop = (await store.getDrop(dropId))!;
  for (let i = 0; i < 120 && drop.status === 'generating'; i++) {
    await sleep(1000);
    drop = (await store.getDrop(dropId))!;
  }
  return drop;
}

/**
 * 실시간 생성(스트리밍). 상태 머신:
 * ready → 바로 보냄 / skipped → 건너뜀 안내 / pending·failed → 이 요청이 생성 /
 * generating(신선한 실시간) → 기다렸다가 결과, 끝나지 않으면 넘겨받기 / generating(배치·6분 넘음) → 바로 넘겨받아 생성.
 * done 이후에도 연결을 유지한 채 사실 검증을 돌려, 고친 경우 corrected를, 충돌이면 conflict를 보낸다 (PRD §14.3).
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
  if (drop.status === 'skipped') {
    await sendSkipped(user, drop, send);
    return;
  }

  let claimed = await claimGeneration(drop, mode);
  if (!claimed) {
    drop = await waitForGeneration(dropId, send);
    if (drop.status === 'ready') {
      send({ type: 'ready', drop });
      return;
    }
    if (drop.status === 'skipped') {
      await sendSkipped(user, drop, send);
      return;
    }
    // 기다려도 generating이면 멈춘 것으로 보고 넘겨받는다. failed·pending이면 새로 잡는다
    claimed =
      drop.status === 'generating'
        ? await store.claimDrop(drop.id, ['generating'], { mode: 'realtime', generatingAt: nowIso(), batchId: undefined })
        : await claimGeneration(drop, mode);
    if (!claimed) {
      send({ type: 'error', message: 'Drop을 만들지 못했어요.' });
      return;
    }
  }
  drop = claimed;

  try {
    await assertAiBudget();
  } catch {
    // 잡았던 Drop은 돌려놓는다 (다음에 열 때 다시 생성)
    await store.saveDrop({ ...drop, status: 'pending', generatingAt: undefined });
    send({ type: 'error', message: AI_BUSY_MESSAGE });
    return;
  }

  const course = (await store.getCourse(drop.courseId))!;
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
        // 모델이 거절한 내용은 다시 만들지 않고 건너뛴다. 하루 한 편·완주 계산에서 빠진다
        drop.status = 'skipped';
        drop.skipReason = 'refused';
        drop.body = undefined;
        drop.generatingAt = undefined;
        await store.saveDrop(drop);
        await track(user.id, 'drop_skipped', { dropId: drop.id, courseId: course.id, reason: 'refused' });
        await completeCourseIfDone(user, course);
        await sendSkipped(user, drop, send);
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
    drop.generatingAt = undefined;
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
  drop.generatingAt = undefined;
  await store.saveDrop(drop);
  send({ type: 'done', drop });

  const verified = await verifyDrop(user.id, drop.id);
  if (verified?.corrected) send({ type: 'corrected', drop: verified });
  if (verified?.status === 'failed') send({ type: 'conflict', message: CONFLICT_MESSAGE });
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

/** 다음 재질문까지의 간격: '나중에'·거절 0회 3일, 1회 7일, 2회부터 30일 (D3) */
const notifyAskIntervalMs = (user: User) =>
  NOTIFY_ASK_INTERVALS_DAYS[Math.min(user.notifyDeclines ?? 0, NOTIFY_ASK_INTERVALS_DAYS.length - 1)]! * 86_400_000;

/** 코스 완료 처리: 상태·다 배운 기록(user.learned)·단계. 올랐으면 pendingLevelUp에 남겨 /levelup이 한 번 보여 준다. 저장은 호출한 쪽이 */
async function completeCourse(user: User, course: Course): Promise<boolean> {
  course.status = 'completed';
  course.completedAt = nowIso();
  await track(user.id, 'course_completed', { courseId: course.id });
  const before = stageOf(user).key;
  user.learned = [
    ...(user.learned ?? []).filter(l => l.courseId !== course.id),
    { topic: course.topic, category: course.category, courseId: course.id, at: nowIso() },
  ];
  const levelUp = stageOf(user).key !== before;
  if (levelUp) user.pendingLevelUp = stageOf(user).key;
  return levelUp;
}

/** 건너뛴 Drop으로 모든 Drop이 끝났으면 코스를 완료한다 (더 누를 완료 버튼이 없으므로 여기서). 읽은 Drop이 하나도 없으면 두지 않는다 */
async function completeCourseIfDone(user: User, course: Course) {
  const store = getStore();
  const drops = await store.listDrops(course.id);
  if (course.status !== 'active' || !allDropsDone(drops) || !drops.some(d => d.completedAt)) return;
  await completeCourse(user, course);
  await store.saveCourse(course);
  if (user.tomorrowCourseId === course.id) {
    const other = (await store.listCourses(user.id)).find(c => c.status === 'active' && c.id !== course.id && !c.openedAllAt);
    user.tomorrowCourseId = other?.id;
  }
  await store.saveUser(user);
}

export interface CompleteResult {
  firstEver: boolean;
  courseCompleted: boolean;
  courseId: string;
  levelUp: boolean;
  askNotify: boolean;
  notifyDenied: boolean;
  askSignup: boolean;
  askReview: boolean;
}

/**
 * Drop 완료. 내 Drop이 아니면 null(404), 아직 열 수 없는 Drop이면 locked(409). 이미 완료한 Drop은 그대로 결과만 돌려준다.
 * 코스는 모든 Drop이 완료 또는 건너뜀일 때 끝난다 (전체 열기에서 마지막 편을 먼저 읽어도 끝나지 않게)
 */
export async function completeDrop(user: User, dropId: string, signal: UnderstandingSignal): Promise<CompleteResult | { error: 'locked' } | null> {
  const store = getStore();
  const drop = await store.getDrop(dropId);
  if (!drop || drop.userId !== user.id) return null;
  const already = Boolean(drop.completedAt);
  if (!already && (drop.status !== 'ready' || !(await canOpenDrop(user, drop)))) return { error: 'locked' };
  const doneBefore = (await store.listDropsByUser(user.id)).filter(d => d.completedAt && d.id !== dropId).length;
  const firstEver = doneBefore === 0;
  drop.signal = signal;
  drop.completedAt ??= nowIso();
  await store.saveDrop(drop);

  const course = (await store.getCourse(drop.courseId))!;
  course.lastReadAt = nowIso();
  if (!already) await track(user.id, 'drop_completed', { dropId, courseId: course.id, index: drop.index, signal });

  // 첫 Drop을 읽은 시각을 기본 알림 시각으로 (PRD §17.2)
  if (firstEver && !user.notifyTime) user.notifyTime = nextQuietSafeTime();

  const finished = allDropsDone(await store.listDrops(course.id));
  let levelUp = false;
  if (finished && course.status !== 'completed') levelUp = await completeCourse(user, course);
  await store.saveCourse(course);

  // 내일 받을 코스: 이 코스가 끝났으면 다른 진행 중 코스. 전체 열린 코스는 하루 한 편과 따로라 건드리지 않는다
  if (!course.openedAllAt) {
    if (!finished) user.tomorrowCourseId = course.id;
    else {
      const other = (await store.listCourses(user.id)).find(c => c.status === 'active' && c.id !== course.id && !c.openedAllAt);
      user.tomorrowCourseId = other?.id;
    }
  } else if (finished && user.tomorrowCourseId === course.id) user.tomorrowCourseId = undefined;
  // 알림이 꺼져 있으면 Drop을 다 읽을 때 다시 묻는다. '다시 묻지 않기'면 묻지 않는다 (D3)
  const askNotify =
    !already &&
    user.notifyPermission !== 'granted' &&
    !user.notifyNever &&
    (!user.notifyAskedAt || Date.now() - Date.parse(user.notifyAskedAt) > notifyAskIntervalMs(user));
  if (askNotify) user.notifyAskedAt = nowIso();
  // 첫 Drop을 마친 임시 계정에는 알림 시트 다음에 가입 시트도 띄운다 (2026-11-01 대표 결정)
  const askSignup = firstEver && user.anon;
  await store.saveUser(user);

  return {
    firstEver,
    courseCompleted: finished,
    courseId: course.id,
    levelUp,
    askNotify,
    notifyDenied: user.notifyPermission === 'denied',
    askSignup,
    // 리뷰 요청: 몇 편째에서만, 다른 팝업이 없을 때 (iOS가 1년에 3번까지로 막는다)
    askReview: !already && !askNotify && !askSignup && REVIEW_AT_DROPS.includes(doneBefore + 1),
  };
}

/** /levelup 화면이 호출: 아직 보여 주지 않은 단계 상승이 있으면 지우고 그 단계를 돌려준다 (한 번만) */
export async function consumeLevelUp(user: User): Promise<{ stage: (typeof STAGES)[number] } | null> {
  if (!user.pendingLevelUp) return null;
  const stage = STAGES.find(s => s.key === user.pendingLevelUp);
  user.pendingLevelUp = undefined;
  await getStore().saveUser(user);
  return stage ? { stage } : null;
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

/** 오류 신고. 같은 Drop을 두 번 신고하면 한 번만 남긴다 */
export async function reportDrop(user: User, dropId: string, reason?: Report['reason']) {
  const store = getStore();
  const drop = await store.getDrop(dropId);
  if (!drop || drop.userId !== user.id) return false;
  if (drop.reportedAt) return true;
  drop.reportedAt = nowIso();
  await store.saveDrop(drop);
  await store.addReport({ id: newId(), userId: user.id, dropId, at: nowIso(), reason });
  await track(user.id, 'drop_reported', { dropId, reason });
  return true;
}

/* ---------- 화면용 조회 ---------- */

export function isLearned(course: Course, drops: Drop[]) {
  const done = drops.filter(d => d.completedAt);
  // 건너뛴 Drop은 분모에서 뺀다
  const total = drops.filter(d => d.status !== 'skipped').length || course.outline.length;
  if (total === 0) return false;
  const ratio = done.length / total;
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
/** 이번 주(월~오늘, KST)에 완료한 Drop 수. 전체 열기로 하루에 여러 편 읽은 주에는 학습일 수보다 크다 */
export async function weekDropCount(userId: string): Promise<number> {
  const drops = await getStore().listDropsByUser(userId);
  const today = new Date(kstDate());
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() - ((today.getUTCDay() + 6) % 7));
  const from = monday.toISOString().slice(0, 10);
  return drops.filter(d => d.completedAt && kstDate(d.completedAt) >= from).length;
}

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
    const next = nextDrop(drops) ?? null;
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
    out.push({ course, next: nextDrop(drops) ?? null, doneCount: drops.filter(d => d.completedAt).length });
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
 * 이 Drop을 지금 열 수 있는지. 읽은 Drop은 언제든 다시 볼 수 있고, 건너뛴 Drop은 열 수 없다.
 * 새 Drop은 하루 한 편 (오늘 고른 코스의 다음 Drop). 오늘 만든 코스의 첫 Drop은 바로 읽을 수 있다 (D1)
 */
export async function canOpenDrop(user: User, drop: Drop): Promise<boolean> {
  if (drop.completedAt) return true;
  if (drop.status === 'skipped') return false;
  const store = getStore();
  const course = await store.getCourse(drop.courseId);
  if (!course || course.status !== 'active') return false;
  if (course.openedAllAt) return true;
  const drops = await store.listDrops(course.id);
  if (nextDrop(drops)?.id !== drop.id) return false;
  // 첫 Drop이 건너뛰어졌으면 그다음 Drop이 첫 Drop이다
  if (drops.find(d => d.status !== 'skipped')?.id === drop.id && kstDate(course.createdAt) === kstDate()) return true;
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

/**
 * 로그인할 때 이 기기 임시 계정의 기록을 계정으로 합친다: 코스·Drop(store.moveUserData), 다 배운 기록, 가입 전에 이 기기에서 산 구독.
 * 기기에 진행 중 코스가 있었고 계정에도 코스가 있었으면 홈에서 한 번 알린다 (mergeNotice)
 */
export async function mergeDeviceIntoAccount(device: User, account: User) {
  const store = getStore();
  const deviceGoing = (await store.listCourses(device.id)).filter(c => c.status === 'active' || c.status === 'generating');
  const accountHad = (await store.listCourses(account.id)).some(c => c.status === 'active' || c.status === 'completed');
  await store.moveUserData(device.id, account.id);

  // 가입 전에 이 기기에서 산 구독은 계정으로 옮기고, 기기 쪽은 비운다 (한 거래가 두 계정에 남지 않게)
  if (device.plusExpiresAt && (!account.plusExpiresAt || device.plusExpiresAt > account.plusExpiresAt)) {
    account.plusSince ??= device.plusSince;
    account.plusExpiresAt = device.plusExpiresAt;
    account.plusOriginalTxId = device.plusOriginalTxId;
    account.plusEnv = device.plusEnv;
    account.plusAutoRenew = device.plusAutoRenew;
    account.plusGraceUntil = device.plusGraceUntil;
  }
  if (device.plusSince || device.plusExpiresAt || device.plusOriginalTxId) {
    device.plusSince = device.plusExpiresAt = device.plusOriginalTxId = device.plusGraceUntil = undefined;
    device.plusEnv = device.plusAutoRenew = undefined;
    await store.saveUser(device);
  }

  if (device.learned?.length) {
    const seen = new Set((account.learned ?? []).map(l => l.courseId));
    account.learned = [...(account.learned ?? []), ...device.learned.filter(l => !seen.has(l.courseId))];
  }
  if (deviceGoing.length && accountHad) account.mergeNotice = { topics: deviceGoing.map(c => c.topic), at: nowIso() };
  await store.saveUser(account);
}
