'use client';

import { useEffect, useState } from 'react';

import { postJson } from '@/lib/client/ndjson';
import type { EasyBody } from '@/lib/types';

import { AfterComplete, type CompleteResult } from '../AfterComplete';
import { AppHeader, Footer, Loading, Main, OutlineButton, PrimaryButton, Screen } from '../ui';

/** 조금 헷갈려요 → 같은 내용을 일상 예시로 한 번 더 쉽게. 아래에는 '이해했어요'만 */
export function EasyScreen(props: { dropId: string; title: string; courseTitle: string; initial: EasyBody | null; completed: boolean }) {
  const [easy, setEasy] = useState<EasyBody | null>(props.initial);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [completing, setCompleting] = useState(false);
  const [result, setResult] = useState<CompleteResult | null>(null);

  useEffect(() => {
    if (easy) return;
    setFailed(false);
    postJson<EasyBody>(`/api/drops/${props.dropId}/easy`)
      .then(r => (r.ok ? setEasy(r.data) : setFailed(true)))
      .catch(() => setFailed(true));
  }, [easy, props.dropId, attempt]);

  const done = async () => {
    if (completing || result) return;
    if (props.completed) {
      window.location.replace('/today');
      return;
    }
    setCompleting(true);
    const res = await postJson<CompleteResult>(`/api/drops/${props.dropId}/complete`, { signal: 'confused' });
    // 시트가 떠 있는 동안 뒤 버튼이 '저장하는 중…'으로 남지 않게
    setCompleting(false);
    if (res.ok) setResult(res.data);
  };

  return (
    <Screen className="relative">
      <AppHeader layout="nav" title={props.courseTitle} close="/today" divider />
      <Main className="mc-in pb-8 pt-6">
        <p data-badge className="inline-flex h-8 items-center gap-1.5 self-start rounded-full bg-fuse-pill px-3 text-[13px] font-semibold text-fuse-ink">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4" stroke="#0B0B0C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {easy ? '더 쉽게 다시 설명했어요' : failed ? '더 쉽게 다시 설명' : '더 쉽게 다시 쓰는 중'}
        </p>
        <h1 className="mt-3.5 text-[28px] font-bold leading-[1.3]">{props.title}</h1>
        {easy ? (
          <article className="mt-6 flex flex-col gap-8">
            <p className="text-base font-semibold">{easy.lead}</p>
            <section className="flex flex-col gap-2.5">
              <h2 className="text-[13px] font-medium text-fuse-sub">일상으로 바꿔 보면</h2>
              <p className="text-base">{easy.daily}</p>
            </section>
            <section className="flex flex-col gap-2.5">
              <h2 className="text-[13px] font-medium text-fuse-sub">그래서 사람들은</h2>
              <p className="text-base">{easy.so}</p>
            </section>
            <section className="flex flex-col gap-2 rounded-card border border-fuse-line bg-fuse-card p-4">
              <h2 className="text-[13px] font-medium text-fuse-sub">정리하기</h2>
              <p className="text-xl font-bold leading-[1.3]">{easy.takeaway}</p>
            </section>
          </article>
        ) : failed ? (
          <div className="mt-10 flex flex-col items-center gap-4 text-center">
            <p className="text-base text-fuse-sub">쉬운 설명을 만들지 못했어요.</p>
            <OutlineButton onClick={() => setAttempt(a => a + 1)}>다시 시도</OutlineButton>
          </div>
        ) : (
          <Loading label="더 쉬운 말로 다시 쓰고 있어요" />
        )}
      </Main>
      <Footer className="border-t border-[#F2F2F4]">
        <PrimaryButton disabled={!easy} onClick={() => void done()}>
          {completing ? '저장하는 중…' : '이해했어요'}
        </PrimaryButton>
      </Footer>
      <AfterComplete result={result} dropId={props.dropId} />
    </Screen>
  );
}
