import { USD_KRW } from './ai/pricing';
import { isPlus } from './service';
import { getStore } from './store';
import { daysBetween, kstDate } from './util';

/** 어드민용 간이 지표 (PRD §19). 정식 판정은 코호트 기준으로 따로 계산한다 */
export async function adminSummary() {
  const store = getStore();
  const [users, usage, events, reports, failures] = await Promise.all([
    store.listUsers(),
    store.listUsage(),
    store.listEvents(),
    store.listReports(),
    store.listFailures(),
  ]);

  const completed = events.filter(e => e.name === 'drop_completed');
  const firstOpen = new Map<string, string>();
  for (const u of users) firstOpen.set(u.id, u.createdAt);
  const activated = new Set(
    completed.filter(e => Date.parse(e.at) - Date.parse(firstOpen.get(e.userId) ?? e.at) < 86_400_000).map(e => e.userId),
  );

  const since7 = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const learningDays = new Map<string, Set<string>>();
  for (const e of completed.filter(e => e.at >= since7)) {
    const set = learningDays.get(e.userId) ?? new Set();
    set.add(kstDate(e.at));
    learningDays.set(e.userId, set);
  }
  const weeklyLearningDays = activated.size
    ? [...activated].reduce((sum, id) => sum + (learningDays.get(id)?.size ?? 0), 0) / activated.size
    : 0;

  const d7 = [...activated].filter(id => {
    const start = firstOpen.get(id)!;
    return completed.some(e => e.userId === id && daysBetween(start, e.at) === 7);
  }).length;

  const totalCostKrw = usage.reduce((s, u) => s + u.costUsd, 0) * USD_KRW;
  const costLast7 = usage.filter(u => u.at >= since7).reduce((s, u) => s + u.costUsd, 0) * USD_KRW;
  const completedLast7 = completed.filter(e => e.at >= since7).length;
  const ttfd = events
    .filter(e => e.name === 'ttfd')
    .map(e => Number(e.props?.ms))
    .filter(Boolean)
    .sort((a, b) => a - b);
  const pct = (arr: number[], p: number) => (arr.length ? arr[Math.min(arr.length - 1, Math.floor(arr.length * p))]! : 0);
  const courseCompleters = new Set(events.filter(e => e.name === 'course_completed').map(e => e.userId));
  const presub = new Set(events.filter(e => e.name === 'presubscribe').map(e => e.userId));
  const shown = events.filter(e => e.name === 'drop_read').length;
  // Plus 구독자. Sandbox(TestFlight·심사 계정)는 매출이 아니라서 따로 센다
  const plusUsers = users.filter(isPlus);

  return {
    users: users.length,
    activated: activated.size,
    weeklyLearningDays: Number(weeklyLearningDays.toFixed(2)),
    d7Retained: d7,
    dropsCompleted: completed.length,
    costKrwTotal: Math.round(totalCostKrw),
    costKrwPerCompletedDrop7d: completedLast7 ? Math.round(costLast7 / completedLast7) : null,
    ttfdP50Sec: Math.round(pct(ttfd, 0.5) / 1000),
    ttfdP90Sec: Math.round(pct(ttfd, 0.9) / 1000),
    reportRate: shown ? Number(((reports.length / shown) * 100).toFixed(1)) : 0,
    notifyGranted: users.filter(u => u.notifyPermission === 'granted').length,
    courseCompleters: courseCompleters.size,
    presubscribed: presub.size,
    plusUsers: plusUsers.length,
    plusSandbox: plusUsers.filter(u => u.plusEnv === 'Sandbox').length,
    reports: reports.slice(0, 50),
    failures: failures.slice(-50).reverse(),
  };
}
