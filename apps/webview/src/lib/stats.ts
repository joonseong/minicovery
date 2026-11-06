/**
 * 홈 상단 숫자: 주 · 월 · 전체에 읽은 Drop (Fuse 홈). 날짜는 모두 KST.
 * 막대 하나 = 하루(주·월) 또는 한 주(전체). 오늘(이번 주) 막대가 마지막 칸이 아닐 수 있어 todayIndex로 알려 준다
 */

const KST_MS = 9 * 3600_000;
const day = (t: number) => new Date(t + KST_MS).toISOString().slice(0, 10);

export interface HomeStats {
  week: { count: number; days: boolean[]; todayIndex: number; streak: number };
  month: { count: number; days: boolean[]; todayIndex: number; diff: number };
  all: { count: number; weeks: boolean[]; learned: number };
}

/** completed: 완료한 Drop의 completedAt(ISO) 목록 */
export function buildHomeStats(completed: string[], learned: number, now = Date.now()): HomeStats {
  const dates = completed.map(iso => day(Date.parse(iso)));
  const read = new Set(dates);
  const today = day(now);
  const [y, m, d] = today.split('-').map(Number) as [number, number, number];
  const at = (yy: number, mm: number, dd: number) => new Date(Date.UTC(yy, mm - 1, dd)).toISOString().slice(0, 10);

  // 이번 주 (월~일)
  const weekday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  const weekDays = Array.from({ length: 7 }, (_, i) => at(y, m, d - weekday + i));
  const weekStart = weekDays[0]!;
  let streak = 0;
  // 오늘 아직 안 읽었으면 어제부터 센다
  for (let i = read.has(today) ? 0 : 1; read.has(at(y, m, d - i)); i++) streak++;

  // 이번 달 (1일~말일), 지난달은 같은 날짜까지만 비교
  const monthLength = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const monthDays = Array.from({ length: monthLength }, (_, i) => at(y, m, i + 1));
  const monthStart = monthDays[0]!;
  const prevStart = at(y, m - 1, 1);
  const prevEnd = at(y, m - 1, Math.min(d, new Date(Date.UTC(y, m - 1, 0)).getUTCDate()));
  const thisMonth = dates.filter(x => x >= monthStart && x <= today).length;
  const prevMonth = dates.filter(x => x >= prevStart && x <= prevEnd).length;

  // 전체: 최근 30주 (이번 주가 마지막)
  const weeks = Array.from({ length: 30 }, (_, i) => {
    const from = at(y, m, d - weekday - (29 - i) * 7);
    const to = at(y, m, d - weekday - (29 - i) * 7 + 6);
    return dates.some(x => x >= from && x <= to);
  });

  return {
    week: { count: dates.filter(x => x >= weekStart && x <= today).length, days: weekDays.map(x => read.has(x)), todayIndex: weekday, streak },
    month: { count: thisMonth, days: monthDays.map(x => read.has(x)), todayIndex: d - 1, diff: thisMonth - prevMonth },
    all: { count: dates.length, weeks, learned },
  };
}
