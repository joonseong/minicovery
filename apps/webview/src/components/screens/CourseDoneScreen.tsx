'use client';

import { useState } from 'react';

import { postJson } from '@/lib/client/ndjson';
import type { ExplainAnswer } from '@/lib/types';

import { CatIcon } from '../CatIcon';
import { Doodle } from '../Doodle';
import { AppHeader, CHARACTER, Main, OutlineButton, PrimaryButton, Progress, Screen, cx } from '../ui';

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
  /** 다음 추천 주제 아이콘: 완주한 코스의 분야 */
  category: string;
  plus: boolean;
  first: boolean;
  answer: ExplainAnswer | null;
  /** 추천 코스로 내놓기를 켰는지 */
  shared: boolean;
  /** 추천 코스를 받아 읽은 코스면 다시 추천에 내놓지 않는다 */
  copied: boolean;
}) {
  const [answer, setAnswer] = useState(props.answer);
  const [shared, setShared] = useState(props.shared);
  const [notice, setNotice] = useState('');

  const share = async () => {
    const res = await postJson<{ url?: string }>(`/api/courses/${props.courseId}/share-link`);
    const url = res.data.url;
    if (!url) return;
    const text = '하루 한 편씩 끝까지 읽었어요. 미니커버리';
    try {
      if (navigator.share) {
        await navigator.share({ url, text });
        return;
      }
    } catch {
      return; // 공유 창을 닫음
    }
    await navigator.clipboard?.writeText(url).catch(() => undefined);
    setNotice('링크를 복사했어요. 카톡이나 인스타에 붙여 넣어 보세요.');
  };
  const ch = CHARACTER[props.stageKey];
  const nextKey = props.stageKey === 'rabbit' ? 'cat' : null;

  return (
    <Screen>
      <AppHeader layout="nav" close="/today" />
      <Main className="pb-12 pt-6">
        <section className="flex flex-col">
          <Doodle animal={props.stageKey} act="cheer" label={`기뻐하는 ${ch.name} 캐릭터`} className="mc-pop h-[120px] w-[120px]" />
          <h1 className="mt-6 text-[28px] font-bold leading-[1.3]">{props.first ? '첫 주제를 다 배웠어요!' : '주제를 하나 더 다 배웠어요!'}</h1>
          <p className="mt-2 text-sm text-fuse-sub">
            {props.next ? `주제 ${props.next.left}개를 더 배우면 ${props.next.name}로 성장해요.` : `다 배운 주제가 ${props.learnedCount}개가 됐어요.`}
          </p>
          {props.next && nextKey ? (
            <div className="mt-5 flex items-center gap-3">
              <Progress value={props.learnedCount / props.next.min} />
              <Doodle animal={nextKey} still label={`다음 단계 ${props.next.name}`} className="h-8 w-8 flex-shrink-0 opacity-50 grayscale" />
            </div>
          ) : null}
        </section>
        <PrimaryButton className="mt-6" onClick={() => void share()}>
          완주 카드 공유하기
        </PrimaryButton>
        {notice ? <p className="mt-2 text-center text-[13px] text-fuse-sub">{notice}</p> : null}

        <section className="mt-9 flex flex-col">
          <p className="text-base font-semibold leading-[1.3]">이제 이 주제를 남에게 대략 설명할 수 있나요?</p>
          <div role="radiogroup" aria-label="설명할 수 있는지" className="mt-3.5 grid grid-cols-3 gap-2">
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
                    'mc-press h-12 rounded-full border text-sm',
                    on ? 'border-fuse-ink bg-fuse-ink font-semibold text-txt-white-primary' : 'border-fuse-edge bg-shape-white font-medium text-fuse-ink',
                  )}
                >
                  {label}
                </button>
              );
            })}
          </div>
          {answer ? <p className="mt-3 text-sm text-fuse-hot">{REPLIES[answer]}</p> : null}
        </section>

        {props.related.length ? (
          <section className="mt-9 flex flex-col gap-3">
            <h2 className="text-base font-semibold leading-[1.3]">다음엔 이걸 알아볼까요?</h2>
            <div className="grid grid-cols-2 gap-2.5">
              {/* go=1: 새 코스 화면이 주제 검사→수준 선택까지 바로 진행한다 */}
              {props.related.map(r => (
                <a
                  key={r}
                  href={`/start?topic=${encodeURIComponent(r)}&go=1`}
                  className="mc-press flex min-h-[128px] flex-col justify-between gap-3 rounded-card border border-fuse-line bg-fuse-card p-4"
                >
                  <CatIcon category={props.category} />
                  <span className="flex flex-col gap-0.5">
                    <span className="text-base font-semibold leading-[1.3]">{r}</span>
                    <span className="text-[13px] font-medium text-fuse-sub">시작하기</span>
                  </span>
                </a>
              ))}
            </div>
          </section>
        ) : null}

        {props.copied ? null : (
          <label className="mt-6 flex cursor-pointer items-start gap-3 rounded-card border border-fuse-line bg-fuse-card p-4">
            <input
              type="checkbox"
              checked={shared}
              onChange={e => {
                setShared(e.target.checked);
                void postJson(`/api/courses/${props.courseId}/share`, { on: e.target.checked });
              }}
              className="mt-0.5 h-5 w-5 flex-shrink-0 accent-[#0B0B0C]"
            />
            <span className="flex flex-col gap-1">
              <span className="text-sm font-medium leading-[1.3]">이 코스를 다른 사람에게 추천하기</span>
              <span className="text-[13px] text-fuse-sub">내 이름 없이 코스 목차와 Drop만 추천 코스로 보여 줘요. 언제든 끌 수 있어요.</span>
            </span>
          </label>
        )}

        <section className="mt-8 flex flex-col">
          <OutlineButton href="/start">{props.plus ? '새 주제로 코스 만들기' : '무료로 새 주제 시작하기'}</OutlineButton>
          <p className="mt-2.5 text-center text-[13px] text-fuse-sub">
            이 코스는 ‘다 배운 코스’에 남아요.{props.plus ? '' : ' 무료는 한 번에 코스 1개를 배울 수 있어요.'}
          </p>
          {props.plus ? null : (
            <a href="/plus?from=done" className="mt-1 flex min-h-11 items-center gap-1 self-center px-3 text-sm font-medium text-fuse-ink">
              Plus로 여러 코스 함께 배우기
            </a>
          )}
        </section>
      </Main>
    </Screen>
  );
}
