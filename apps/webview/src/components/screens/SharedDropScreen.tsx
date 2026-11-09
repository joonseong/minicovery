'use client';

import { useEffect, useState } from 'react';

import { postJson } from '@/lib/client/ndjson';
import type { SharedDrop } from '@/lib/learning';

import { DropArticle, DropProgress, DropSources, ReportSheet, type ReportReason } from '../DropParts';
import { LikeButton } from '../LikeButton';
import { AppHeader, Main, PrimaryButton, Screen, Toast, useToast } from '../ui';

/**
 * 다른 사람이 만든 추천 코스의 Drop 열람. 받지 않고 그 자리에서 읽는다 (무료는 3번째 편 앞부분까지, Plus는 끝까지).
 * 하루 한 편·완료 기록 없이 '다음 Drop'으로 이어 간다. 신고는 운영자에게만 간다
 */
export function SharedDropScreen({ drop }: { drop: SharedDrop }) {
  const [reported, setReported] = useState(false);
  const [reportSheet, setReportSheet] = useState(false);
  const [toast, showToast] = useToast();

  // 'N명이 읽었어요'. 미리 불러오기는 세지 않게 화면이 뜬 뒤에 보낸다
  useEffect(() => {
    void postJson(`/api/recommended/${drop.courseId}/read`, { n: drop.n });
  }, [drop.courseId, drop.n]);

  const report = async (reason: ReportReason) => {
    setReportSheet(false);
    setReported(true);
    await postJson(`/api/recommended/${drop.courseId}/report`, { n: drop.n, reason });
    showToast('알려 주셔서 고마워요. 확인하고 고칠게요');
  };

  return (
    <Screen className="relative">
      <AppHeader layout="nav" title={drop.courseTitle} close={`/recommend/${drop.courseId}`} />
      <Main className="pb-8 pt-4">
        <DropProgress category={drop.category} n={drop.n} total={drop.total} />
        <h1 className="mt-5 text-[28px] font-bold leading-[1.3]">{drop.title}</h1>
        {drop.imageUrl ? (
          // 내용을 옮긴 장식 그림 (본문이 같은 내용을 말한다)
          // eslint-disable-next-line @next/next/no-img-element
          <img src={drop.imageUrl} alt="" width={1536} height={1024} className="mc-fade mt-3 block aspect-[3/2] h-auto w-full" />
        ) : null}
        {drop.teaser ? (
          <>
            {/* 무료로 보는 마지막 편: 앞부분만 보여 주고 아래를 흰색으로 흐리게 가린다 (2026-11-10 대표 결정) */}
            <div className="relative max-h-[280px] overflow-hidden">
              <DropArticle body={drop.body} className={drop.imageUrl ? 'mt-3' : 'mt-6'} />
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 bottom-0 h-40"
                style={{ background: 'linear-gradient(to bottom, rgba(255,255,255,0), #FFFFFF 85%)' }}
              />
            </div>
            <section className="mt-2 flex flex-col items-center gap-1.5 text-center">
              <p className="text-lg font-bold leading-[1.3]">이어서 읽으려면 Plus가 필요해요</p>
              <p className="text-sm text-fuse-sub">구독하면 다른 사람이 만든 Drop을 모두 읽을 수 있어요.</p>
            </section>
          </>
        ) : (
          <>
            <DropArticle body={drop.body} className={drop.imageUrl ? 'mt-3' : 'mt-6'} />
            <DropSources sources={drop.sources} corrected={drop.corrected} reported={reported} onReport={() => setReportSheet(true)} />
          </>
        )}
        <section className={drop.teaser ? 'mt-6 flex flex-col gap-4' : 'mt-10 flex flex-col gap-4'}>
          {drop.nextN || drop.teaser ? null : <p className="text-center text-sm text-fuse-sub">이 코스를 끝까지 읽었어요.</p>}
          <div className="flex gap-2">
            <LikeButton courseId={drop.courseId} initial={drop.liked} />
            {drop.teaser ? (
              <PrimaryButton href="/plus?from=shared" className="flex-1">
                Plus로 이어 읽기
              </PrimaryButton>
            ) : drop.nextN ? (
              <PrimaryButton href={`/recommend/${drop.courseId}/${drop.nextN}`} replace className="flex-1">
                다음 Drop 읽기
              </PrimaryButton>
            ) : (
              <PrimaryButton href="/today" replace className="flex-1">
                다른 코스 보기
              </PrimaryButton>
            )}
          </div>
        </section>
      </Main>
      <ReportSheet open={reportSheet} onClose={() => setReportSheet(false)} onPick={r => void report(r)} />
      <Toast message={toast} />
    </Screen>
  );
}
