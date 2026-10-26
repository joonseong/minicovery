import type { PlusUsage } from '@/lib/service';

/** Plus 남은 새 코스 수와 다시 채워지는 날 (새 코스 버튼 아래 한 줄) */
export function PlusLeft({ usage, className = 'mt-2' }: { usage: PlusUsage | null; className?: string }) {
  if (!usage) return null;
  return (
    <p className={`${className} text-center text-sm text-txt-black-secondary`}>
      {usage.coursesLeft
        ? `Plus · 새 코스 ${usage.coursesLeft}개 남음 · ${usage.resetLabel}에 다시 3개`
        : `Plus · 이번 달 새 코스를 다 만들었어요 · ${usage.resetLabel}에 다시 3개`}
    </p>
  );
}
