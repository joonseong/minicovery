'use client';

import { useEffect, useRef, useState } from 'react';

import { postJson, readNdjson, trackClient } from '@/lib/client/ndjson';
import { isCompleteBody, parseDropText, splitPoints } from '@/lib/drop-format';
import type { Drop, DropBody } from '@/lib/types';

import { AfterComplete, type CompleteResult } from '../AfterComplete';
import { CatIcon } from '../CatIcon';
import type { DoodleAnimal } from '../Doodle';
import { DropLoading, type DropLoadingStep } from '../DropLoading';
import { RecallCard, type RecallLike } from '../RecallCard';
import { AppHeader, Footer, Main, OutlineButton, PrimaryButton, Screen, Sheet, TextButton, Toast, useToast } from '../ui';

type StreamEv =
  | { type: 'status'; message: string }
  | { type: 'text'; delta: string }
  | { type: 'retry' }
  | { type: 'done' | 'ready' | 'corrected'; drop: Drop }
  /** 글과 함께 그리던 그림이 끝남 (로딩 단계용) */
  | { type: 'art' }
  /** 글을 먼저 보여 준 뒤 늦게 끝난 그림 */
  | { type: 'image'; url: string }
  | { type: 'refused' }
  /** 모델이 거절해 이 Drop을 건너뜀. 다음 Drop으로 이어 간다 */
  | { type: 'skipped'; message: string; nextDropId?: string }
  /** 다른 곳에서 같은 Drop을 만들고 있음. 잠시 뒤 다시 연다 */
  | { type: 'conflict'; message: string }
  | { type: 'error'; message: string };

/** preparing: 글은 있는데 그림이 없어 그림부터 그리는 중 (처음 읽을 때만) */
type Phase = 'generating' | 'preparing' | 'ready' | 'failed' | 'skipped' | 'conflict';

/** 로딩 막대: 글 길이로 진행을 어림한다 (Drop 한 편은 보통 1,000자 안팎) */
const TYPICAL_DROP_CHARS = 1100;

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
  stageKey,
  category,
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
  /** 로딩 화면 캐릭터 (지금 단계) */
  stageKey: DoodleAnimal;
  /** 코스 분야 (진행 줄의 아이콘) */
  category: string;
}) {
  const skippedAtStart = initialDrop.status === 'skipped';
  const [drop, setDrop] = useState(initialDrop);
  // 그림이 없는 Drop을 처음 읽을 때는 그림까지 그린 뒤 보여 준다. 다시 읽기면 글 먼저
  const [phase, setPhase] = useState<Phase>(
    initialDrop.status === 'ready'
      ? !initialDrop.image?.url && !initialDrop.completedAt
        ? 'preparing'
        : 'ready'
      : skippedAtStart
        ? 'skipped'
        : 'generating',
  );
  const [notice, setNotice] = useState(skippedAtStart ? SKIPPED_MESSAGE : '');
  const [skipNext, setSkipNext] = useState<string | undefined>(nextDropId);
  const [stream, setStream] = useState('');
  const [art, setArt] = useState(false);
  const [loadingFrom] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
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
        if (e.type === 'art') setArt(true);
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
        if (e.type === 'image') setDrop(d => ({ ...d, image: { at: d.image?.at ?? '', tries: d.image?.tries ?? 1, url: e.url } }));
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

  // 글은 있는데 그림이 없는 Drop: 열 때 그린다 (처음 읽기는 최대 45초 기다렸다 같이, 다시 읽기는 되면 붙인다)
  useEffect(() => {
    if (initialDrop.status !== 'ready' || initialDrop.image?.url) return;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 45_000);
    fetch(`/api/drops/${initialDrop.id}/image`, { method: 'POST', signal: controller.signal })
      .then(res => (res.ok ? (res.json() as Promise<{ url?: string | null }>) : null))
      .then(r => {
        const url = r?.url;
        if (url) setDrop(d => ({ ...d, image: { at: d.image?.at ?? '', tries: d.image?.tries ?? 1, url } }));
      })
      .catch(() => undefined)
      .finally(() => {
        clearTimeout(timer);
        setPhase(p => (p === 'preparing' ? 'ready' : p));
      });
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [initialDrop.id, initialDrop.status, initialDrop.image?.url]);

  // 로딩 막대가 멈춰 보이지 않게 1초마다 다시 그린다
  const loading = phase === 'generating' || phase === 'preparing';
  useEffect(() => {
    if (!loading) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [loading]);
  const textDone = stream ? isCompleteBody(parseDropText(stream)) : false;
  const loadingStep: DropLoadingStep = phase === 'preparing' ? 2 : !stream ? 0 : !textDone ? 1 : art ? 3 : 2;
  const waited = (now - loadingFrom) / 1000;
  const progress =
    phase === 'preparing'
      ? Math.min(0.74 + waited * 0.006, 0.95)
      : Math.min(
          0.06 + (stream ? 0.12 : Math.min(waited / 20, 1) * 0.12) + Math.min(stream.length / TYPICAL_DROP_CHARS, 1) * 0.5 + (art ? 0.22 : 0),
          0.96,
        );

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
  // 글과 그림이 둘 다 되기 전에는 본문을 보이지 않는다 (스트림은 로딩 막대에만 쓴다)
  const body: Partial<DropBody> = phase === 'ready' && drop.body ? drop.body : {};
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

  const skipHref = skipNext ? `/drop/${skipNext}` : `/course/${drop.courseId}`;

  return (
    <Screen className="relative">
      <AppHeader layout="nav" title={courseTitle} close="/today" />
      <Main className="pb-8 pt-4">
        {recall && phase !== 'skipped' ? <RecallCard recall={recall} className="mb-7" /> : null}
        <div className="flex items-center gap-3">
          <CatIcon category={category} />
          <span className="text-sm font-medium leading-[1.3]">
            Drop {drop.index + 1}
            <span className="text-fuse-mute"> / {total}</span>
          </span>
          <span aria-hidden="true" className="h-1.5 flex-1 overflow-hidden rounded-full bg-fuse-track">
            <span className="block h-full rounded-full bg-fuse-ink" style={{ width: `${Math.round(((drop.index + 1) / Math.max(1, total)) * 100)}%` }} />
          </span>
        </div>
        <h1 className="mt-5 text-[28px] font-bold leading-[1.3]">{drop.title}</h1>
        {phase === 'ready' && drop.image?.url ? (
          // 내용을 옮긴 장식 그림 (본문이 같은 내용을 말한다)
          // eslint-disable-next-line @next/next/no-img-element
          <img src={drop.image.url} alt="" width={1536} height={1024} className="mc-fade mt-3 block aspect-[3/2] h-auto w-full" />
        ) : null}

        {phase === 'skipped' ? (
          <div className="mt-10 flex flex-col items-center gap-4 text-center">
            <p className="text-base text-fuse-sub">{notice}</p>
            <PrimaryButton href={skipHref} replace>
              {skipNext ? '다음 Drop 읽기' : '코스로 돌아가기'}
            </PrimaryButton>
          </div>
        ) : phase === 'conflict' ? (
          // 본문은 숨기고 안내만. 완료는 막는다
          <div className="mt-10 flex flex-col items-center gap-4 text-center">
            <p className="text-base text-fuse-sub">{notice}</p>
            <OutlineButton onClick={() => window.location.reload()}>다시 열기</OutlineButton>
          </div>
        ) : phase === 'failed' ? (
          <div className="mt-10 flex flex-col items-center gap-4 text-center">
            <p className="text-base text-fuse-sub">Drop을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.</p>
            <OutlineButton onClick={() => setAttempt(a => a + 1)}>다시 만들기</OutlineButton>
          </div>
        ) : loading ? (
          <DropLoading step={loadingStep} progress={progress} animal={stageKey} />
        ) : (
          <article className={`${drop.image?.url ? 'mt-3' : 'mt-6'} flex flex-col gap-8`}>
            {body.hook ? <p className="whitespace-pre-line text-base font-semibold">{body.hook}</p> : null}
            {SECTIONS.map(s =>
              body[s.key] ? (
                <section key={s.key} className="flex flex-col gap-2.5">
                  <h2 className="text-[13px] font-medium text-fuse-sub">{s.label}</h2>
                  <p className="whitespace-pre-line text-base">{body[s.key]}</p>
                </section>
              ) : null,
            )}
            {body.takeaway ? (
              <section className="flex flex-col gap-2 rounded-card border border-fuse-line bg-fuse-card p-4">
                <h2 className="text-[13px] font-medium text-fuse-sub">정리하기</h2>
                <p className="text-xl font-bold leading-[1.3]">{body.takeaway}</p>
                {points.length ? (
                  <ul className="mt-2 flex flex-col gap-1.5 border-t border-fuse-line pt-3">
                    {points.map((pt, i) => (
                      <li key={i} className="flex gap-2 text-sm">
                        <span aria-hidden className="shrink-0 text-fuse-faint">–</span>
                        <span>{pt}</span>
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
            <section className="mt-10 flex flex-col">
              <h2 className="mb-1 text-[13px] font-medium text-fuse-sub">출처 · 더 알아보기</h2>
              {drop.sources.map(s => (
                <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="flex min-h-[52px] items-center gap-3 border-b border-[#F2F2F4] text-sm">
                  <span className="min-w-0 flex-1">{s.title}</span>
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" className="flex-shrink-0">
                    <path d="M4 10 10 4M5 4h5v5" stroke="#AEAEB2" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </a>
              ))}
              <div className="mt-1 flex items-center justify-between gap-3">
                <p className="text-[13px] text-fuse-faint">AI가 만든 콘텐츠예요{drop.corrected ? ' · 내용을 다시 확인해 고쳤어요' : ''}</p>
                <button
                  type="button"
                  disabled={reported}
                  onClick={() => setReportSheet(true)}
                  className={reported ? 'min-h-11 flex-shrink-0 text-[13px] text-fuse-sub' : 'min-h-11 flex-shrink-0 text-[13px] text-fuse-sub underline'}
                >
                  {reported ? '신고했어요' : '내용이 이상해요'}
                </button>
              </div>
            </section>
            <div ref={sentinel} />
            {!rereading ? (
              <section className="mt-10 flex flex-col gap-4">
                <div className="flex flex-col gap-1.5 text-center">
                  <h2 className="text-xl font-bold leading-[1.3]">{openedAll ? '이 Drop, 어땠어요?' : '오늘 Drop, 어땠어요?'}</h2>
                  <p className="text-sm text-fuse-sub">
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
        <h2 id="reportTitle" className="mt-6 text-2xl font-bold leading-[1.3]">
          어떤 점이 이상했나요?
        </h2>
        <p className="mt-1 text-sm text-fuse-sub">알려 주시면 확인하고 고칠게요.</p>
        <div className="mt-5 flex flex-col gap-2">
          {REPORT_REASONS.map(r => (
            <button
              key={r.key}
              type="button"
              onClick={() => void report(r.key)}
              className="mc-press flex min-h-14 flex-col items-start justify-center gap-0.5 rounded-card border border-fuse-line bg-fuse-card px-4 py-3 text-left"
            >
              <span className="text-base font-semibold leading-[1.3]">{r.label}</span>
              <span className="text-[13px] text-fuse-sub">{r.desc}</span>
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
