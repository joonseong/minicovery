'use client';

import { useEffect, useRef, useState } from 'react';

import { postJson, readNdjson, trackClient } from '@/lib/client/ndjson';
import { parseDropText, splitPoints } from '@/lib/drop-format';
import type { Drop, DropBody } from '@/lib/types';

import { AfterComplete, type CompleteResult } from '../AfterComplete';
import { RecallCard, type RecallLike } from '../RecallCard';
import { AppHeader, Footer, Loading, Main, OutlineButton, PrimaryButton, Screen, Sheet, TextButton, Toast, useToast } from '../ui';

type StreamEv =
  | { type: 'status'; message: string }
  | { type: 'text'; delta: string }
  | { type: 'retry' }
  | { type: 'done' | 'ready' | 'corrected'; drop: Drop }
  | { type: 'refused' }
  /** 모델이 거절해 이 Drop을 건너뜀. 다음 Drop으로 이어 간다 */
  | { type: 'skipped'; message: string; nextDropId?: string }
  /** 다른 곳에서 같은 Drop을 만들고 있음. 잠시 뒤 다시 연다 */
  | { type: 'conflict'; message: string }
  | { type: 'error'; message: string };

type Phase = 'generating' | 'ready' | 'failed' | 'skipped' | 'conflict';

const SKIPPED_MESSAGE = '이 Drop은 만들 수 없는 내용이라 건너뛰었어요. 다음 Drop으로 이어 가요.';
const CONFLICT_MESSAGE = '이 Drop을 다른 곳에서 만들고 있어요. 잠시 뒤 다시 열어 주세요.';

const SECTIONS: { key: keyof DropBody; label: string }[] = [
  { key: 'concept', label: '핵심 개념' },
  { key: 'example', label: '예를 들면' },
  { key: 'connection', label: '이어서 생각하기' },
];

const REPORT_REASONS: { key: 'wrong' | 'unclear' | 'inappropriate'; label: string; desc: string }[] = [
  { key: 'wrong', label: '틀린 사실이 있어요', desc: '숫자·이름·설명이 사실과 달라요' },
  { key: 'unclear', label: '이해가 안 돼요', desc: '설명이 어렵거나 앞뒤가 안 맞아요' },
  { key: 'inappropriate', label: '부적절한 내용이에요', desc: '불쾌하거나 다루면 안 되는 내용이에요' },
];

export function DropScreen({
  initialDrop,
  courseTitle,
  total,
  recall,
  nextDropId,
  openedAll,
}: {
  initialDrop: Drop;
  courseTitle: string;
  total: number;
  /** 2편째부터: 지난번에 읽은 Drop의 한 문장 */
  recall?: RecallLike | null;
  /** 이 코스에서 이 Drop 다음에 읽을 Drop (건너뜀 안내의 '다음 Drop 읽기') */
  nextDropId?: string;
  /** 전체 열린 코스: 하루 한 편과 상관없이 읽는 중 */
  openedAll?: boolean;
}) {
  const skippedAtStart = initialDrop.status === 'skipped';
  const [drop, setDrop] = useState(initialDrop);
  const [phase, setPhase] = useState<Phase>(initialDrop.status === 'ready' ? 'ready' : skippedAtStart ? 'skipped' : 'generating');
  const [notice, setNotice] = useState(skippedAtStart ? SKIPPED_MESSAGE : '');
  const [skipNext, setSkipNext] = useState<string | undefined>(nextDropId);
  const [stream, setStream] = useState('');
  const [status, setStatus] = useState('Drop을 준비하고 있어요');
  const [attempt, setAttempt] = useState(0);
  const [reported, setReported] = useState(Boolean(initialDrop.reportedAt));
  const [reportSheet, setReportSheet] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [result, setResult] = useState<CompleteResult | null>(null);
  const [toast, showToast] = useToast();
  const started = useRef(-1);
  const sentinel = useRef<HTMLDivElement>(null);
  const rereading = Boolean(initialDrop.completedAt);

  useEffect(() => {
    if (skippedAtStart) return;
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
        if (e.type === 'refused' || e.type === 'skipped') {
          setNotice(e.type === 'skipped' && e.message ? e.message : SKIPPED_MESSAGE);
          if (e.type === 'skipped' && e.nextDropId) setSkipNext(e.nextDropId);
          setPhase('skipped');
        }
        if (e.type === 'conflict') {
          setNotice(e.message || CONFLICT_MESSAGE);
          setPhase(p => (p === 'ready' ? p : 'conflict'));
        }
        if (e.type === 'error') setPhase(p => (p === 'ready' ? p : 'failed'));
      });
    };
    run().catch(() => setPhase(p => (p === 'ready' ? p : 'failed')));
  }, [attempt, drop.id, initialDrop.status, skippedAtStart]);

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
  const points = splitPoints(body.points);
  useEffect(() => {
    if (!body.hook || drop.index !== 0) return;
    const start = Number(sessionStorage.getItem('ttfd_start'));
    if (!start) return;
    sessionStorage.removeItem('ttfd_start');
    trackClient('ttfd', { ms: Date.now() - start, courseId: drop.courseId });
  }, [body.hook, drop.index, drop.courseId]);

  const complete = async () => {
    if (completing || result) return;
    setCompleting(true);
    const res = await postJson<CompleteResult>(`/api/drops/${drop.id}/complete`, { signal: 'understood' });
    // 시트가 떠 있는 동안 뒤 버튼이 '저장하는 중…'으로 남지 않게
    setCompleting(false);
    if (res.ok) setResult(res.data);
    else if (res.status === 409) {
      setNotice(CONFLICT_MESSAGE);
      setPhase('conflict');
    } else showToast('저장하지 못했어요. 다시 시도해 주세요');
  };

  const report = async (reason: 'wrong' | 'unclear' | 'inappropriate') => {
    setReportSheet(false);
    setReported(true);
    await postJson(`/api/drops/${drop.id}/report`, { reason });
    showToast('알려 주셔서 고마워요. 확인하고 고칠게요');
  };

  const streaming = phase === 'generating';
  const skipHref = skipNext ? `/drop/${skipNext}` : `/course/${drop.courseId}`;

  return (
    <Screen className="relative">
      <AppHeader layout="nav" title={courseTitle} close="/today" divider />
      <Main className="pb-8 pt-6">
        {recall && phase !== 'skipped' ? <RecallCard recall={recall} /> : null}
        <p className="text-sm font-semibold text-txt-black-tertiary">
          Drop {drop.index + 1} / {total}
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-[-1px]">{drop.title}</h1>

        {phase === 'skipped' ? (
          <div className="mt-10 flex flex-col items-center gap-4 text-center">
            <p className="text-base text-txt-black-secondary">{notice}</p>
            <PrimaryButton href={skipHref} replace>
              {skipNext ? '다음 Drop 읽기' : '코스로 돌아가기'}
            </PrimaryButton>
          </div>
        ) : phase === 'conflict' ? (
          // 본문은 숨기고 안내만. 완료는 막는다
          <div className="mt-10 flex flex-col items-center gap-4 text-center">
            <p className="text-base text-txt-black-secondary">{notice}</p>
            <OutlineButton onClick={() => window.location.reload()}>다시 열기</OutlineButton>
          </div>
        ) : phase === 'failed' ? (
          <div className="mt-10 flex flex-col items-center gap-4 text-center">
            <p className="text-base text-txt-black-secondary">Drop을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.</p>
            <OutlineButton onClick={() => setAttempt(a => a + 1)}>다시 만들기</OutlineButton>
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
                <h2 className="text-sm font-bold text-txt-black-secondary">정리하기</h2>
                <p className={streaming && !body.points ? 'streaming-caret text-lg font-semibold' : 'text-lg font-semibold'}>{body.takeaway}</p>
                {points.length ? (
                  <ul className="mt-2 flex flex-col gap-2 border-t border-border-div pt-4">
                    {points.map((pt, i) => (
                      <li key={i} className="flex gap-2 text-base leading-6">
                        <span aria-hidden className="shrink-0 text-txt-black-tertiary">–</span>
                        <span className={streaming && i === points.length - 1 ? 'streaming-caret' : undefined}>{pt}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
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
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-txt-black-tertiary">AI가 만든 콘텐츠예요{drop.corrected ? ' · 내용을 다시 확인해 고쳤어요' : ''}</p>
                <button
                  type="button"
                  disabled={reported}
                  onClick={() => setReportSheet(true)}
                  className={reported ? 'min-h-11 flex-shrink-0 text-sm text-txt-black-tertiary' : 'min-h-11 flex-shrink-0 text-sm text-txt-black-tertiary underline'}
                >
                  {reported ? '신고했어요' : '내용이 이상해요'}
                </button>
              </div>
            </section>
            <div ref={sentinel} />
            {!rereading ? (
              <section className="mt-10 flex flex-col gap-4">
                <div className="flex flex-col gap-1 text-center">
                  <h2 className="text-lg font-semibold">{openedAll ? '이 Drop, 어땠어요?' : '오늘 Drop, 어땠어요?'}</h2>
                  <p className="text-sm text-txt-black-secondary">
                    어느 쪽을 눌러도 {openedAll ? '이 Drop을' : '오늘 Drop을'} 마쳐요. ‘조금 헷갈려요’는 더 쉽게 다시 설명해 줘요.
                  </p>
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

      <Sheet open={reportSheet} onClose={() => setReportSheet(false)} labelledBy="reportTitle">
        <h2 id="reportTitle" className="mt-6 text-2xl font-bold tracking-[-1px]">
          어떤 점이 이상했나요?
        </h2>
        <p className="mt-1 text-base text-txt-black-secondary">알려 주시면 확인하고 고칠게요.</p>
        <div className="mt-5 flex flex-col gap-2">
          {REPORT_REASONS.map(r => (
            <button
              key={r.key}
              type="button"
              onClick={() => void report(r.key)}
              className="mc-press flex min-h-14 flex-col items-start justify-center gap-0.5 rounded-2xl border border-border-button bg-shape-white px-5 py-3 text-left"
            >
              <span className="text-base font-semibold">{r.label}</span>
              <span className="text-sm text-txt-black-tertiary">{r.desc}</span>
            </button>
          ))}
        </div>
        <TextButton onClick={() => setReportSheet(false)} className="mt-2">
          취소
        </TextButton>
      </Sheet>

      <AfterComplete result={result} dropId={drop.id} />
      <Toast message={toast} />
    </Screen>
  );
}
