'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useRef, useState } from 'react';

import { CatIcon } from '@/components/CatIcon';
import { AppHeader, Footer, Main, PrimaryButton, Screen, TextButton } from '@/components/ui';
import { readNdjson } from '@/lib/client/ndjson';

type Ev =
  | { type: 'course'; courseId: string }
  | { type: 'title'; title: string }
  | { type: 'drop'; title: string; index: number }
  | { type: 'retry' }
  | { type: 'done'; courseId: string; firstDropId?: string }
  | { type: 'error'; message: string };

function Generating() {
  const router = useRouter();
  const params = useSearchParams();
  const [title, setTitle] = useState('');
  const [drops, setDrops] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  const [firstDropId, setFirstDropId] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const started = useRef(-1);

  useEffect(() => {
    if (started.current === attempt) return;
    started.current = attempt;
    setTitle('');
    setDrops([]);
    setFailed(false);
    setFirstDropId(null);

    const run = async () => {
      const res = await fetch('/api/courses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: params.get('topic'),
          level: params.get('level'),
          category: params.get('category'),
          taskType: params.get('taskType'),
          replace: params.get('replace') === '1',
        }),
      });
      if (res.status === 402) {
        // 하루 1번·진행 중 코스 초과는 새 코스 화면이 안내한다. 무료 한도·Plus 한 달 한도는 Plus 안내로
        const { reason } = (await res.json().catch(() => ({}))) as { reason?: string };
        router.replace(reason === 'daily' || reason === 'over' ? '/start' : '/plus?from=keep');
        return;
      }
      if (!res.ok) {
        setFailed(true);
        return;
      }
      await readNdjson<Ev>(res, e => {
        if (e.type === 'title') setTitle(e.title);
        if (e.type === 'drop') setDrops(d => [...d, e.title]);
        if (e.type === 'retry') setDrops([]);
        if (e.type === 'error') setFailed(true);
        if (e.type === 'done' && e.firstDropId) {
          setFirstDropId(e.firstDropId);
          // 첫 Drop은 기다리는 동안 미리 만들기 시작한다
          void fetch(`/api/drops/${e.firstDropId}/generate`, { method: 'POST' }).catch(() => undefined);
        }
      });
    };
    run().catch(() => setFailed(true));
  }, [attempt, params, router]);

  const done = Boolean(firstDropId);
  const status = failed ? '' : done ? `코스가 준비됐어요 · ${drops.length}개 Drop` : drops.length ? '코스를 만들고 있어요' : '커리큘럼을 짜고 있어요';

  const working = !failed && !done;

  return (
    <Screen>
      <AppHeader layout="nav" close="/today" />
      <Main className="pb-6 pt-6">
        <div className="flex items-center gap-2.5">
          <CatIcon category={params.get('category') ?? '기타'} />
          <span role="status" className="min-h-[22px] flex-1 text-sm text-fuse-sub">
            {status}
          </span>
        </div>
        <h1 className="mt-3 min-h-9 text-[28px] font-bold leading-[1.3]">{title || params.get('topic')}</h1>
        {failed ? null : (
          <p aria-hidden="true" className="mt-5 text-[52px] font-bold leading-none">
            {drops.length}
            <span className="relative -top-[0.14em] ml-1.5 text-[22px] leading-[1.3]">편</span>
          </p>
        )}
        <ol className="mt-6 flex flex-col">
          {drops.map((d, i) => (
            <li key={`${i}-${d}`} className={`mc-in flex min-h-[60px] items-center gap-3 py-2 ${i ? 'border-t border-[#F2F2F4]' : ''}`}>
              <span className="mc-pop flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-fuse-ink">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 12.5 10 17.5 19 7" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="flex-1 text-sm">{d}</span>
            </li>
          ))}
          {working ? (
            <li className={`mc-in flex min-h-[60px] items-center gap-3 py-2 ${drops.length ? 'border-t border-[#F2F2F4]' : ''}`}>
              <span className="relative flex h-8 w-8 flex-shrink-0 items-center justify-center text-[13px] font-semibold leading-[1.3] text-fuse-sub">
                <svg width="32" height="32" viewBox="0 0 32 32" fill="none" aria-hidden="true" className="absolute inset-0 -rotate-90">
                  <circle cx="16" cy="16" r="14" stroke="#EFEFF1" strokeWidth="2.5" />
                  <circle className="mc-ring" cx="16" cy="16" r="14" stroke="#0B0B0C" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="88" strokeDashoffset="88" />
                </svg>
                {drops.length + 1}
              </span>
              <span className="flex-1 text-sm text-fuse-sub">{drops.length ? '다음 Drop을 고르는 중' : '주제를 정리하는 중'}</span>
            </li>
          ) : null}
        </ol>
        {failed ? <p className="mt-6 text-center text-sm text-fuse-sub">코스를 만들지 못했어요.</p> : null}
      </Main>
      {done ? (
        <Footer className="mc-in gap-2">
          {/* D1: 오늘 만든 코스의 첫 Drop은 오늘 Drop과 별개로 바로 읽는다 (대표 결정 유지) */}
          <p className="text-center text-[13px] text-fuse-sub">하루 한 편씩 열려요. 첫 Drop은 오늘 Drop과 별도로 지금 바로 읽을 수 있어요.</p>
          <PrimaryButton href={`/drop/${firstDropId}`} replace>
            첫 Drop 읽기
          </PrimaryButton>
        </Footer>
      ) : null}
      {failed ? (
        <Footer>
          <PrimaryButton onClick={() => setAttempt(a => a + 1)}>다시 만들기</PrimaryButton>
          <TextButton href="/start" replace>
            다른 주제로 시작하기
          </TextButton>
        </Footer>
      ) : null}
    </Screen>
  );
}

export default function NewCoursePage() {
  return (
    <Suspense>
      <Generating />
    </Suspense>
  );
}
