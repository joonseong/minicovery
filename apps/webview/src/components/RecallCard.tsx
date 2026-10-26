'use client';

import { useState } from 'react';

import type { Recall } from '@/lib/learning';

/** 어제 되짚기: 어제 읽은 Drop의 '한 문장으로'를 가려 두고, 떠올린 뒤 확인한다 (채점하지 않음) */
export function RecallCard({ recall }: { recall: Recall }) {
  const [shown, setShown] = useState(false);
  return (
    <section aria-label="어제 되짚기" className="mb-6 flex flex-col gap-2 rounded-2xl bg-shape-depth1 px-5 py-4">
      <p className="text-sm font-bold text-txt-point">어제 되짚기 · {recall.concept}</p>
      <p className="text-base font-semibold">어제 배운 내용, 한 문장으로 떠올려 볼까요?</p>
      {shown ? (
        <p className="mc-in rounded-xl bg-shape-white px-4 py-3 text-base">{recall.takeaway}</p>
      ) : (
        <button
          type="button"
          onClick={() => setShown(true)}
          className="mc-press h-10 self-start rounded-full border border-border-button bg-shape-white px-4 text-sm font-semibold"
        >
          떠올렸어요 · 확인하기
        </button>
      )}
    </section>
  );
}
