'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { ReviewItem } from '@/lib/learning';

import { CatIcon } from '../CatIcon';
import { AppHeader, Main, PrimaryButton, Screen } from '../ui';

function ItemList({ items, hide }: { items: ReviewItem[]; hide: boolean }) {
  return (
    <ol className="mt-5 flex flex-col gap-2.5">
      {items.map(i => (
        <li key={i.dropId}>
          <Link href={`/drop/${i.dropId}`} className="flex flex-col gap-1 rounded-card border border-fuse-line bg-fuse-card p-4">
            <span className="flex items-center gap-2">
              <CatIcon category={i.category} />
              <span className="min-w-0 truncate text-[13px] text-fuse-sub">{i.meta}</span>
            </span>
            <span className="mt-1 text-base font-semibold leading-[1.3]">{i.title}</span>
            {hide ? null : <span className="mt-2 rounded-[14px] border border-fuse-line bg-shape-white px-3.5 py-3 text-sm">{i.takeaway}</span>}
          </Link>
        </li>
      ))}
    </ol>
  );
}

/** 이번 주에 배운 한 문장: 제목만 보고 먼저 떠올릴 수 있게 문장을 가릴 수 있다. 월·화요일에는 지난주도 함께 */
export function WeekReviewScreen({ range, items, lastWeek }: { range: string; items: ReviewItem[]; lastWeek?: { range: string; items: ReviewItem[] } | null }) {
  const [hide, setHide] = useState(false);
  const last = lastWeek && lastWeek.items.length ? lastWeek : null;
  const any = items.length > 0 || Boolean(last);
  return (
    <Screen>
      <AppHeader layout="nav" title="이번 주 복습" back />
      <Main className="pb-12 pt-6">
        <p className="text-sm text-fuse-sub">
          {range} · {items.length}편 읽음
        </p>
        <h1 className="mt-1.5 text-[28px] font-bold leading-[1.3]">이번 주에 배운 한 문장</h1>
        {any ? (
          <>
            <p className="mt-2.5 text-sm text-fuse-sub">문장을 가려 두고, 제목만 보고 먼저 떠올려 보세요.</p>
            <button
              type="button"
              onClick={() => setHide(h => !h)}
              aria-pressed={hide}
              className="mc-press mt-4 flex h-14 w-full flex-shrink-0 items-center justify-center rounded-full bg-fuse-ink px-5 text-base font-semibold text-txt-white-primary"
            >
              {hide ? '문장 모두 보기' : '문장 가리고 떠올려 보기'}
            </button>
            {items.length ? (
              <ItemList items={items} hide={hide} />
            ) : (
              <p className="mt-5 rounded-card border border-fuse-line bg-fuse-card p-4 text-sm text-fuse-sub">이번 주에 읽은 Drop이 아직 없어요. 지난주 문장부터 떠올려 볼까요?</p>
            )}
            {last ? (
              <section className="mt-8 flex flex-col">
                <h2 className="text-base font-semibold leading-[1.3]">지난주 복습</h2>
                <p className="mt-1 text-[13px] text-fuse-sub">
                  {last.range} · {last.items.length}편 읽음
                </p>
                <ItemList items={last.items} hide={hide} />
              </section>
            ) : null}
            <p className="mt-4 text-[13px] text-fuse-sub">주말마다 그 주에 배운 문장을 모아 드려요.</p>
          </>
        ) : (
          <>
            <p className="mt-5 rounded-card border border-fuse-line bg-fuse-card p-4 text-sm text-fuse-sub">이번 주에 읽은 Drop이 아직 없어요. 오늘 한 편부터 읽어 볼까요?</p>
            <PrimaryButton href="/today" replace className="mt-4">
              오늘 Drop 읽기
            </PrimaryButton>
          </>
        )}
      </Main>
    </Screen>
  );
}
