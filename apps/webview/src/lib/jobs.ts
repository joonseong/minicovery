import { getGenerator } from './ai';
import { costUsd } from './ai/pricing';
import type { BatchPoll } from './ai/types';
import { QUIET_HOURS } from './constants';
import { isCompleteBody, parseDropText } from './drop-format';
import { sendPush } from './push';
import { completedToday, track, verifyDrop } from './service';
import { getStore } from './store';
import type { Course, Drop, User } from './types';
import { kstDate, kstTime, newId, nowIso } from './util';

/** 7일 넘게 안 읽은 코스는 야간 생성을 멈춘다 (읽히지 않을 Drop 비용 방지) */
const INACTIVE_DAYS = 7;
/** Batch generating이 이 시간 넘게 머물면 멈춘 것으로 보고 다시 제출한다 (Batch API는 24시간 안에 끝난다) */
const BATCH_STALE_MS = 20 * 3600_000;
/** 21:00 직후 호출(스케줄러 지연 몇 분)은 20:50~21:00 사이 알림 시각을 마저 보낸다 */
const QUIET_START_GRACE_MIN = 5;

type BatchResult = Extract<BatchPoll, { status: 'ended' }>['results'][number];

/** 동시 실행 개수를 제한한다 (간단한 세마포어). 끝난 작업이 기다리는 작업에 자리를 넘긴다 */
function limiter(limit: number) {
  let active = 0;
  const waiting: (() => void)[] = [];
  return async <T>(task: () => Promise<T>): Promise<T> => {
    if (active >= limit) await new Promise<void>(resolve => waiting.push(resolve));
    else active++;
    try {
      return await task();
    } finally {
      const next = waiting.shift();
      if (next) next();
      else active--;
    }
  };
}

/** 코스의 다음 Drop: 아직 안 끝났고 건너뛴(skipped) 것이 아닌 첫 Drop */
const nextDrop = (drops: Drop[]) => drops.find(d => !d.completedAt && d.status !== 'skipped');

/** 사용자가 받을 코스: 고른 내일 코스, 없으면 가장 최근에 읽은 코스 */
function pickCourse(user: User | null, list: Course[]) {
  return (
    list.find(c => c.id === user?.tomorrowCourseId) ??
    [...list].sort((a, b) => (b.lastReadAt ?? b.createdAt).localeCompare(a.lastReadAt ?? a.createdAt))[0]!
  );
}

/**
 * 야간 Batch (PRD §16.2 ⑥): 진행 중인 코스마다 다음 Drop이 준비돼 있지 않으면 Batch로 생성한다.
 * 매일 밤 1회 호출.
 */
export async function submitNightlyBatch() {
  const store = getStore();
  const g = getGenerator();
  const courses = await store.listActiveCourses();
  const cutoff = Date.now() - INACTIVE_DAYS * 86_400_000;
  const staleBefore = Date.now() - BATCH_STALE_MS;

  // 하루 한 편: 사용자마다 내일 받을 코스 하나의 다음 Drop만 만든다
  const byUser = new Map<string, Course[]>();
  for (const course of courses) {
    if (course.openedAllAt) continue;
    if (Date.parse(course.lastReadAt ?? course.createdAt) < cutoff) continue;
    byUser.set(course.userId, [...(byUser.get(course.userId) ?? []), course]);
  }

  const run = limiter(10);
  const picked = await Promise.allSettled(
    [...byUser].map(([userId, list]) =>
      run(async () => {
        const [user, allDrops] = await Promise.all([store.getUser(userId), store.listDropsByUser(userId)]);
        const course = pickCourse(user, list);
        const drops = allDrops.filter(d => d.courseId === course.id).sort((a, b) => a.index - b.index);
        const next = nextDrop(drops);
        if (!next || next.status === 'ready') return null;
        // 생성 중이어도 20시간 넘게 머물렀으면(시각이 없어도) 멈춘 것으로 보고 다시 제출한다
        if (next.status === 'generating' && next.generatingAt && Date.parse(next.generatingAt) > staleBefore) return null;
        return { course, drop: next, learned: drops.filter(d => d.completedAt).map(d => d.title) };
      }),
    ),
  );
  for (const p of picked) if (p.status === 'rejected') console.error('[nightly]', p.reason);
  const due = picked.flatMap(p => (p.status === 'fulfilled' && p.value ? [p.value] : []));
  if (due.length === 0) return { submitted: 0 };

  const batchId = await g.submitBatch(
    due.map(({ course, drop, learned }) => ({
      customId: drop.id,
      params: {
        courseTitle: course.title,
        level: course.level,
        outline: course.outline.map(o => o.title),
        index: drop.index,
        learnedTitles: learned,
        model: 'opus',
      },
    })),
  );
  const generatingAt = nowIso();
  let claimed = 0;
  for (const { drop } of due) {
    // 그 사이 실시간으로 완성된 Drop(ready)은 건드리지 않는다. 그 Batch 결과는 수거 때 버려진다
    const patch: Partial<Drop> = { status: 'generating', mode: 'batch', batchId, generatingAt };
    if (await store.claimDrop(drop.id, ['pending', 'failed', 'generating'], patch)) claimed++;
  }
  return { submitted: due.length, claimed, batchId };
}

/**
 * Batch 결과 하나를 Drop에 반영한다. 비용은 결과를 쓰든 버리든 남긴다.
 * batchId가 이 batch를 가리키는 Drop만 다루고 반영하면서 batchId를 푼다 → 이미 수거한 건 건너뛰므로
 * 한 호출이 중간에 끊겨도 다음 호출이 이어받고, 두 호출이 겹쳐도 한 번만 반영된다
 */
async function collectResult(batchId: string, r: BatchResult): Promise<'saved' | 'failed' | 'discarded' | 'skipped'> {
  const store = getStore();
  const drop = await store.getDrop(r.customId);
  if (!drop || drop.batchId !== batchId) return 'skipped';
  const course = await store.getCourse(drop.courseId);
  // 그 사이 실시간으로 받았거나 코스를 지웠으면 결과는 버린다
  const usable = drop.status !== 'ready' && !drop.completedAt && course?.status === 'active';
  const output = r.output;
  const body = output ? parseDropText(output.result.text) : {};

  let outcome: 'saved' | 'failed' | 'discarded';
  let patch: Partial<Drop>;
  if (!usable) {
    outcome = 'discarded';
    patch = drop.status === 'generating' ? { status: 'pending', generatingAt: undefined } : {};
  } else if (!output || !isCompleteBody(body) || output.result.sources.length === 0) {
    // 실패하면 pending으로 되돌려 사용자가 열 때 실시간 생성한다
    outcome = 'failed';
    patch = { status: 'pending', generatingAt: undefined };
  } else {
    outcome = 'saved';
    patch = {
      body,
      sources: output.result.sources.slice(0, 3),
      evidence: output.result.evidence.slice(0, 20),
      model: 'opus',
      mode: 'batch',
      status: 'ready',
      verify: 'pending',
      generatedAt: nowIso(),
      generatingAt: undefined,
    };
  }

  // 상태가 읽었을 때 그대로일 때만 덮어쓴다 (다른 수거 호출·실시간 생성과 경합). 못 가져오면 다음 호출이 다시 본다
  const claimed = await store.claimDrop(drop.id, [drop.status], { ...patch, batchId: undefined });
  if (!claimed) return 'skipped';

  if (output) {
    await store.addUsage({
      id: newId(),
      userId: drop.userId,
      at: nowIso(),
      purpose: 'drop',
      model: 'opus',
      mode: 'batch',
      inputTokens: output.usage.inputTokens,
      outputTokens: output.usage.outputTokens,
      cacheReadTokens: output.usage.cacheReadTokens,
      searches: output.usage.searches,
      costUsd: costUsd('opus', output.usage, true),
    });
  }
  if (outcome === 'failed') {
    const message = r.error ?? (output ? 'incomplete' : 'no output');
    await store.addFailure({ id: newId(), userId: drop.userId, at: nowIso(), stage: 'batch', message });
  }
  if (outcome === 'saved') await verifyDrop(drop.userId, drop.id);
  return outcome;
}

/** Batch 결과 수거. 끝난 batch의 Drop을 저장하고 검증한다. 10분마다 호출 (겹쳐 돌아도 안전) */
export async function collectBatches() {
  const store = getStore();
  const g = getGenerator();
  const users = await store.listUsers();
  const run = limiter(10);
  const perUser = await Promise.allSettled(users.map(u => run(() => store.listDropsByUser(u.id))));
  const pending = perUser.flatMap(p => (p.status === 'fulfilled' ? p.value : [])).filter(d => d.status === 'generating' && d.batchId);
  const batchIds = [...new Set(pending.map(d => d.batchId!))];
  const stats = { batches: batchIds.length, ended: 0, saved: 0, failed: 0, discarded: 0, skipped: 0, errors: 0 };

  for (const batchId of batchIds) {
    const poll = await g.pollBatch(batchId);
    if (poll.status !== 'ended') continue;
    stats.ended++;
    // 검증(verifyDrop)이 오래 걸리므로 결과 5개씩 병렬로 처리한다
    const verify = limiter(5);
    const results = await Promise.allSettled(poll.results.map(r => verify(() => collectResult(batchId, r))));
    for (const r of results) {
      if (r.status === 'fulfilled') stats[r.value]++;
      else {
        stats.errors++;
        console.error('[collect]', r.reason);
      }
    }
  }
  return stats;
}

/** 조용한 시간(21:00~08:00)인지 */
const inQuietHours = (hhmm: string) => hhmm >= QUIET_HOURS.start || hhmm < QUIET_HOURS.end;
const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

/**
 * 알림 발송 (PRD §17.2). 10분마다 호출된다. 알림 시각(KST)이 지났고 오늘(KST) 아직 안 보낸 사용자에게 보낸다.
 * 다음 Drop이 준비되지 않았으면 보내지 않는다 (실시간 생성은 비용 때문에 하지 않는다).
 */
export async function sendDueNotifications() {
  const store = getStore();
  const now = new Date();
  const hhmm = kstTime(now);
  const today = kstDate(now);
  const stats = { sent: 0, failed: 0, skippedQuiet: 0, skippedNoToken: 0, skippedNotReady: 0, invalidTokens: 0, quiet: false };
  // 21:00 정각 호출은 20:50~21:00 사이 알림 시각을 마저 보내고, 그 뒤 08:00까지는 보내지 않는다
  const justAfterQuietStart = hhmm >= QUIET_HOURS.start && toMinutes(hhmm) - toMinutes(QUIET_HOURS.start) < QUIET_START_GRACE_MIN;
  if (inQuietHours(hhmm) && !justAfterQuietStart) return { ...stats, quiet: true };

  // 오늘(KST) 이미 보낸 사용자 — 루프 밖에서 한 번만 조회
  const todayStart = new Date(`${today}T00:00:00+09:00`).toISOString();
  const sentToday = new Set((await store.listEventsByName('push_sent', todayStart)).map(e => e.userId));

  const run = limiter(5);
  const results = await Promise.allSettled(
    (await store.listUsers()).map(user =>
      run(async () => {
        if (user.notifyPermission !== 'granted' || !user.notifyTime) return;
        if (user.notifyTime > hhmm || sentToday.has(user.id)) return;
        if (inQuietHours(user.notifyTime)) {
          stats.skippedQuiet++;
          return;
        }
        if (!user.pushToken) {
          stats.skippedNoToken++;
          return;
        }
        if (await completedToday(user.id)) return;

        // 오늘 받기로 한 코스(어제 고른 내일 코스)의 다음 Drop
        const courses = (await store.listCourses(user.id))
          .filter(c => c.status === 'active' && !c.openedAllAt)
          .sort((a, b) => (b.lastReadAt ?? '').localeCompare(a.lastReadAt ?? ''));
        const course = courses.find(c => c.id === user.tomorrowCourseId) ?? courses[0];
        if (!course) return;
        const next = nextDrop(await store.listDrops(course.id));
        if (!next || next.status !== 'ready' || !next.body) {
          await track(user.id, 'push_skipped', { reason: 'drop_not_ready', dropId: next?.id });
          stats.skippedNotReady++;
          return;
        }

        const result = await sendPush(user.pushToken, {
          title: `${course.title} #${String(next.index + 1).padStart(2, '0')}`,
          body: (next.body.hook.split('\n')[0] ?? '').slice(0, 80),
          data: { path: `/drop/${next.id}` },
        });
        await track(user.id, result.ok ? 'push_sent' : 'push_failed', { dropId: next.id, error: result.error });
        if (result.ok) stats.sent++;
        else stats.failed++;
        if (result.invalidToken) {
          // 앱 삭제·재설치로 죽은 토큰은 지워 다음부터 보내지 않는다 (앱이 다시 등록하면 새 토큰이 들어온다)
          user.pushToken = undefined;
          await store.saveUser(user);
          stats.invalidTokens++;
        }
      }),
    ),
  );
  for (const r of results) if (r.status === 'rejected') console.error('[notify]', r.reason);
  return stats;
}

/** 운영자 확인용: 한 사용자에게 시험 알림을 보낸다 (조용한 시간과 상관없이) */
export async function sendTestPush(userId: string | null) {
  const user = userId ? await getStore().getUser(userId) : null;
  if (!user?.pushToken) return { ok: false, error: 'no push token' };
  return sendPush(user.pushToken, {
    title: '미니커버리 알림 테스트',
    body: '알림이 잘 도착했어요. 내일 아침 Drop도 이렇게 알려 드릴게요.',
    data: { path: '/today' },
  });
}
