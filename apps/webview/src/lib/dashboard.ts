import { USD_KRW } from './ai/pricing';
import { isPlus } from './service';
import { getStore } from './store';
import type { AppEvent, Course, User } from './types';
import { kstDate, nowIso } from './util';

/* 어드민 대시보드 (2026-11-08 대표 요청): 일·주·월 단위 지표. GA 없이 우리 DB(사용자·이벤트·코스·AI 사용량)로 센다 */

export type Unit = 'day' | 'week' | 'month';

export const UNIT_LABEL: Record<Unit, string> = { day: '일', week: '주', month: '월' };

/** 단위마다 보여 주는 기간 수 */
const SPAN: Record<Unit, number> = { day: 30, week: 12, month: 12 };
/** 재방문 표: 최근 몇 묶음을, 처음 온 기간 뒤 몇 칸까지 */
const COHORTS: Record<Unit, { rows: number; cols: number }> = { day: { rows: 14, cols: 7 }, week: { rows: 8, cols: 7 }, month: { rows: 6, cols: 5 } };

/** 출시용 추천 코스 시드를 만든 기기 계정 (2026-11-07). 지표에서 뺀다 */
const INTERNAL_USERS = new Set(['eb0c1bdd-79e6-43be-a2ab-8e1119c8be11', '55ad7ccd-0b90-4545-98f7-962f273427df', 'd2b42684-8202-49cb-b1f9-d42d5e05b004']);
/** 대표 본인 계정(이메일·Google·Apple·카카오 테스트)과 심사용 데모 계정 (2026-11-09 대표 요청). 지표에서 빼고, 로그인 사용자 표에는 '내부'로 표시 */
const STAFF_USERS = new Set([
  'de322192-ba3d-4ce0-81fc-972d1837865d',
  'efce9052-30b2-47e4-b9f0-b3752116930a',
  '172845cc-82b6-4551-8313-cc77555444dd',
  'a37b4483-37a5-49e1-ba3f-9a79d81aab40',
  'd3888bae-34c3-433e-a652-e31a58b312b1',
]);

/** 사용자가 한 행동이 아닌 이벤트 (서버의 알림 발송·결제 알림 등). 활동·재방문에서 뺀다 */
const SYSTEM_EVENTS = new Set(['system', 'push_sent', 'push_skipped', 'push_failed', 'iap_notification', 'account_deleted', 'plus_sandbox_rejected']);

const DAY_MS = 86_400_000;

/** KST 날짜(YYYY-MM-DD)가 속한 기간: 일 = 그 날짜, 주 = 그 주 월요일, 월 = YYYY-MM */
export function periodOf(day: string, unit: Unit): string {
  if (unit === 'day') return day;
  if (unit === 'month') return day.slice(0, 7);
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

/** 기간을 k칸 옮긴다 */
export function shiftPeriod(key: string, unit: Unit, k: number): string {
  if (unit === 'month') {
    const [y, m] = key.split('-').map(Number);
    return new Date(Date.UTC(y!, m! - 1 + k, 1)).toISOString().slice(0, 7);
  }
  return new Date(Date.parse(`${key}T00:00:00Z`) + k * (unit === 'week' ? 7 : 1) * DAY_MS).toISOString().slice(0, 10);
}

/** 차트 아래 짧은 이름: 11/8, 11/3~, 11월 */
export function periodLabel(key: string, unit: Unit): string {
  if (unit === 'month') return `${Number(key.slice(5, 7))}월`;
  const label = `${Number(key.slice(5, 7))}/${Number(key.slice(8, 10))}`;
  return unit === 'week' ? `${label}~` : label;
}

const median = (values: number[]) => {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) / 2)]!;
};

export interface Chart {
  label: string;
  values: number[];
  format?: 'won' | 'sec';
  note?: string;
  /** 로그인·비로그인으로 나눠 쌓아 그린다 (사람 수 차트) */
  parts?: { login: number[]; anon: number[] };
}

/** 지표에서 빼는 내부 계정인지 */
const real = (id: string) => !INTERNAL_USERS.has(id) && !STAFF_USERS.has(id);

/** 로그인(가입한 계정) · 비로그인(기기만) 나눠 센다. 지금 기준이라, 나중에 가입하면 그 전 기록도 로그인으로 센다 */
const split = (ids: Iterable<string>, accounts: Set<string>) => {
  let login = 0;
  let anon = 0;
  for (const id of ids) {
    if (accounts.has(id)) login++;
    else anon++;
  }
  return { login, anon };
};

/**
 * 사람과 처음 온 시각: 활동 이벤트나 코스가 하나라도 있는 id만 센다. 사용자 행만 있고 아무 기록이 없는 id
 * (10/31 전에는 첫 방문마다 사용자 행을 만들었음, 로그인 뒤 기록이 계정으로 옮겨지고 남은 기기 행)는 사람이 아니다.
 * 처음 온 시각은 그중 가장 이른 기록 (사용자 행이 더 이르면 그 시각)
 */
function firstSeenOf(users: User[], events: AppEvent[], courses: Course[]) {
  const firstSeen = new Map<string, string>();
  const seen = (id: string, at: string) => {
    if (!real(id)) return;
    const prev = firstSeen.get(id);
    if (!prev || at < prev) firstSeen.set(id, at);
  };
  for (const e of events) if (!SYSTEM_EVENTS.has(e.name)) seen(e.userId, e.at);
  for (const c of courses) seen(c.userId, c.createdAt);
  const createdAt = new Map(users.map(u => [u.id, u.createdAt]));
  for (const [id, at] of firstSeen) {
    const created = createdAt.get(id);
    if (created && created < at) firstSeen.set(id, created);
  }
  return firstSeen;
}

/** 어드민 첫 화면의 사람 수 (대시보드와 같은 기준): 로그인·비로그인, 그리고 사람이 아닌 빈 사용자 행 수 */
export async function peopleSummary() {
  const store = getStore();
  const [users, events, courses] = await Promise.all([store.listUsers(), store.listEvents(), store.listAllCourses()]);
  const firstSeen = firstSeenOf(users, events, courses);
  const accounts = new Set(users.filter(u => !u.anon).map(u => u.id));
  return { ...split(firstSeen.keys(), accounts), emptyRows: users.filter(u => real(u.id) && !firstSeen.has(u.id)).length };
}

export async function dashboardData(unit: Unit) {
  const store = getStore();
  const [users, allEvents, usage, allCourses] = await Promise.all([store.listUsers(), store.listEvents(), store.listUsage(), store.listAllCourses()]);
  const events = allEvents.filter(e => real(e.userId));
  const accounts = new Set(users.filter(u => !u.anon).map(u => u.id));

  const today = kstDate();
  const current = periodOf(today, unit);
  const periods = Array.from({ length: SPAN[unit] }, (_, i) => shiftPeriod(current, unit, i - SPAN[unit] + 1));
  const index = new Map(periods.map((p, i) => [p, i]));
  const slot = (iso: string) => index.get(periodOf(kstDate(iso), unit));
  const tally = (list: { at: string }[]) => {
    const out = periods.map(() => 0);
    for (const x of list) {
      const i = slot(x.at);
      if (i !== undefined) out[i]!++;
    }
    return out;
  };
  const named = (name: string, keep: (e: AppEvent) => boolean = () => true) => tally(events.filter(e => e.name === name && keep(e)));
  /** 기간마다 그 이벤트를 남긴 사람들 */
  const whoDid = (name: string) => {
    const sets = periods.map(() => new Set<string>());
    for (const e of events) {
      const i = e.name === name ? slot(e.at) : undefined;
      if (i !== undefined) sets[i]!.add(e.userId);
    }
    return sets;
  };

  // 처음 온 날도 활동한 날로 센다
  const firstSeen = firstSeenOf(users, events, allCourses);
  const days = new Map<string, Set<string>>();
  const addDay = (id: string, iso: string) => {
    const set = days.get(id) ?? new Set<string>();
    set.add(kstDate(iso));
    days.set(id, set);
  };
  for (const [id, at] of firstSeen) addDay(id, at);
  for (const e of events) if (!SYSTEM_EVENTS.has(e.name)) addDay(e.userId, e.at);

  // 기간별 새 사용자 · 활동한 사람 · 다시 온 사람(전 기간에 처음 온 사람)
  const firstPeriod = new Map([...firstSeen].map(([id, at]) => [id, periodOf(kstDate(at), unit)]));
  const active = periods.map(() => new Set<string>());
  for (const [id, set] of days) {
    for (const d of set) {
      const i = index.get(periodOf(d, unit));
      if (i !== undefined) active[i]!.add(id);
    }
  }
  const newSets = periods.map(() => [] as string[]);
  for (const [id, at] of firstSeen) {
    const i = slot(at);
    if (i !== undefined) newSets[i]!.push(id);
  }
  const returnSets = periods.map((p, i) => [...active[i]!].filter(id => firstPeriod.get(id)! < p));
  const parts = (sets: Iterable<string>[]) => {
    const each = sets.map(ids => split(ids, accounts));
    return { login: each.map(e => e.login), anon: each.map(e => e.anon) };
  };
  const newUsers = newSets.map(s => s.length);
  const returning = returnSets.map(s => s.length);

  // 코스: 받은 코스 포함, 만들다 실패한 코스는 뺀다
  const courses = allCourses.filter(c => real(c.userId) && c.status !== 'failed');
  const costKrw = periods.map(() => 0);
  const costByPurpose = new Map<string, number>();
  for (const u of usage) {
    if (!real(u.userId)) continue;
    const i = slot(u.at);
    if (i === undefined) continue;
    costKrw[i]! += u.costUsd * USD_KRW;
    costByPurpose.set(u.purpose, (costByPurpose.get(u.purpose) ?? 0) + u.costUsd * USD_KRW);
  }
  const drops = named('drop_completed');
  const ttfd = periods.map(() => [] as number[]);
  for (const e of events) {
    const i = e.name === 'ttfd' ? slot(e.at) : undefined;
    const ms = Number(e.props?.ms);
    if (i !== undefined && ms > 0) ttfd[i]!.push(ms);
  }

  const openers = whoDid('shared_course_opened');
  const readers = whoDid('shared_drop_read');

  const signedUp = users.filter(u => real(u.id) && !u.anon).length;
  const groups: { title: string; charts: Chart[] }[] = [
    {
      title: '사용자',
      charts: [
        { label: '새 사용자', values: newUsers, parts: parts(newSets), note: '처음 온 날 기준 (방문·코스 만들기 등 처음 기록)' },
        { label: '활동한 사람', values: active.map(s => s.size), parts: parts(active), note: '앱 방문·Drop 읽기·코스 만들기 등을 한 사람' },
        { label: '다시 온 사람', values: returning, parts: parts(returnSets), note: '이전 기간에 처음 온 사람 중 이 기간에 활동한 사람' },
        { label: '가입', values: named('signup'), note: `이메일·카카오·Google·Apple · 지금까지 ${signedUp}명` },
      ],
    },
    {
      title: '학습',
      charts: [
        { label: '만든 코스', values: tally(courses.map(c => ({ at: c.createdAt }))), note: '받은 코스 포함, 만들다 실패한 코스 제외' },
        { label: '완료한 Drop', values: drops },
        { label: '완주한 코스', values: named('course_completed') },
        { label: '첫 Drop까지 걸린 시간', values: ttfd.map(v => Math.round(median(v) / 1000)), format: 'sec', note: '중앙값. 주제를 정한 뒤 첫 Drop 첫 문단까지' },
      ],
    },
    {
      title: '다른 사람이 만든 코스',
      charts: [
        { label: '미리보기 연 사람', values: openers.map(s => s.size), parts: parts(openers), note: '코스 목차를 연 사람 · 11/9부터 기록' },
        { label: 'Drop을 열람한 사람', values: readers.map(s => s.size), parts: parts(readers), note: '코스의 Drop을 하나라도 연 사람' },
        { label: '열람한 Drop', values: named('shared_drop_read'), note: '같은 Drop을 다시 열어도 셈' },
        { label: '좋아요', values: named('shared_course_liked'), note: `누른 횟수 (취소는 빼지 않음) · 좋아요 알림 ${named('push_sent', e => e.props?.kind === 'like').reduce((a, b) => a + b, 0)}번 보냄` },
      ],
    },
    {
      title: '수익·비용',
      charts: [
        { label: 'Plus 구독 시작', values: named('plus_started', e => e.props?.env !== 'Sandbox' && !e.props?.beta), note: '심사·TestFlight(Sandbox) 제외' },
        { label: 'AI 비용', values: costKrw.map(Math.round), format: 'won', note: '글·검증·그림 생성 합계' },
        { label: '보낸 알림', values: named('push_sent') },
      ],
    },
  ];

  // 재방문율: 처음 온 다음 날 / 7일 안에 다시 활동한 비율 (그 기간이 다 지난 사람만)
  const returnRate = (window: number, lookbackDays: number, keep: (id: string) => boolean = () => true) => {
    let cohort = 0;
    let back = 0;
    for (const [id, at] of firstSeen) {
      if (!keep(id)) continue;
      const d0 = kstDate(at);
      const age = Math.round((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${d0}T00:00:00Z`)) / DAY_MS);
      if (age <= window || age > lookbackDays) continue;
      cohort++;
      const set = days.get(id)!;
      for (let k = 1; k <= window; k++) {
        if (set.has(shiftPeriod(d0, 'day', k))) {
          back++;
          break;
        }
      }
    }
    return { rate: cohort ? back / cohort : null, cohort, back };
  };

  // 재방문 표: 처음 온 기간별로(지난 기간부터 최근 순), 그 뒤 k번째 기간에 활동한 비율
  const { rows, cols } = COHORTS[unit];
  const activePeriods = new Map([...days].map(([id, set]) => [id, new Set([...set].map(d => periodOf(d, unit)))]));
  const retention = Array.from({ length: rows }, (_, r) => shiftPeriod(current, unit, -(r + 1))).map(key => {
    const ids = [...firstPeriod].filter(([, p]) => p === key).map(([id]) => id);
    const cells = Array.from({ length: cols }, (_, j) => {
      const target = shiftPeriod(key, unit, j + 1);
      if (target > current || !ids.length) return null;
      const back = ids.filter(id => activePeriods.get(id)?.has(target)).length;
      return { rate: back / ids.length, back, partial: target === current };
    });
    return { key, label: periodLabel(key, unit), size: ids.length, cells };
  });

  // 사용자당 코스 수 (코스가 하나라도 있는 사람 기준)
  const perUser = new Map<string, number>();
  for (const c of courses) perUser.set(c.userId, (perUser.get(c.userId) ?? 0) + 1);
  const counts = [...perUser.values()];
  const avgOf = (list: number[]) => (list.length ? list.reduce((s, n) => s + n, 0) / list.length : 0);
  const people = split(firstSeen.keys(), accounts);
  const dist = [1, 2, 3, 4].map(n => counts.filter(c => (n === 4 ? c >= 4 : c === n)).length);

  const plus = users.filter(u => real(u.id) && isPlus(u) && u.plusEnv !== 'Sandbox');
  const last = periods.length - 1;
  const rates = (window: number, lookbackDays: number) => ({
    all: returnRate(window, lookbackDays),
    login: returnRate(window, lookbackDays, id => accounts.has(id)),
    anon: returnRate(window, lookbackDays, id => !accounts.has(id)),
  });
  /** 이번 기간 로그인·비로그인 */
  const nowSplit = (sets: Iterable<string>[]) => split(sets[last]!, accounts);

  return {
    unit,
    updatedAt: nowIso(),
    periods: periods.map(key => ({ key, label: periodLabel(key, unit) })),
    groups,
    people,
    now: {
      newUsers: [newUsers[last]!, newUsers[last - 1]!] as const,
      active: [active[last]!.size, active[last - 1]!.size] as const,
      returning: [returning[last]!, returning[last - 1]!] as const,
      newSplit: nowSplit(newSets),
      activeSplit: nowSplit(active),
      returningSplit: nowSplit(returnSets),
      drops: [drops[last]!, drops[last - 1]!] as const,
      costKrw: [Math.round(costKrw[last]!), Math.round(costKrw[last - 1]!)] as const,
    },
    returnRates: { d1: rates(1, 30), d7: rates(7, 60) },
    retention: { cols, rows: retention },
    courses: {
      people: firstSeen.size,
      withCourse: counts.length,
      avg: avgOf(counts),
      median: median(counts),
      dist,
      avgLogin: avgOf([...perUser].filter(([id]) => accounts.has(id)).map(([, n]) => n)),
      avgAnon: avgOf([...perUser].filter(([id]) => !accounts.has(id)).map(([, n]) => n)),
    },
    plus: { active: plus.length, autoRenewOff: plus.filter(u => u.plusAutoRenew === false).length },
    costByPurpose: [...costByPurpose].map(([purpose, krw]) => ({ purpose, krw: Math.round(krw) })).sort((a, b) => b.krw - a.krw),
  };
}

export interface AccountRow {
  id: string;
  email?: string;
  /** 로그인 방법 (이메일·카카오·Google·Apple) */
  methods: string[];
  signedUpAt: string;
  lastActiveAt?: string;
  courses: number;
  drops: number;
  /** Plus 구독 중이면 거래 환경 (Sandbox = 심사·TestFlight) */
  plus: 'Production' | 'Sandbox' | null;
  notify: User['notifyPermission'];
  /** 대표·데모 계정 (지표에서 뺌) */
  staff: boolean;
}

/** 어드민: 로그인한 사용자(가입한 계정) 목록. 최근 활동 순 */
export async function accountRows(): Promise<AccountRow[]> {
  const store = getStore();
  const [users, events, courses] = await Promise.all([store.listUsers(), store.listEvents(), store.listAllCourses()]);
  const signup = new Map<string, string>();
  const lastActive = new Map<string, string>();
  const drops = new Map<string, number>();
  for (const e of events) {
    if (e.name === 'signup' && (!signup.get(e.userId) || e.at < signup.get(e.userId)!)) signup.set(e.userId, e.at);
    if (e.name === 'drop_completed') drops.set(e.userId, (drops.get(e.userId) ?? 0) + 1);
    if (!SYSTEM_EVENTS.has(e.name) && (!lastActive.get(e.userId) || e.at > lastActive.get(e.userId)!)) lastActive.set(e.userId, e.at);
  }
  const courseCount = new Map<string, number>();
  for (const c of courses) if (c.status !== 'failed') courseCount.set(c.userId, (courseCount.get(c.userId) ?? 0) + 1);
  return users
    .filter(u => !u.anon && !INTERNAL_USERS.has(u.id))
    .map(u => ({
      id: u.id,
      email: u.email,
      methods: [u.kakaoId && '카카오', u.googleSub && 'Google', u.appleSub && 'Apple', u.passwordHash && '이메일'].filter((m): m is string => Boolean(m)),
      signedUpAt: signup.get(u.id) ?? u.createdAt,
      lastActiveAt: lastActive.get(u.id),
      courses: courseCount.get(u.id) ?? 0,
      drops: drops.get(u.id) ?? 0,
      plus: isPlus(u) ? (u.plusEnv ?? 'Production') : null,
      notify: u.notifyPermission,
      staff: STAFF_USERS.has(u.id),
    }))
    .sort((a, b) => (b.lastActiveAt ?? b.signedUpAt).localeCompare(a.lastActiveAt ?? a.signedUpAt));
}
