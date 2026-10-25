import { getGenerator } from './ai';
import { costUsd } from './ai/pricing';
import { QUIET_HOURS } from './constants';
import { isCompleteBody, parseDropText } from './drop-format';
import { sendPush } from './push';
import { completedToday, track, verifyDrop } from './service';
import { getStore } from './store';
import type { Course, Drop } from './types';
import { kstDate, kstTime, newId, nowIso } from './util';

/** 7일 넘게 안 읽은 코스는 야간 생성을 멈춘다 (읽히지 않을 Drop 비용 방지) */
const INACTIVE_DAYS = 7;

/**
 * 야간 Batch (PRD §16.2 ⑥): 진행 중인 코스마다 다음 Drop이 준비돼 있지 않으면 Batch로 생성한다.
 * 매일 밤 1회 호출.
 */
export async function submitNightlyBatch() {
  const store = getStore();
  const g = getGenerator();
  const courses = await store.listActiveCourses();
  const cutoff = Date.now() - INACTIVE_DAYS * 86_400_000;
  const due: { course: Course; drop: Drop; learned: string[] }[] = [];

  // 하루 한 편: 사용자마다 내일 받을 코스 하나의 다음 Drop만 만든다
  const byUser = new Map<string, Course[]>();
  for (const course of courses) {
    if (course.openedAllAt) continue;
    if (Date.parse(course.lastReadAt ?? course.createdAt) < cutoff) continue;
    byUser.set(course.userId, [...(byUser.get(course.userId) ?? []), course]);
  }
  for (const [userId, list] of byUser) {
    const user = await store.getUser(userId);
    const course =
      list.find(c => c.id === user?.tomorrowCourseId) ??
      [...list].sort((a, b) => (b.lastReadAt ?? b.createdAt).localeCompare(a.lastReadAt ?? a.createdAt))[0]!;
    const drops = await store.listDrops(course.id);
    const next = drops.find(d => !d.completedAt);
    if (!next || next.status === 'ready' || next.status === 'generating') continue;
    due.push({ course, drop: next, learned: drops.filter(d => d.completedAt).map(d => d.title) });
  }
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
  for (const { drop } of due) {
    await store.saveDrop({ ...drop, status: 'generating', mode: 'batch', batchId });
  }
  return { submitted: due.length, batchId };
}

/** Batch 결과 수거. 끝난 batch의 Drop을 저장하고 검증한다. 주기적으로 호출. */
export async function collectBatches() {
  const store = getStore();
  const g = getGenerator();
  const users = await store.listUsers();
  const pending: Drop[] = [];
  for (const u of users) {
    pending.push(...(await store.listDropsByUser(u.id)).filter(d => d.status === 'generating' && d.batchId));
  }
  const batchIds = [...new Set(pending.map(d => d.batchId!))];
  let saved = 0;

  for (const batchId of batchIds) {
    const poll = await g.pollBatch(batchId);
    if (poll.status !== 'ended') continue;
    for (const r of poll.results) {
      const drop = await store.getDrop(r.customId);
      if (!drop) continue;
      const body = r.output ? parseDropText(r.output.result.text) : {};
      if (!r.output || !isCompleteBody(body) || r.output.result.sources.length === 0) {
        // 실패하면 pending으로 되돌려 사용자가 열 때 실시간 생성한다
        await store.saveDrop({ ...drop, status: 'pending', batchId: undefined });
        await store.addFailure({ id: newId(), userId: drop.userId, at: nowIso(), stage: 'batch', message: r.error ?? 'incomplete' });
        continue;
      }
      const m = r.output;
      await store.addUsage({
        id: newId(),
        userId: drop.userId,
        at: nowIso(),
        purpose: 'drop',
        model: 'opus',
        mode: 'batch',
        inputTokens: m.usage.inputTokens,
        outputTokens: m.usage.outputTokens,
        cacheReadTokens: m.usage.cacheReadTokens,
        searches: m.usage.searches,
        costUsd: costUsd('opus', m.usage, true),
      });
      await store.saveDrop({
        ...drop,
        body,
        sources: m.result.sources.slice(0, 3),
        evidence: m.result.evidence.slice(0, 20),
        model: 'opus',
        status: 'ready',
        verify: 'pending',
        generatedAt: nowIso(),
        batchId: undefined,
      });
      await verifyDrop(drop.userId, drop.id);
      saved++;
    }
  }
  return { batches: batchIds.length, saved };
}

function inQuietHours(hhmm: string) {
  return hhmm >= QUIET_HOURS.start || hhmm < QUIET_HOURS.end;
}

/**
 * 알림 발송 (PRD §17.2). 10분마다 호출한다고 가정하고, 사용자 알림 시각이 지난 10분 안이면 보낸다.
 * 다음 Drop이 준비되지 않았으면 실시간 생성을 한 번 시도하고, 그래도 없으면 보내지 않는다.
 */
export async function sendDueNotifications(windowMinutes = 10) {
  const store = getStore();
  const now = new Date();
  const hhmm = kstTime(now);
  if (inQuietHours(hhmm)) return { sent: 0 };
  const windowStart = kstTime(new Date(now.getTime() - windowMinutes * 60_000));
  const today = kstDate(now);
  let sent = 0;

  for (const user of await store.listUsers()) {
    if (user.notifyPermission !== 'granted' || !user.pushToken || !user.notifyTime) continue;
    if (!(user.notifyTime > windowStart && user.notifyTime <= hhmm)) continue;

    if (await completedToday(user.id)) continue;
    const events = await store.listEvents(new Date(now.getTime() - 86_400_000).toISOString());
    if (events.some(e => e.userId === user.id && e.name === 'push_sent' && kstDate(e.at) === today)) continue;

    // 오늘 받기로 한 코스(어제 고른 내일 코스)의 다음 Drop
    const courses = (await store.listCourses(user.id))
      .filter(c => c.status === 'active' && !c.openedAllAt)
      .sort((a, b) => (b.lastReadAt ?? '').localeCompare(a.lastReadAt ?? ''));
    const course = courses.find(c => c.id === user.tomorrowCourseId) ?? courses[0];
    if (!course) continue;
    const next = (await store.listDrops(course.id)).find(d => !d.completedAt);
    if (!next || next.status !== 'ready' || !next.body) {
      await track(user.id, 'push_skipped', { reason: 'drop_not_ready', dropId: next?.id });
      continue;
    }

    const result = await sendPush(user.pushToken, {
      title: `${course.title} #${String(next.index + 1).padStart(2, '0')}`,
      body: (next.body.hook.split('\n')[0] ?? '').slice(0, 80),
      data: { path: `/drop/${next.id}` },
    });
    await track(user.id, result.ok ? 'push_sent' : 'push_failed', { dropId: next.id, error: result.error });
    if (result.ok) sent++;
  }
  return { sent };
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
