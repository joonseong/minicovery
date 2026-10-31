'use client';

import Link from 'next/link';

import { AppHeader, IconArrow, Main, Screen } from '../ui';

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
      <Main className="pb-6 pt-4">
        <p className="text-sm font-semibold text-txt-black-tertiary">{topic}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-[-1px]">어느 정도 알고 있나요?</h1>
        <p className="mt-2 text-base text-txt-black-secondary">고른 수준에 맞춰 코스 전체의 깊이를 정해요.</p>
        <div className="mt-8 flex flex-col gap-3">
          {LEVELS.map(l => (
            <Link
              key={l.value}
              href={href(l.value)}
              replace
              onClick={() => sessionStorage.setItem('ttfd_start', String(Date.now()))}
              className="mc-press flex items-center justify-between gap-4 rounded-2xl border border-border-button bg-shape-white p-5"
            >
              <span className="flex flex-col gap-1">
                <span className="text-lg font-semibold text-txt-black-primary">{l.label}</span>
                <span className="text-sm text-txt-black-tertiary">{l.desc}</span>
              </span>
              <IconArrow />
            </Link>
          ))}
        </div>
      </Main>
    </Screen>
  );
}
