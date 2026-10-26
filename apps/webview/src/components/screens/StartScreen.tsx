'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { checkTopic, levelHref } from '@/lib/client/start';
import { josa } from '@/lib/josa';
import type { Recommended } from '@/lib/learning';

import Link from 'next/link';

import { LimitSheet, MonthlySheet, ReplaceSheet } from '../QuotaSheets';
import { AppHeader, BottomNav, Main, PrimaryButton, Screen } from '../ui';

type Props = {
  initialTopic: string;
  suggestions: string[];
  quota: 'ok' | 'free' | 'over' | 'monthly' | 'daily';
  currentTopic?: string;
  replace?: boolean;
  /** Plus 새 코스가 다시 채워지는 날 */
  resetLabel?: string;
  /** 다른 사람들이 만든 추천 코스 */
  recommended?: Recommended[];
};

export function StartScreen({ initialTopic, suggestions, quota, currentTopic, replace, resetLabel, recommended = [] }: Props) {
  const router = useRouter();
  const [topic, setTopic] = useState(initialTopic);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ message: string; suggestions: string[] } | null>(null);
  const [sheet, setSheet] = useState<null | { kind: 'free' | 'monthly' | 'daily' | 'over'; replaceHref: string }>(null);
  const trimmed = topic.trim();
  const limitNote =
    quota === 'free' && currentTopic && !replace
      ? `무료는 한 번에 코스 1개를 배울 수 있어요. 지금 ‘${currentTopic}’${josa(currentTopic, '을/를').slice(currentTopic.length)} 배우는 중이라, 새 코스를 만들면 지금 코스는 지워져요. 단계와 다 배운 주제는 남아요.`
      : quota === 'daily'
        ? resetLabel
          ? '새 코스는 하루에 1개까지 만들 수 있어요. 오늘은 이미 만들었어요.'
          : '주제 바꾸기는 하루에 1번까지 할 수 있어요. 내일 다시 바꿀 수 있어요.'
        : quota === 'over'
          ? '진행 중인 코스가 여러 개예요. 무료는 진행 중인 코스가 1개 이하일 때 새 코스를 만들 수 있어요.'
          : '';

  const go = async (input: string) => {
    if (!input.trim() || busy) return;
    setBusy(true);
    setNotice(null);
    const r = await checkTopic(input.trim());
    setBusy(false);
    if (r.status === 'error') {
      setNotice({ message: '잠시 연결이 불안정해요. 다시 시도해 주세요.', suggestions: [] });
      return;
    }
    if (r.status === 'blocked') {
      setNotice({ message: r.message ?? '이 주제는 미니커버리에서 다루지 않아요.', suggestions: r.suggestions });
      return;
    }
    if (r.status === 'broad') {
      router.push(`/start/broad?${new URLSearchParams({ topic: r.topic, s: r.suggestions.join('|'), ...(replace ? { replace: '1' } : {}) })}`);
      return;
    }
    if (quota === 'free' && replace) {
      router.push(levelHref(r, true));
      return;
    }
    if (quota === 'free') {
      setSheet({ kind: 'free', replaceHref: levelHref(r, true) });
      return;
    }
    if (quota === 'monthly' || quota === 'daily' || quota === 'over') {
      setSheet({ kind: quota, replaceHref: '' });
      return;
    }
    router.push(levelHref(r));
  };

  return (
    <Screen>
      <AppHeader layout="logo" />
      <Main className="pb-10 pt-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-[28px] font-bold leading-9 tracking-[-1px]">
            요즘 뭐가
            <br />
            궁금하세요?
          </h1>
          <p className="text-base text-txt-black-secondary">입력한 주제를 하루 한 편씩 읽는 코스로 만들어 드려요.</p>
        </div>

        {limitNote ? (
          // 한도를 주제를 다 입력하기 전에 알린다
          <p className="mt-6 rounded-2xl bg-shape-depth1 px-5 py-4 text-sm text-txt-black-secondary">
            {limitNote}{' '}
            {quota === 'free' || quota === 'over' ? (
              <Link href="/plus?from=keep" className="font-semibold text-txt-point">
                Plus로 여러 코스 함께 배우기
              </Link>
            ) : null}
          </p>
        ) : null}

        <form
          className={limitNote ? 'mt-6 flex flex-col gap-3' : 'mt-8 flex flex-col gap-3'}
          onSubmit={e => {
            e.preventDefault();
            void go(topic);
          }}
        >
          <label htmlFor="topic" className="sr-only">
            궁금한 주제
          </label>
          <input
            id="topic"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            maxLength={100}
            enterKeyHint="go"
            placeholder="예: 금리가 오르면 환율은 왜 움직일까"
            className="h-14 w-full rounded-2xl border bg-shape-white px-4 text-base text-txt-black-primary outline-none"
            style={{ borderColor: trimmed ? '#20967A' : '#DEDFEB' }}
          />
          <PrimaryButton disabled={!trimmed} onClick={() => void go(topic)}>
            {busy ? '주제를 살펴보는 중…' : '코스 만들기'}
          </PrimaryButton>
        </form>

        {notice ? (
          <div className="mc-in mt-4 rounded-2xl bg-shape-depth1 p-4">
            <p className="text-sm text-txt-black-secondary">{notice.message}</p>
            {notice.suggestions.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {notice.suggestions.map(s => (
                  <button key={s} type="button" onClick={() => void go(s)} className="min-h-11 rounded-full bg-shape-white px-4 py-3 text-sm">
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        {recommended.length ? (
          <section className="mt-10 flex flex-col gap-3">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-sm font-bold text-txt-black-secondary">다른 사람들이 만든 코스</h2>
              <p className="text-sm text-txt-black-secondary">바로 받아서 첫 Drop을 읽을 수 있어요.</p>
            </div>
            {recommended.map(r => (
              <Link key={r.id} href={`/recommend/${r.id}`} className="mc-press flex items-center gap-3 rounded-2xl border border-border-button py-4 pl-5 pr-4">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-sm font-semibold text-txt-black-tertiary">
                    {r.category} · {r.total}편
                  </span>
                  <span className="text-base font-semibold">{r.title}</span>
                  {r.copies ? <span className="text-sm text-txt-point">{r.copies}명이 받았어요</span> : null}
                </span>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="flex-shrink-0">
                  <path d="m9 5 7 7-7 7" stroke="#B4B5C1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </Link>
            ))}
          </section>
        ) : null}

        <section className={recommended.length ? 'mt-8 flex flex-col gap-3' : 'mt-12 flex flex-col gap-3'}>
          <h2 className="text-sm font-bold text-txt-black-secondary">{recommended.length ? '직접 만들 주제 예시' : '이런 주제는 어때요?'}</h2>
          <div className="flex flex-wrap gap-2">
            {suggestions.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => {
                  setTopic(s);
                  void go(s);
                }}
                className="mc-press inline-flex min-h-11 items-center rounded-full bg-shape-depth1 px-4 py-3 text-sm text-txt-black-primary"
              >
                {s}
              </button>
            ))}
          </div>
        </section>
      </Main>
      <BottomNav active="explore" />
      <ReplaceSheet
        open={sheet?.kind === 'free'}
        onClose={() => setSheet(null)}
        courseTopic={currentTopic}
        replaceHref={sheet?.replaceHref ?? '/start'}
      />
      <MonthlySheet open={sheet?.kind === 'monthly'} onClose={() => setSheet(null)} resetLabel={resetLabel} />
      <LimitSheet
        kind={sheet?.kind === 'daily' || sheet?.kind === 'over' ? sheet.kind : null}
        onClose={() => setSheet(null)}
        plus={Boolean(resetLabel)}
      />
    </Screen>
  );
}
