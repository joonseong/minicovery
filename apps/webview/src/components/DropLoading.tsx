'use client';

import { type AnimationEvent, useEffect, useMemo, useState } from 'react';

import { Doodle, type DoodleAct, type DoodleAnimal } from './Doodle';

/** Drop 준비 단계: 자료 찾기 → 글 쓰기 → 그림 그리기 → 마무리 (글과 그림은 함께 만들고, 둘 다 되면 보여 준다) */
export type DropLoadingStep = 0 | 1 | 2 | 3;

const STEPS: { label: string; message: string; act: DoodleAct }[] = [
  { label: '자료 찾기', message: '자료를 찾고 있어요', act: 'look' },
  { label: '글 쓰기', message: '오늘 Drop을 쓰고 있어요', act: 'idle' },
  { label: '그림 그리기', message: '그림을 그리고 있어요', act: 'perk' },
  { label: '마무리', message: '거의 다 됐어요', act: 'hop' },
];

/** 동작마다 한 바퀴를 재는 keyframe (app/doodle.css). 한 바퀴 끝에는 처음 자세로 돌아와 있다. idle은 따로 움직이는 부분이 없다 */
const CYCLE: Partial<Record<DoodleAct, string>> = { look: 'cs-look', perk: 'cs-perk-l', hop: 'cs-hop' };
/** 한 바퀴 끝 신호를 못 받을 때 기다리는 최대 시간 (가장 긴 동작 4.6초) */
const CYCLE_MAX_MS = 5000;

export function DropLoading({ step, progress, animal }: { step: DropLoadingStep; progress: number; animal: DoodleAnimal }) {
  const current = STEPS[step]!;
  // 단계가 바뀌어도 캐릭터는 지금 동작을 한 바퀴 마치고 바꾼다. 동작 중간에 바꾸면 자세가 툭 끊겨 보인다
  const [act, setAct] = useState(current.act);
  const waiting = act !== current.act;
  useEffect(() => {
    if (!waiting) return;
    if (!CYCLE[act] || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setAct(current.act);
      return;
    }
    const id = setTimeout(() => setAct(current.act), CYCLE_MAX_MS);
    return () => clearTimeout(id);
  }, [waiting, act, current.act]);
  const onCycle = (e: AnimationEvent) => {
    if (waiting && e.animationName === CYCLE[act]) setAct(current.act);
  };
  // 진행 막대가 움직일 때마다 캐릭터 SVG까지 다시 그리지 않게
  const doodle = useMemo(() => <Doodle animal={animal} act={act} className="h-[120px] w-[120px]" />, [animal, act]);

  return (
    <div className="mt-6 flex flex-col items-center gap-5 rounded-card bg-fuse-card px-5 pb-6 pt-7 text-center border border-fuse-line">
      <div onAnimationIteration={onCycle}>{doodle}</div>
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
          <li key={s.label} className={i < step ? 'text-fuse-sub' : i === step ? 'font-bold' : 'text-fuse-faint'}>
            {i < step ? '✓ ' : ''}
            {s.label}
          </li>
        ))}
      </ol>
      <p className="text-sm text-fuse-faint">글과 그림을 함께 만들고 있어요 · 보통 30초 안팎</p>
    </div>
  );
}
