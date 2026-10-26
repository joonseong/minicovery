'use client';

import { useEffect, useRef, useState } from 'react';

import { postJson, readNdjson, trackClient } from '@/lib/client/ndjson';
import { parseDropText } from '@/lib/drop-format';
import type { Drop, DropBody } from '@/lib/types';

import type { Recall } from '@/lib/learning';

import { AfterComplete, type CompleteResult } from '../AfterComplete';
import { RecallCard } from '../RecallCard';
import { AppHeader, Footer, Loading, Main, OutlineButton, PrimaryButton, Screen, TextButton } from '../ui';

type StreamEv =
  | { type: 'status'; message: string }
  | { type: 'text'; delta: string }
  | { type: 'retry' }
  | { type: 'done' | 'ready' | 'corrected'; drop: Drop }
  | { type: 'refused' }
  | { type: 'error'; message: string };

type Phase = 'generating' | 'ready' | 'failed' | 'refused';

const SECTIONS: { key: keyof DropBody; label: string }[] = [
  { key: 'concept', label: '핵심 개념' },
  { key: 'example', label: '예를 들면' },
  { key: 'connection', label: '이어서 생각하기' },
];

export function DropScreen({
  initialDrop,
  courseTitle,
  total,
  recall,
}: {
  initialDrop: Drop;
  courseTitle: string;
  total: number;
  /** 2편째부터: 어제 읽은 Drop의 한 문장 */
  recall?: Recall | null;
}) {
  const [drop, setDrop] = useState(initialDrop);
  const [phase, setPhase] = useState<Phase>(initialDrop.status === 'ready' ? 'ready' : 'generating');
  const [stream, setStream] = useState('');
  const [status, setStatus] = useState('Drop을 준비하고 있어요');
  const [attempt, setAttempt] = useState(0);
  const [reported, setReported] = useState(Boolean(initialDrop.reportedAt));
  const [completing, setCompleting] = useState(false);
  const [result, setResult] = useState<CompleteResult | null>(null);
  const started = useRef(-1);
  const sentinel = useRef<HTMLDivElement>(null);
  const rereading = Boolean(initialDrop.completedAt);

  useEffect(() => {
    if (initialDrop.status === 'ready' && attempt === 0) return;
    if (started.current === attempt) return;
    started.current = attempt;
    setPhase('generating');
    setStream('');
    const t0 = Date.now();
    const run = async () => {
      const res = await fetch(`/api/drops/${drop.id}/generate`, { method: 'POST' });
      if (res.status === 423) {
        window.location.replace('/today');
        return;
      }
      let first = true;
      await readNdjson<StreamEv>(res, e => {
        if (e.type === 'status') setStatus(e.message);
        if (e.type === 'retry') setStream('');
        if (e.type === 'text') {
          if (first) {
            first = false;
            trackClient('drop_wait', { dropId: drop.id, ms: Date.now() - t0 });
          }
          setStream(t => t + e.delta);
        }
        if (e.type === 'done' || e.type === 'ready' || e.type === 'corrected') {
          setDrop(e.drop);
          setPhase('ready');
        }
        if (e.type === 'refused') setPhase('refused');
        if (e.type === 'error') setPhase(p => (p === 'ready' ? p : 'failed'));
      });
    };
    run().catch(() => setPhase(p => (p === 'ready' ? p : 'failed')));
  }, [attempt, drop.id, initialDrop.status]);

  // 끝까지 스크롤하면 읽음
  useEffect(() => {
    if (phase !== 'ready' || !sentinel.current || rereading) return;
    const observer = new IntersectionObserver(entries => {
      if (entries.some(e => e.isIntersecting)) {
        void postJson(`/api/drops/${drop.id}/read`);
        observer.disconnect();
      }
    });
    observer.observe(sentinel.current);
    return () => observer.disconnect();
  }, [phase, drop.id, rereading]);

  // 첫 Drop: 수준 선택 → 첫 문단까지 걸린 시간
  const body: Partial<DropBody> = phase === 'ready' && drop.body ? drop.body : parseDropText(stream);
  useEffect(() => {
    if (!body.hook || drop.index !== 0) return;
    const start = Number(sessionStorage.getItem('ttfd_start'));
    if (!start) return;
    sessionStorage.removeItem('ttfd_start');
    trackClient('ttfd', { ms: Date.now() - start, courseId: drop.courseId });
  }, [body.hook, drop.index, drop.courseId]);

  const complete = async () => {
    if (completing) return;
    setCompleting(true);
    const res = await postJson<CompleteResult>(`/api/drops/${drop.id}/complete`, { signal: 'understood' });
    if (res.ok) setResult(res.data);
    else setCompleting(false);
  };

  const streaming = phase === 'generating';

  return (
    <Screen className="relative">
      <AppHeader layout="nav" title={courseTitle} close="/today" divider />
      <Main className="pb-8 pt-6">
        {recall ? <RecallCard recall={recall} /> : null}
        <p className="text-sm font-semibold text-txt-black-tertiary">
          Drop {drop.index + 1} / {total}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-[-1px]">{drop.title}</h1>

        {phase === 'failed' || phase === 'refused' ? (
          <div className="mt-10 flex flex-col items-center gap-4 text-center">
            <p className="text-base text-txt-black-secondary">
              {phase === 'refused' ? '이 Drop은 만들 수 없는 내용이에요. 다른 Drop으로 이어 가 주세요.' : 'Drop을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.'}
            </p>
            {phase === 'failed' ? <OutlineButton onClick={() => setAttempt(a => a + 1)}>다시 만들기</OutlineButton> : null}
          </div>
        ) : (
          <article className="mt-6 flex flex-col gap-7">
            {body.hook ? (
              <p className="whitespace-pre-line text-lg font-semibold leading-7">{body.hook}</p>
            ) : streaming ? (
              <Loading label={status} />
            ) : null}
            {SECTIONS.map(s =>
              body[s.key] ? (
                <section key={s.key} className="flex flex-col gap-2">
                  <h2 className="text-sm font-bold text-txt-black-secondary">{s.label}</h2>
                  <p className="whitespace-pre-line text-base leading-7">{body[s.key]}</p>
                </section>
              ) : null,
            )}
            {body.takeaway ? (
              <section className="flex flex-col gap-2 rounded-2xl bg-shape-depth1 p-5">
                <h2 className="text-sm font-bold text-txt-black-secondary">한 문장으로</h2>
                <p className={streaming ? 'streaming-caret text-lg font-semibold' : 'text-lg font-semibold'}>{body.takeaway}</p>
              </section>
            ) : null}
          </article>
        )}

        {phase === 'ready' ? (
          <>
            <section className="mt-10 flex flex-col gap-3 border-t border-border-div pt-6">
              <h2 className="text-sm font-bold text-txt-black-secondary">출처 · 더 알아보기</h2>
              {drop.sources.map(s => (
                <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="text-sm text-txt-link">
                  {s.title}
                </a>
              ))}
              <div className="flex items-center justify-between">
                <p className="text-sm text-txt-black-tertiary">AI가 만든 콘텐츠예요{drop.corrected ? ' · 내용을 다시 확인해 고쳤어요' : ''}</p>
                <button
                  type="button"
                  disabled={reported}
                  onClick={() => {
                    setReported(true);
                    void postJson(`/api/drops/${drop.id}/report`);
                  }}
                  className={reported ? 'min-h-11 text-sm text-txt-black-tertiary' : 'min-h-11 text-sm text-txt-black-tertiary underline'}
                >
                  {reported ? '알려 주셔서 고마워요. 확인하고 고칠게요' : '내용이 이상해요'}
                </button>
              </div>
            </section>
            <div ref={sentinel} />
            {!rereading ? (
              <section className="mt-10 flex flex-col gap-4">
                <div className="flex flex-col gap-1 text-center">
                  <h2 className="text-lg font-semibold">오늘 Drop, 어땠어요?</h2>
                  <p className="text-sm text-txt-black-secondary">어느 쪽을 눌러도 오늘 Drop을 마쳐요. ‘조금 헷갈려요’는 더 쉽게 다시 설명해 줘요.</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <PrimaryButton onClick={() => void complete()}>{completing ? '저장하는 중…' : '이해했어요'}</PrimaryButton>
                  <OutlineButton href={`/drop/${drop.id}/easy`}>조금 헷갈려요</OutlineButton>
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </Main>
      {phase === 'ready' && rereading ? (
        <Footer>
          <TextButton href="/today" replace>
            닫기
          </TextButton>
        </Footer>
      ) : null}
      <AfterComplete result={result} dropId={drop.id} />
    </Screen>
  );
}
