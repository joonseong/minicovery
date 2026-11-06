'use client';

import { useState } from 'react';

import { postJson } from '@/lib/client/ndjson';

import { CatIcon } from './CatIcon';
import { cx } from './ui';

export type TomorrowItem = { id: string; topic: string; index: number; total: number; title: string; category: string };

/**
 * 내일 받을 코스 (캔버스 홈 · 다 읽음): 진행 중인 코스마다 다음 Drop을 보여 주고, 그중 하나만 '내일 받아요'.
 * 쉬는 중인 코스의 '이 코스로 받기'를 누르면 내일은 그 코스의 Drop을 받는다 (하루 한 편).
 * 코스가 하나면 고를 게 없으니 안내 카드만 보여 준다
 */
export function TomorrowList({ items, tomorrowId }: { items: TomorrowItem[]; tomorrowId?: string }) {
  const [on, setOn] = useState(tomorrowId ?? items[0]?.id);

  const pick = (id: string) => {
    if (id === on) return;
    setOn(id);
    void postJson('/api/tomorrow/pick', { courseId: id });
  };

  return (
    <>
      {items.map(c => {
        const active = items.length === 1 || c.id === on;
        return (
          <div
            key={c.id}
            className={cx(
              'flex min-h-[76px] w-full items-center gap-3.5 rounded-card py-3.5 pl-4 pr-3.5',
              active ? 'border-[1.5px] border-fuse-ink bg-shape-white' : 'border border-fuse-line bg-fuse-card',
            )}
          >
            <CatIcon category={c.category} />
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[13px] text-fuse-sub">
                {c.topic} · Drop {c.index + 1} / {c.total}
              </span>
              <span className={cx('text-sm font-medium leading-[1.3]', active ? '' : 'text-fuse-sub')}>{c.title}</span>
              <span className={cx('text-[13px] font-medium', active ? 'text-fuse-hot' : 'text-fuse-faint')}>
                {items.length === 1 ? '내일 0시에 열려요' : active ? '내일 받아요' : '쉬는 중'}
              </span>
            </span>
            {active ? null : (
              <button
                type="button"
                onClick={() => pick(c.id)}
                aria-label={`내일 ${c.topic} 코스로 받기`}
                className="mc-press h-10 flex-shrink-0 rounded-full bg-fuse-ink px-4 text-sm font-semibold text-txt-white-primary"
              >
                이 코스로 받기
              </button>
            )}
          </div>
        );
      })}
      {items.length > 1 ? <p className="mt-0.5 text-[13px] text-fuse-sub">하루 한 편, 고른 코스로 받아요. 쉬는 중인 코스도 진도는 그대로예요.</p> : null}
    </>
  );
}
