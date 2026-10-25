'use client';

import { useState } from 'react';

import { postJson } from '@/lib/client/ndjson';

import { cx } from './ui';

export type TomorrowItem = { id: string; topic: string; index: number; total: number; title: string };

/**
 * 내일의 Drop: 진행 중인 코스마다 다음 Drop을 보여 주고, 그중 하나만 '받는 중'.
 * 쉬는 중인 코스를 누르면 내일은 그 코스의 Drop을 받는다 (하루 한 편).
 */
export function TomorrowList({ items, tomorrowId, size = 'lg' }: { items: TomorrowItem[]; tomorrowId?: string; size?: 'md' | 'lg' }) {
  const [on, setOn] = useState(tomorrowId ?? items[0]?.id);

  const pick = (id: string) => {
    if (id === on) return;
    setOn(id);
    void postJson('/api/tomorrow/pick', { courseId: id });
  };

  return (
    <>
      {items.map(c => {
        const active = c.id === on;
        return (
          <button
            key={c.id}
            type="button"
            aria-pressed={active}
            onClick={() => pick(c.id)}
            className={cx(
              'mc-press flex w-full items-center gap-3 rounded-2xl bg-shape-white py-4 pl-5 pr-4 text-left',
              active ? 'border-2 border-border-brand' : 'border border-border-div',
            )}
          >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-semibold text-txt-black-tertiary">
                {c.topic} · Drop {c.index + 1} / {c.total}
              </span>
              <span className={cx(size === 'lg' ? 'text-lg' : 'text-base', 'font-semibold', active ? '' : 'text-txt-black-tertiary')}>{c.title}</span>
            </span>
            <span
              data-badge
              className={cx(
                'flex-shrink-0 rounded-full px-3 py-1 text-[13px] font-bold leading-5',
                active ? 'bg-shape-brand text-txt-white-primary' : 'bg-shape-depth2 text-txt-black-tertiary',
              )}
            >
              {active ? '받는 중' : '쉬는 중'}
            </span>
          </button>
        );
      })}
    </>
  );
}
