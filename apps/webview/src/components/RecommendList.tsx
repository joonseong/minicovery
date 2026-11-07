'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

import type { Recommended } from '@/lib/learning';

import { CatIcon } from './CatIcon';
import { IconArrow, cx } from './ui';

/** 다른 사람들이 만든 코스 (홈·새 코스): 많이 눌러본 순, 목록 끝이 보이면 다음 20개를 불러온다 */
export function RecommendList({ items: first, hasMore, className }: { items: Recommended[]; hasMore: boolean; className?: string }) {
  const [items, setItems] = useState(first);
  const [more, setMore] = useState(hasMore);
  const loading = useRef(false);
  const end = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!more || !end.current) return;
    const observer = new IntersectionObserver(async entries => {
      if (!entries.some(e => e.isIntersecting) || loading.current) return;
      loading.current = true;
      try {
        const res = await fetch(`/api/recommended?offset=${items.length}`);
        const page = (await res.json()) as { items: Recommended[]; hasMore: boolean };
        setItems(list => [...list, ...page.items.filter(r => !list.some(x => x.id === r.id))]);
        setMore(page.hasMore && page.items.length > 0);
      } catch {
        setMore(false);
      } finally {
        loading.current = false;
      }
    });
    observer.observe(end.current);
    return () => observer.disconnect();
  }, [more, items.length]);

  if (!items.length) return null;
  return (
    <section className={cx('flex flex-col gap-3', className)}>
      <div className="flex flex-col gap-0.5">
        <h2 className="text-base font-semibold leading-[1.3]">다른 사람들이 만든 코스</h2>
        <p className="text-[13px] text-fuse-sub">바로 받아서 첫 Drop을 읽을 수 있어요.</p>
      </div>
      <div className="flex flex-col gap-2">
        {items.map(r => (
          <Link key={r.id} href={`/recommend/${r.id}`} className="mc-press flex min-h-14 items-center gap-3.5 rounded-card border border-fuse-line bg-fuse-card p-4">
            <CatIcon category={r.category} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[13px] text-fuse-sub">
                {r.category} · {r.total}편
              </span>
              <span className="text-sm font-medium leading-[1.3]">{r.title}</span>
              {r.copies ? <span className="text-[13px] font-semibold text-fuse-hot">{r.copies}명이 받았어요</span> : null}
            </span>
            <IconArrow />
          </Link>
        ))}
      </div>
      {more ? (
        <div ref={end} className="flex h-12 items-center justify-center text-[13px] text-fuse-faint">
          더 불러오는 중…
        </div>
      ) : null}
    </section>
  );
}
