'use client';

import Link from 'next/link';
import { useEffect } from 'react';

import type { Recommended } from '@/lib/learning';

import { CatIcon } from '../CatIcon';
import { AppHeader, Footer, IconArrow, Main, PrimaryButton, Screen } from '../ui';

/** 다른 사람이 만든 코스 미리보기: 목차를 보고 받지 않고 바로 읽는다 (만든 사람은 드러나지 않음) */
export function RecommendScreen({ course }: { course: Recommended & { titles: string[]; readable: boolean[]; levelLabel: string } }) {
  // 열어 본 횟수 (새 코스 화면의 '많이 눌러본 순'). 미리 불러오기는 세지 않게 화면이 뜬 뒤에 보낸다
  useEffect(() => {
    void fetch(`/api/recommended/${course.id}/open`, { method: 'POST' });
  }, [course.id]);
  const first = course.readable.indexOf(true);

  return (
    <Screen className="relative">
      <AppHeader layout="nav" back />
      <Main className="pb-6 pt-4">
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-2.5">
            <CatIcon category={course.category} />
            <span className="flex-1 text-sm text-fuse-sub">
              추천 코스 · {course.levelLabel} · {course.category}
            </span>
            {course.readers ? <span className="flex-shrink-0 text-[13px] font-medium text-fuse-hot">{course.readers}명이 읽었어요</span> : null}
          </div>
          <h1 className="mt-1 text-[28px] font-bold leading-[1.3]">{course.title}</h1>
        </section>
        <section aria-label="구성" className="mt-5 flex flex-col gap-3">
          <p className="text-[52px] font-bold leading-none">
            {course.total}
            <span className="relative -top-[0.14em] ml-2 text-[22px] leading-[1.3]">편</span>
          </p>
        </section>
        <ol className="mt-6 flex flex-col">
          {course.titles.map((t, i) => {
            const row = (
              <>
                <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-fuse-edge bg-shape-white text-[13px] font-semibold">
                  {i + 1}
                </span>
                <span className="flex-1 text-sm">{t}</span>
              </>
            );
            return (
              <li key={i} className={i ? 'border-t border-[#F2F2F4]' : ''}>
                {course.readable[i] ? (
                  <Link href={`/recommend/${course.id}/${i + 1}`} className="flex min-h-[60px] items-center gap-3 py-2">
                    {row}
                    <IconArrow />
                  </Link>
                ) : (
                  <div className="flex min-h-[60px] items-center gap-3 py-2 text-fuse-faint">{row}</div>
                )}
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-[13px] text-fuse-sub">다른 사람이 만든 코스예요. 받지 않아도 처음부터 끝까지 바로 읽을 수 있어요.</p>
      </Main>
      {first >= 0 ? (
        <Footer>
          <PrimaryButton href={`/recommend/${course.id}/${first + 1}`}>첫 Drop 읽기</PrimaryButton>
        </Footer>
      ) : null}
    </Screen>
  );
}
