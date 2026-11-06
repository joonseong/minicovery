import { Doodle, type DoodleAct, type DoodleAnimal } from './Doodle';

/** Drop 준비 단계: 자료 찾기 → 글 쓰기 → 그림 그리기 → 마무리 (글과 그림은 함께 만들고, 둘 다 되면 보여 준다) */
export type DropLoadingStep = 0 | 1 | 2 | 3;

const STEPS: { label: string; message: string; act: DoodleAct }[] = [
  { label: '자료 찾기', message: '자료를 찾고 있어요', act: 'look' },
  { label: '글 쓰기', message: '오늘 Drop을 쓰고 있어요', act: 'idle' },
  { label: '그림 그리기', message: '그림을 그리고 있어요', act: 'perk' },
  { label: '마무리', message: '거의 다 됐어요', act: 'hop' },
];

export function DropLoading({ step, progress, animal }: { step: DropLoadingStep; progress: number; animal: DoodleAnimal }) {
  const current = STEPS[step]!;
  return (
    <div className="mt-6 flex flex-col items-center gap-5 rounded-2xl bg-shape-depth1 px-5 pb-6 pt-7 text-center">
      <Doodle animal={animal} act={current.act} className="h-[120px] w-[120px]" />
      <p role="status" aria-live="polite" className="text-lg font-semibold">
        {current.message}
      </p>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-shape-white"
        role="progressbar"
        aria-label="Drop 준비"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <div className="h-full rounded-full bg-shape-black transition-[width] duration-700 ease-out" style={{ width: `${Math.round(progress * 100)}%` }} />
      </div>
      <ol className="flex w-full justify-between text-xs">
        {STEPS.map((s, i) => (
          <li key={s.label} className={i < step ? 'text-txt-black-secondary' : i === step ? 'font-bold' : 'text-txt-black-tertiary'}>
            {i < step ? '✓ ' : ''}
            {s.label}
          </li>
        ))}
      </ol>
      <p className="text-sm text-txt-black-tertiary">글과 그림을 함께 만들고 있어요 · 보통 30초 안팎</p>
    </div>
  );
}
