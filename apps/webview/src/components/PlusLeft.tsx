import type { PlusUsage } from '@/lib/service';

/** Plus 남은 횟수 한 줄: 새 코스 n개 · 전체 열기 m번은 항상 보여 주고, 오늘 만들었으면 덧붙인다. 새 코스는 하루 1개 */
export function plusLeftText(usage: PlusUsage) {
  const made = usage.madeToday ? ' (오늘 1개 만듦)' : '';
  if (!usage.coursesLeft) return `Plus · 새 코스를 다 만들었어요 · 전체 열기 ${usage.openAllLeft}번 남음 · ${usage.resetLabel}에 다시 3개${made}`;
  return `Plus · 새 코스 ${usage.coursesLeft}개 · 전체 열기 ${usage.openAllLeft}번 남음 · ${usage.resetLabel}에 다시 채워져요${made}`;
}

export function PlusLeft({ usage, className = 'mt-2' }: { usage: PlusUsage | null; className?: string }) {
  if (!usage) return null;
  return <p className={`${className} text-center text-sm text-txt-black-secondary`}>{plusLeftText(usage)}</p>;
}
