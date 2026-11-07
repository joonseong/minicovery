'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { checkTopic, levelHref } from '@/lib/client/start';
import { josa } from '@/lib/josa';
import type { Recommended } from '@/lib/learning';

import { LimitSheet, MonthlySheet, ReplaceSheet } from '../QuotaSheets';
import { RecommendList } from '../RecommendList';
import { BottomNav, Main, PrimaryButton, Screen, Toast, useToast } from '../ui';

const MAX = 100;

type Props = {
  initialTopic: string;
  suggestions: string[];
  quota: 'ok' | 'free' | 'over' | 'monthly' | 'daily';
  currentTopic?: string;
  replace?: boolean;
  /** Plus 새 코스가 다시 채워지는 날 */
  resetLabel?: string;
  /** 다른 사람들이 만든 추천 코스 (첫 20개, 많이 눌러본 순) */
  recommended?: Recommended[];
  /** 더 불러올 추천 코스가 있음 (아래로 내리면 20개씩) */
  recommendedMore?: boolean;
  /** 추천·안개 주제로 들어옴(?go=1): 주제 검사→수준 선택까지 바로 진행 */
  autoGo?: boolean;
  /** 도착하자마자 한 번 보여 줄 안내 (계정 삭제·로그아웃 뒤) */
  notice?: string;
};

export function StartScreen({
  initialTopic,
  suggestions,
  quota,
  currentTopic,
  replace,
  resetLabel,
  recommended = [],
  recommendedMore = false,
  autoGo,
  notice: arrivalNotice,
}: Props) {
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
      <Main className="pb-32 pt-6">
        <div className="flex flex-col gap-2.5">
          <h1 className="text-[28px] font-bold leading-[1.3]">
            요즘 뭐가
            <br />
            궁금하세요?
          </h1>
          <p className="text-sm text-fuse-sub">입력한 주제를 하루 한 편씩 읽는 코스로 만들어 드려요.</p>
        </div>

        {limitNote ? (
          // 한도를 주제를 다 입력하기 전에 알린다
          <div className="mt-6 flex gap-3 rounded-card border border-fuse-line bg-fuse-card p-4">
            <span className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-[9px] bg-fuse-ink">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 8v5M12 16.5h.01" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </span>
            <p className="min-w-0 flex-1 text-[13px] text-fuse-sub">
              {limitNote}{' '}
              {quota === 'free' || quota === 'over' ? (
                <Link href="/plus?from=keep" className="font-bold text-fuse-ink">
                  Plus로 여러 코스 함께 배우기
                </Link>
              ) : null}
            </p>
          </div>
        ) : null}

        <form
          className={limitNote ? 'mt-5 flex flex-col gap-2.5' : 'mt-6 flex flex-col gap-2.5'}
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
              className="h-14 w-full rounded-[18px] border bg-shape-white px-[18px] text-base text-fuse-ink outline-none disabled:bg-fuse-card disabled:text-fuse-faint"
              style={{ borderColor: trimmed && !blocked ? '#0B0B0C' : '#E3E3E6' }}
            />
            <div id="topic-count" className="flex items-start justify-between gap-3 px-1">
              <span className="text-[13px] text-fuse-sub">{topic.length >= MAX ? `주제는 ${MAX}자까지 쓸 수 있어요. 핵심 단어로 줄여 볼까요?` : ''}</span>
              <span className={topic.length >= MAX ? 'flex-shrink-0 text-[13px] font-semibold text-fuse-hot' : 'flex-shrink-0 text-[13px] text-fuse-faint'}>
                {topic.length}/{MAX}
              </span>
            </div>
          </div>
          <PrimaryButton disabled={!trimmed || blocked} onClick={() => void go(topic)}>
            {busy ? '주제를 살펴보는 중…' : blocked ? `${resetLabel ?? '다음 달'}부터 만들 수 있어요` : '코스 만들기'}
          </PrimaryButton>
        </form>

        {notice ? (
          <div className="mc-in mt-4 rounded-card border border-fuse-line bg-fuse-card p-4">
            <p className="text-sm text-fuse-sub">{notice.message}</p>
            {notice.suggestions.length ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {notice.suggestions.map(s => (
                  <button key={s} type="button" onClick={() => void go(s)} className="min-h-11 rounded-full bg-shape-white px-4 text-sm font-medium">
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <RecommendList items={recommended} hasMore={recommendedMore} className="mt-9" />

        <section className={recommended.length ? 'mt-8 flex flex-col gap-3' : 'mt-10 flex flex-col gap-3'}>
          <h2 className="text-base font-semibold leading-[1.3]">{recommended.length ? '직접 만들 주제 예시' : '이런 주제는 어때요?'}</h2>
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
                className="mc-press inline-flex min-h-11 items-center rounded-full bg-fuse-pill px-4 text-sm font-medium text-fuse-ink disabled:text-fuse-faint"
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
