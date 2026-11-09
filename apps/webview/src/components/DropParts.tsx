'use client';

import { splitPoints } from '@/lib/drop-format';
import type { DropBody, Source } from '@/lib/types';

import { CatIcon } from './CatIcon';
import { Sheet, TextButton, cx } from './ui';

/* Drop 화면 조각: 내 Drop(DropScreen)과 다른 사람이 만든 코스 열람(SharedDropScreen)이 같이 쓴다 */

const SECTIONS: { key: keyof DropBody; label: string }[] = [
  { key: 'concept', label: '핵심 개념' },
  { key: 'example', label: '예를 들면' },
  { key: 'connection', label: '이어서 생각하기' },
];

/** 모델이 가끔 넣는 마크다운 굵게 표시(**…**)는 글자만 남긴다 (운영 Drop 61편 중 5편, 2026-11-07) */
const plain = (text: string) => text.replace(/\*\*([\s\S]+?)\*\*/g, '$1');

export type ReportReason = 'wrong' | 'unclear' | 'inappropriate';

const REPORT_REASONS: { key: ReportReason; label: string; desc: string }[] = [
  { key: 'wrong', label: '틀린 사실이 있어요', desc: '숫자·이름·설명이 사실과 달라요' },
  { key: 'unclear', label: '이해가 안 돼요', desc: '설명이 어렵거나 앞뒤가 안 맞아요' },
  { key: 'inappropriate', label: '부적절한 내용이에요', desc: '불쾌하거나 다루면 안 되는 내용이에요' },
];

/** 진행 줄: 분야 아이콘 · Drop n / 전체 · 막대 (n은 1부터) */
export function DropProgress({ category, n, total }: { category: string; n: number; total: number }) {
  return (
    <div className="flex items-center gap-3">
      <CatIcon category={category} />
      <span className="text-sm font-medium leading-[1.3]">
        Drop {n}
        <span className="text-fuse-mute"> / {total}</span>
      </span>
      <span aria-hidden="true" className="h-1.5 flex-1 overflow-hidden rounded-full bg-fuse-track">
        <span className="block h-full rounded-full bg-fuse-ink" style={{ width: `${Math.round((n / Math.max(1, total)) * 100)}%` }} />
      </span>
    </div>
  );
}

/** Drop 본문: 도입 → 핵심 개념 → 예를 들면 → 이어서 생각하기 → 정리하기 */
export function DropArticle({ body, className }: { body: Partial<DropBody>; className?: string }) {
  const points = splitPoints(body.points);
  return (
    <article className={cx('flex flex-col gap-8', className)}>
      {body.hook ? <p className="whitespace-pre-line text-base font-semibold">{plain(body.hook)}</p> : null}
      {SECTIONS.map(s =>
        body[s.key] ? (
          <section key={s.key} className="flex flex-col gap-2.5">
            <h2 className="text-[13px] font-medium text-fuse-sub">{s.label}</h2>
            <p className="whitespace-pre-line text-base">{plain(body[s.key]!)}</p>
          </section>
        ) : null,
      )}
      {body.takeaway ? (
        <section className="flex flex-col gap-2 rounded-card border border-fuse-line bg-fuse-card p-4">
          <h2 className="text-[13px] font-medium text-fuse-sub">정리하기</h2>
          <p className="text-xl font-bold leading-[1.3]">{plain(body.takeaway)}</p>
          {points.length ? (
            <ul className="mt-2 flex flex-col gap-1.5 border-t border-fuse-line pt-3">
              {points.map((pt, i) => (
                <li key={i} className="flex gap-2 text-sm">
                  <span aria-hidden className="shrink-0 text-fuse-faint">–</span>
                  <span>{plain(pt)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
    </article>
  );
}

/** 출처 · AI가 만든 콘텐츠 표시 · 신고 버튼 */
export function DropSources({ sources, corrected, reported, onReport }: { sources: Source[]; corrected?: boolean; reported: boolean; onReport: () => void }) {
  return (
    <section className="mt-10 flex flex-col">
      <h2 className="mb-1 text-[13px] font-medium text-fuse-sub">출처 · 더 알아보기</h2>
      {sources.map(s => (
        <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="flex min-h-[52px] items-center gap-3 border-b border-[#F2F2F4] text-sm">
          <span className="min-w-0 flex-1">{s.title}</span>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="flex-shrink-0">
            <path d="M4 10 10 4M5 4h5v5" stroke="#AEAEB2" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </a>
      ))}
      <div className="mt-1 flex items-center justify-between gap-3">
        <p className="text-[13px] text-fuse-faint">AI가 만든 콘텐츠예요{corrected ? ' · 내용을 다시 확인해 고쳤어요' : ''}</p>
        <button
          type="button"
          disabled={reported}
          onClick={onReport}
          className={reported ? 'min-h-11 flex-shrink-0 text-[13px] text-fuse-sub' : 'min-h-11 flex-shrink-0 text-[13px] text-fuse-sub underline'}
        >
          {reported ? '신고했어요' : '내용이 이상해요'}
        </button>
      </div>
    </section>
  );
}

/** '내용이 이상해요' 사유 고르기 */
export function ReportSheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (reason: ReportReason) => void }) {
  return (
    <Sheet open={open} onClose={onClose} labelledBy="reportTitle">
      <h2 id="reportTitle" className="mt-6 text-2xl font-bold leading-[1.3]">
        어떤 점이 이상했나요?
      </h2>
      <p className="mt-1 text-sm text-fuse-sub">알려 주시면 확인하고 고칠게요.</p>
      <div className="mt-5 flex flex-col gap-2">
        {REPORT_REASONS.map(r => (
          <button
            key={r.key}
            type="button"
            onClick={() => onPick(r.key)}
            className="mc-press flex min-h-14 flex-col items-start justify-center gap-0.5 rounded-card border border-fuse-line bg-fuse-card px-4 py-3 text-left"
          >
            <span className="text-base font-semibold leading-[1.3]">{r.label}</span>
            <span className="text-[13px] text-fuse-sub">{r.desc}</span>
          </button>
        ))}
      </div>
      <TextButton onClick={onClose} className="mt-2">
        취소
      </TextButton>
    </Sheet>
  );
}
