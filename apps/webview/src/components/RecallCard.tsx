'use client';

import { useState } from 'react';

import { cx } from './ui';

/** 서버 recallFor·todayData가 주는 되짚기. 옛 모양(concept·takeaway만)도 받는다 */
export type RecallLike = {
  concept: string;
  takeaway: string;
  /** Drop 전체 제목 (없으면 concept) */
  title?: string;
  courseTopic?: string;
  /** 지금 읽는(또는 오늘 받을) 코스와 같은 코스인지 */
  sameCourse?: boolean;
  /** 'yesterday' 또는 'M월 D일' */
  when?: string;
  dropId?: string;
};

/** 되짚기: 지난번에 읽은 Drop의 '한 문장으로'를 가려 두고, 떠올린 뒤 확인한다 (채점하지 않음) */
export function RecallCard({ recall, id, className = 'mb-6' }: { recall: RecallLike; id?: string; className?: string }) {
  const [shown, setShown] = useState(false);
  const yesterday = !recall.when || recall.when === 'yesterday';
  const label = yesterday ? '어제 되짚기' : `${recall.when} 되짚기`;
  const from = recall.sameCourse === false && recall.courseTopic ? `‘${recall.courseTopic}’에서` : '';
  return (
    <section id={id} aria-label={label} className={cx('flex flex-col gap-2 rounded-card border border-fuse-line bg-fuse-card p-4', className)}>
      <p className="text-[13px] font-medium text-fuse-sub">
        {label} · {from ? `${from} ` : ''}
        {recall.title ?? recall.concept}
      </p>
      <p className="text-base font-semibold leading-[1.3]">{yesterday ? '어제 배운 내용, 한 문장으로 떠올려 볼까요?' : '지난번에 배운 내용, 한 문장으로 떠올려 볼까요?'}</p>
      {shown ? (
        <p className="mc-in mt-1 rounded-card border border-fuse-line bg-shape-white p-4 text-base font-semibold">{recall.takeaway}</p>
      ) : (
        <button
          type="button"
          onClick={() => setShown(true)}
          className="mc-press mt-1 h-10 self-start rounded-full bg-fuse-ink px-4 text-sm font-semibold text-txt-white-primary"
        >
          떠올렸어요 · 확인하기
        </button>
      )}
    </section>
  );
}
