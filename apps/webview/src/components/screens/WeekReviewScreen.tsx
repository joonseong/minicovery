'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { ReviewItem } from '@/lib/learning';

import { AppHeader, Main, Screen } from '../ui';

/** 이번 주에 배운 한 문장: 제목만 보고 먼저 떠올릴 수 있게 문장을 가릴 수 있다 */
export function WeekReviewScreen({ range, items }: { range: string; items: ReviewItem[] }) {
  const [hide, setHide] = useState(false);
  return (
    <Screen>
      <AppHeader layout="nav" title="이번 주 복습" back />
      <Main className="pb-8 pt-4">
        <p className="text-sm font-semibold text-txt-black-secondary">
          {range} · {items.length}편 읽음
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-[-1px]">
          이번 주에 배운
          <br />한 문장
        </h1>
        {items.length ? (
          <>
            <p className="mt-2 text-sm text-txt-black-secondary">문장을 가려 두고, 제목만 보고 먼저 떠올려 보세요.</p>
            <button
              type="button"
              onClick={() => setHide(h => !h)}
              className="mc-press mt-4 h-10 self-start rounded-full border border-border-button bg-shape-white px-4 text-sm font-semibold"
            >
              {hide ? '문장 모두 보기' : '문장 가리고 떠올려 보기'}
            </button>
            <ol className="mt-4 flex flex-col gap-2">
              {items.map(i => (
                <li key={i.dropId}>
                  <Link href={`/drop/${i.dropId}`} className="flex flex-col gap-1 rounded-2xl bg-shape-depth1 px-5 py-4">
                    <span className="text-sm font-semibold text-txt-black-tertiary">{i.meta}</span>
                    <span className="text-base font-semibold">{i.title}</span>
                    {hide ? null : <span className="mt-1 rounded-xl bg-shape-white px-4 py-3 text-base">{i.takeaway}</span>}
                  </Link>
                </li>
              ))}
            </ol>
            <p className="mt-4 text-sm text-txt-black-secondary">주말마다 그 주에 배운 문장을 모아 드려요.</p>
          </>
        ) : (
          <p className="mt-4 rounded-2xl bg-shape-depth1 p-5 text-sm text-txt-black-secondary">이번 주에 읽은 Drop이 아직 없어요. 오늘 한 편부터 읽어 볼까요?</p>
        )}
      </Main>
    </Screen>
  );
}
