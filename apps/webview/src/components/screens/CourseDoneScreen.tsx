'use client';

import { useState } from 'react';

import { postJson } from '@/lib/client/ndjson';
import type { ExplainAnswer } from '@/lib/types';

import { AppHeader, CHARACTER, Main, OutlineButton, Screen, cx } from '../ui';

const ANSWERS: [ExplainAnswer, string][] = [
  ['yes', '예'],
  ['some', '조금'],
  ['not_yet', '아직'],
];

const REPLIES: Record<ExplainAnswer, string> = {
  yes: '좋아요! 한 문장 요약을 떠올리면 더 오래 기억나요.',
  some: '충분해요. 헷갈린 Drop은 언제든 다시 읽을 수 있어요.',
  not_yet: '괜찮아요. 다시 읽고 싶은 Drop부터 천천히 봐요.',
};

export function CourseDoneScreen(props: {
  courseId: string;
  learnedCount: number;
  stageKey: 'rabbit' | 'cat';
  next: { name: string; left: number; min: number } | null;
  related: string[];
  plus: boolean;
  first: boolean;
  answer: ExplainAnswer | null;
}) {
  const [answer, setAnswer] = useState(props.answer);
  const ch = CHARACTER[props.stageKey];
  const nextKey = props.stageKey === 'rabbit' ? 'cat' : null;

  return (
    <Screen>
      <AppHeader layout="nav" close="/today" />
      <Main className="pb-8 pt-2">
        <section className="flex flex-shrink-0 flex-col items-center rounded-2xl bg-shape-brand px-5 pb-7 pt-6 text-center text-txt-white-primary">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ch.full} alt={`기뻐하는 ${ch.name} 캐릭터`} className="mc-pop aspect-square w-[min(176px,44vw)] object-contain" />
          <h1 className="mt-3 text-[28px] font-bold leading-9 tracking-[-1px]">{props.first ? '첫 주제를 다 배웠어요!' : '주제를 하나 더 다 배웠어요!'}</h1>
          <p className="mt-2 text-base font-semibold">
            {props.next ? `주제 ${props.next.left}개를 더 배우면 ${props.next.name}로 성장해요.` : `다 배운 주제가 ${props.learnedCount}개가 됐어요.`}
          </p>
          {props.next && nextKey ? (
            <div className="mt-4 flex items-center gap-2 self-stretch">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.3)]">
                <div className="h-full rounded-full bg-shape-white" style={{ width: `${Math.round((props.learnedCount / props.next.min) * 100)}%` }} />
              </div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={CHARACTER[nextKey].still} alt={`다음 단계 ${props.next.name}`} className="h-8 w-8 flex-shrink-0 object-contain opacity-70 brightness-150 grayscale" />
            </div>
          ) : null}
        </section>

        <section className="mt-8 flex flex-col">
          <p className="text-base font-semibold">이제 이 주제를 남에게 대략 설명할 수 있나요?</p>
          <div role="radiogroup" aria-label="설명할 수 있는지" className="mt-3 grid grid-cols-3 gap-2">
            {ANSWERS.map(([v, label]) => {
              const on = answer === v;
              return (
                <button
                  key={v}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setAnswer(v);
                    void postJson(`/api/courses/${props.courseId}/explain`, { answer: v });
                  }}
                  className={cx(
                    'h-12 rounded-full border text-sm',
                    on ? 'border-border-brand bg-shape-depth1 font-bold text-txt-point' : 'border-border-button bg-shape-white text-txt-black-primary',
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {answer ? <p className="mt-3 text-sm text-txt-point">{REPLIES[answer]}</p> : null}
        </section>

        {props.related.length ? (
          <section className="mt-10 flex flex-col gap-3">
            <h2 className="text-lg font-semibold">다음엔 이걸 알아볼까요?</h2>
            <div className="flex flex-col gap-2">
              {props.related.map(r => (
                <a
                  key={r}
                  href={`/start?topic=${encodeURIComponent(r)}`}
                  className="mc-press flex items-center justify-between gap-3 rounded-2xl border border-border-button px-5 py-4"
                >
                  <span className="text-lg font-semibold">{r}</span>
                  <span className="flex-shrink-0 text-sm font-bold text-txt-point">시작하기</span>
                </a>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-8 flex flex-col">
          <OutlineButton href="/start">{props.plus ? '새 주제로 코스 만들기' : '무료로 새 주제 시작하기'}</OutlineButton>
          <p className="mt-2 text-center text-sm text-txt-black-secondary">
            이 코스는 ‘다 배운 코스’에 남아요.{props.plus ? '' : ' 무료는 한 번에 코스 1개를 배울 수 있어요.'}
          </p>
          {props.plus ? null : (
            <a href="/plus?from=done" className="mt-1 flex min-h-11 items-center self-center px-3 text-sm font-semibold text-txt-point">
              Plus로 여러 코스 함께 배우기
            </a>
          )}
        </section>
      </Main>
    </Screen>
  );
}
