'use client';

import Link from 'next/link';
import { useState } from 'react';

import type { ReviewItem } from '@/lib/learning';

import { AppHeader, Main, PrimaryButton, Screen } from '../ui';

function ItemList({ items, hide }: { items: ReviewItem[]; hide: boolean }) {
  return (
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
      <Main className="pb-8 pt-4">
        <p className="text-sm font-semibold text-txt-black-secondary">
          {range} · {items.length}편 읽음
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-[-1px]">
          이번 주에 배운
          <br />한 문장
        </h1>
        {any ? (
          <>
            <p className="mt-2 text-sm text-txt-black-secondary">문장을 가려 두고, 제목만 보고 먼저 떠올려 보세요.</p>
            <button
              type="button"
              onClick={() => setHide(h => !h)}
              className="mc-press mt-4 h-10 self-start rounded-full border border-border-button bg-shape-white px-4 text-sm font-semibold"
            >
              {hide ? '문장 모두 보기' : '문장 가리고 떠올려 보기'}
            </button>
            {items.length ? (
              <ItemList items={items} hide={hide} />
            ) : (
              <p className="mt-4 rounded-2xl bg-shape-depth1 p-5 text-sm text-txt-black-secondary">이번 주에 읽은 Drop이 아직 없어요. 지난주 문장부터 떠올려 볼까요?</p>
            )}
            {last ? (
              <section className="mt-8 flex flex-col">
                <h2 className="text-sm font-bold text-txt-black-secondary">지난주 복습</h2>
                <p className="mt-0.5 text-sm text-txt-black-tertiary">
                  {last.range} · {last.items.length}편 읽음
                </p>
                <ItemList items={last.items} hide={hide} />
              </section>
            ) : null}
            <p className="mt-4 text-sm text-txt-black-secondary">주말마다 그 주에 배운 문장을 모아 드려요.</p>
          </>
        ) : (
          <>
            <p className="mt-4 rounded-2xl bg-shape-depth1 p-5 text-sm text-txt-black-secondary">이번 주에 읽은 Drop이 아직 없어요. 오늘 한 편부터 읽어 볼까요?</p>
            <PrimaryButton href="/today" replace className="mt-4">
              오늘 Drop 읽기
            </PrimaryButton>
          </>
        )}
      </Main>
    </Screen>
  );
}
