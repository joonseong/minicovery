'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { checkTopic, levelHref } from '@/lib/client/start';
import { josa } from '@/lib/josa';
import type { Recommended } from '@/lib/learning';

import Link from 'next/link';

import { LimitSheet, MonthlySheet, ReplaceSheet } from '../QuotaSheets';
import { AppHeader, BottomNav, Main, PrimaryButton, Screen, Toast, useToast } from '../ui';

const MAX = 100;

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
  /** 추천·안개 주제로 들어옴(?go=1): 주제 검사→수준 선택까지 바로 진행 */
  autoGo?: boolean;
  /** 도착하자마자 한 번 보여 줄 안내 (계정 삭제·로그아웃 뒤) */
  notice?: string;
};

export function StartScreen({ initialTopic, suggestions, quota, currentTopic, replace, resetLabel, recommended = [], autoGo, notice: arrivalNotice }: Props) {
  const router = useRouter();
  const [topic, setTopic] = useState(initialTopic);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ message: string; suggestions: string[] } | null>(null);
  const [sheet, setSheet] = useState<null | { kind: 'free' | 'monthly' | 'daily' | 'over'; replaceHref: string }>(null);
  const [toast, showToast] = useToast();
  const autoRan = useRef(false);
  const trimmed = topic.trim();
  // 이번 달 3개를 다 만들었으면 입력 전에 막는다 (AI 검사까지 돌리지 않는다)
  const blocked = quota === 'monthly';
  const limitNote =
    quota === 'free' && currentTopic && !replace
      ? `무료는 한 번에 코스 1개를 배울 수 있어요. 지금 ‘${currentTopic}’${josa(currentTopic, '을/를').slice(currentTopic.length)} 배우는 중이라, 새 코스를 만들면 지금 코스는 지워져요. 단계와 다 배운 주제는 남아요.`
      : quota === 'monthly'
        ? `Plus 새 코스 3개를 다 만들었어요. ${resetLabel ?? '다음 달'}에 다시 3개가 채워져요.`
        : quota === 'daily'
          ? resetLabel
            ? '새 코스는 하루에 1개까지 만들 수 있어요. 오늘은 이미 만들었어요.'
            : '주제 바꾸기는 하루에 1번까지 할 수 있어요. 내일 다시 바꿀 수 있어요.'
          : quota === 'over'
            ? '진행 중인 코스가 여러 개예요. 무료는 진행 중인 코스가 1개 이하일 때 새 코스를 만들 수 있어요.'
            : '';

  // 수준 선택에서 뒤로 오면 주제가 그대로 남게, 떠나기 전에 주소에 적어 둔다
  const remember = (input: string) => {
    const q = new URLSearchParams({ topic: input });
    if (replace) q.set('replace', '1');
    window.history.replaceState(null, '', `/start?${q}`);
  };

  const go = async (input: string) => {
    if (!input.trim() || busy || blocked) return;
    setBusy(true);
    setNotice(null);
    const r = await checkTopic(input.trim());
    setBusy(false);
    remember(input.trim());
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
    // monthly는 위에서 입력 자체를 막는다
    if (quota === 'daily' || quota === 'over') {
      setSheet({ kind: quota, replaceHref: '' });
      return;
    }
    router.push(levelHref(r));
  };

  // 추천·안개 주제(?go=1): 버튼을 한 번 더 누르지 않게 바로 검사한다.
  // 주소에서 go를 지워 두어 수준 선택에서 뒤로 오면 주제만 채워진 채 멈춘다 (되돌이표 방지)
  useEffect(() => {
    if (!autoGo || autoRan.current || !initialTopic.trim()) return;
    autoRan.current = true;
    remember(initialTopic.trim());
    void go(initialTopic);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (arrivalNotice) showToast(arrivalNotice);
  }, [arrivalNotice, showToast]);

  return (
    <Screen className="relative">
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
          <div className="flex flex-col gap-1">
            <input
              id="topic"
              value={topic}
              onChange={e => setTopic(e.target.value.slice(0, MAX))}
              maxLength={MAX}
              disabled={blocked}
              enterKeyHint="go"
              placeholder="예: 금리가 오르면 환율은 왜 움직일까"
              aria-describedby="topic-count"
              className="h-14 w-full rounded-2xl border bg-shape-white px-4 text-base text-txt-black-primary outline-none disabled:bg-shape-depth1 disabled:text-txt-black-tertiary"
              style={{ borderColor: trimmed && !blocked ? '#20967A' : '#DEDFEB' }}
            />
            <div id="topic-count" className="flex items-start justify-between gap-3 px-1">
              <span className="text-sm text-txt-black-secondary">{topic.length >= MAX ? `주제는 ${MAX}자까지 쓸 수 있어요. 핵심 단어로 줄여 볼까요?` : ''}</span>
              <span className={topic.length >= MAX ? 'flex-shrink-0 text-sm font-semibold text-txt-error' : 'flex-shrink-0 text-sm text-txt-black-tertiary'}>
                {topic.length}/{MAX}
              </span>
            </div>
          </div>
          <PrimaryButton disabled={!trimmed || blocked} onClick={() => void go(topic)}>
            {busy ? '주제를 살펴보는 중…' : blocked ? `${resetLabel ?? '다음 달'}부터 만들 수 있어요` : '코스 만들기'}
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
                disabled={blocked}
                onClick={() => {
                  setTopic(s);
                  void go(s);
                }}
                className="mc-press inline-flex min-h-11 items-center rounded-full bg-shape-depth1 px-4 py-3 text-sm text-txt-black-primary disabled:text-txt-black-tertiary"
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
      <Toast message={toast} />
    </Screen>
  );
}
