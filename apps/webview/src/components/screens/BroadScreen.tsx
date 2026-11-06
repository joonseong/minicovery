'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { checkTopic, levelHref } from '@/lib/client/start';
import { josa } from '@/lib/josa';

import { LimitSheet, MonthlySheet, ReplaceSheet } from '../QuotaSheets';
import { CatIcon } from '../CatIcon';
import { BottomNav, Main, Screen } from '../ui';

type Props = { topic: string; category?: string; suggestions: string[]; quota: 'ok' | 'free' | 'over' | 'monthly' | 'daily'; currentTopic?: string; replace?: boolean; resetLabel?: string };

export function BroadScreen({ topic, category, suggestions, quota, currentTopic, replace, resetLabel }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [sheet, setSheet] = useState<null | { kind: 'free' | 'monthly' | 'daily' | 'over'; replaceHref: string }>(null);

  const pick = async (s: string) => {
    if (busy) return;
    setBusy(s);
    const r = await checkTopic(s);
    setBusy(null);
    // 좁힌 주제는 다시 넓다고 나와도 그대로 코스로 만든다
    const ok = r.status === 'ok' ? r : { topic: s, category: '라이프스타일', taskType: 'hobby' };
    if (r.status === 'blocked') return;
    if (quota === 'free' && replace) return router.push(levelHref(ok, true));
    if (quota === 'free') return setSheet({ kind: 'free', replaceHref: levelHref(ok, true) });
    if (quota === 'monthly' || quota === 'daily' || quota === 'over') return setSheet({ kind: quota, replaceHref: '' });
    router.push(levelHref(ok));
  };

  return (
    <Screen>
      <Main className="pb-32 pt-6">
        <div className="flex flex-col gap-2.5">
          <h1 className="text-[28px] font-bold leading-[1.3]">
            요즘 뭐가
            <br />
            궁금하세요?
          </h1>
          <p className="text-sm text-fuse-sub">입력한 주제를 하루 한 편씩 읽는 코스로 만들어 드려요.</p>
        </div>
        <div className="mt-7">
          <input
            value={topic}
            readOnly
            aria-label="궁금한 주제"
            className="h-14 w-full rounded-[18px] border border-fuse-ink bg-shape-white px-[18px] text-base outline-none"
          />
        </div>
        <section className="mt-4 flex flex-col gap-4 rounded-card border border-fuse-line bg-fuse-card p-4">
          <div className="flex items-start gap-3">
            <CatIcon category={category ?? '기타'} />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h2 className="text-base font-semibold leading-[1.3]">조금 좁혀 볼까요?</h2>
            {/* 조사는 따옴표 안 단어의 받침으로 고른다 */}
            <p className="text-[13px] text-fuse-sub">
              ‘{topic}’{josa(topic, '은/는').slice(topic.length)} 범위가 넓어서 한 코스로 담기 어려워요. 이 중에서 골라 주세요.
            </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestions.map(s => (
              <button
                key={s}
                type="button"
                onClick={() => void pick(s)}
                className="mc-press inline-flex min-h-11 items-center rounded-full border border-fuse-edge bg-shape-white px-4 text-sm font-medium text-fuse-ink"
              >
                {busy === s ? '살펴보는 중…' : s}
              </button>
            ))}
          </div>
        </section>
        <button
          type="button"
          onClick={() => router.replace(`/start?topic=${encodeURIComponent(topic)}`)}
          className="mt-4 flex min-h-11 items-center self-center px-3 text-sm font-medium text-fuse-sub underline"
        >
          다시 입력하기
        </button>
      </Main>
      <BottomNav active="explore" />
      <ReplaceSheet open={sheet?.kind === 'free'} onClose={() => setSheet(null)} courseTopic={currentTopic} replaceHref={sheet?.replaceHref ?? '/start'} />
      <MonthlySheet open={sheet?.kind === 'monthly'} onClose={() => setSheet(null)} resetLabel={resetLabel} />
      <LimitSheet
        kind={sheet?.kind === 'daily' || sheet?.kind === 'over' ? sheet.kind : null}
        onClose={() => setSheet(null)}
        plus={Boolean(resetLabel)}
      />
    </Screen>
  );
}
