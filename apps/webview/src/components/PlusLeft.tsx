import type { PlusUsage } from '@/lib/service';

/** Plus 남은 새 코스 수와 다시 채워지는 날 (새 코스 버튼 아래 한 줄). 새 코스는 하루 1개 */
export function PlusLeft({ usage, className = 'mt-2' }: { usage: PlusUsage | null; className?: string }) {
  if (!usage) return null;
  const text = !usage.coursesLeft
    ? `Plus · 새 코스를 다 만들었어요 · ${usage.resetLabel}에 다시 3개`
    : usage.madeToday
      ? `Plus · 오늘 새 코스를 만들었어요 · 내일 또 만들 수 있어요 (${usage.coursesLeft}개 남음)`
      : `Plus · 새 코스 ${usage.coursesLeft}개 · 전체 열기 ${usage.openAllLeft}번 남음 · ${usage.resetLabel}에 다시 채워져요`;
  return <p className={`${className} text-center text-sm text-txt-black-secondary`}>{text}</p>;
}
