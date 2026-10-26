'use client';

import { useState } from 'react';

import { postJson } from '@/lib/client/ndjson';

import { cx } from './ui';

export type TomorrowItem = { id: string; topic: string; index: number; total: number; title: string };

/**
 * 내일 받을 코스: 진행 중인 코스마다 다음 Drop을 보여 주고, 그중 하나만 '내일 받아요'.
 * 쉬는 중인 코스의 '내일 받기'를 누르면 내일은 그 코스의 Drop을 받는다 (하루 한 편).
 * 코스가 하나면 고를 게 없으니 안내 카드만 보여 준다
 */
export function TomorrowList({ items, tomorrowId, size = 'lg' }: { items: TomorrowItem[]; tomorrowId?: string; size?: 'md' | 'lg' }) {
  const [on, setOn] = useState(tomorrowId ?? items[0]?.id);

  const pick = (id: string) => {
    if (id === on) return;
    setOn(id);
    void postJson('/api/tomorrow/pick', { courseId: id });
  };

  const titleSize = size === 'lg' ? 'text-lg' : 'text-base';

  const [c] = items;
  if (items.length === 1 && c) {
    return (
      <div className="flex flex-col gap-0.5 rounded-2xl bg-shape-depth1 px-5 py-4">
        <span className="text-sm font-semibold text-txt-black-tertiary">
          {c.topic} · Drop {c.index + 1} / {c.total}
        </span>
        <span className={cx(titleSize, 'font-semibold')}>{c.title}</span>
        <span className="mt-1 text-sm font-semibold text-txt-point">내일 0시에 열려요</span>
      </div>
    );
  }

  return (
    <>
      {items.map(c => {
        const active = c.id === on;
        return (
          <div
            key={c.id}
            className={cx(
              'flex w-full items-center gap-3 rounded-2xl bg-shape-white py-4 pl-5 pr-4',
              active ? 'border-2 border-border-brand' : 'border border-border-div',
            )}
          >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-sm font-semibold text-txt-black-tertiary">
                {c.topic} · Drop {c.index + 1} / {c.total}
              </span>
              <span className={cx(titleSize, 'font-semibold', active ? '' : 'text-txt-black-tertiary')}>{c.title}</span>
              <span
                data-badge
                className={cx(
                  'mt-1 self-start rounded-full px-2 py-0.5 text-xs font-bold leading-4',
                  active ? 'bg-shape-brand text-txt-white-primary' : 'bg-shape-depth2 text-txt-black-tertiary',
                )}
              >
                {active ? '내일 받아요' : '쉬는 중'}
              </span>
            </span>
            {active ? null : (
              <button
                type="button"
                onClick={() => pick(c.id)}
                aria-label={`내일 ${c.topic} 코스로 받기`}
                className="mc-press h-10 flex-shrink-0 rounded-full border border-border-button bg-shape-white px-4 text-sm font-semibold"
              >
                내일 받기
              </button>
            )}
          </div>
        );
      })}
      <p className="text-sm text-txt-black-secondary">하루 한 편, 고른 코스로 받아요. 쉬는 중인 코스도 진도는 그대로예요.</p>
    </>
  );
}
