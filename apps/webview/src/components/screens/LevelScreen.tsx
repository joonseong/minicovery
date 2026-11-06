'use client';

import Link from 'next/link';

import { CatIcon } from '../CatIcon';
import { AppHeader, Main, Screen } from '../ui';

/** 수준 막대 (캔버스 수준 선택): 처음 1칸 · 조금 2칸 · 꽤 3칸 */
const BARS = [10, 16, 22];

const LEVELS = [
  { value: 'beginner', label: '처음이에요', desc: '기본 개념부터 차근차근' },
  { value: 'some', label: '조금 알아요', desc: '들어 본 적은 있어요' },
  { value: 'advanced', label: '꽤 알아요', desc: '입문은 건너뛰고 핵심으로' },
] as const;

export function LevelScreen({ topic, category, taskType, replace }: { topic: string; category: string; taskType: string; replace: boolean }) {
  const href = (level: string) => {
    const q = new URLSearchParams({ topic, category, taskType, level });
    if (replace) q.set('replace', '1');
    return `/course/new?${q}`;
  };
  return (
    <Screen>
      <AppHeader layout="nav" back />
      <Main className="pb-10 pt-6">
        <div className="flex items-center gap-2">
          <CatIcon category={category} />
          <p className="min-w-0 truncate text-sm font-medium text-fuse-sub">{topic}</p>
        </div>
        <h1 className="mt-2.5 text-[28px] font-bold leading-[1.3]">어느 정도 알고 있나요?</h1>
        <p className="mt-2 text-sm text-fuse-sub">고른 수준에 맞춰 코스 전체의 깊이를 정해요.</p>
        <div className="mt-8 flex flex-col gap-2.5">
          {LEVELS.map((l, i) => (
            <Link
              key={l.value}
              href={href(l.value)}
              replace
              onClick={() => sessionStorage.setItem('ttfd_start', String(Date.now()))}
              className="mc-press flex min-h-[88px] items-center gap-4 rounded-card border border-fuse-line bg-fuse-card p-4"
            >
              <span aria-hidden="true" className="flex h-[22px] flex-shrink-0 items-end gap-[3px]">
                {BARS.map((h, b) => (
                  <span key={h} className={`w-[5px] rounded-[2px] ${b <= i ? 'bg-fuse-ink' : 'bg-fuse-edge'}`} style={{ height: h }} />
                ))}
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-[3px]">
                <span className="text-base font-semibold leading-[1.3] text-fuse-ink">{l.label}</span>
                <span className="text-[13px] text-fuse-sub">{l.desc}</span>
              </span>
            </Link>
          ))}
        </div>
      </Main>
    </Screen>
  );
}
