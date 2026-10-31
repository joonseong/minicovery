import { notFound } from 'next/navigation';

import { FeatureToggle } from '@/components/admin/FeatureToggle';
import { sharedCandidates } from '@/lib/learning';
import { adminSummary } from '@/lib/metrics';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

/** 최소 어드민: 지표 요약, 오류 신고, 생성 실패, 비용 (PRD §31) */
export default async function AdminPage({ searchParams }: { searchParams: { token?: string } }) {
  if (!process.env.ADMIN_TOKEN || searchParams.token !== process.env.ADMIN_TOKEN) notFound();
  const s = await adminSummary();
  const store = getStore();
  const shared = await sharedCandidates();
  const reported = await Promise.all(s.reports.map(async r => ({ r, drop: await store.getDrop(r.dropId) })));

  const cards: [string, string | number][] = [
    ['사용자', s.users],
    ['활성화', s.activated],
    ['주간 학습일 평균 (최근 7일, 활성화)', s.weeklyLearningDays],
    ['D7 학습 리텐션 (명)', s.d7Retained],
    ['완료 Drop', s.dropsCompleted],
    ['AI 비용 누적', `₩${s.costKrwTotal.toLocaleString()}`],
    ['완료 Drop당 AI 비용 (7일, 상한 ₩110)', s.costKrwPerCompletedDrop7d === null ? '-' : `₩${s.costKrwPerCompletedDrop7d}`],
    ['TTFD p50 / p90 (상한 90초)', `${s.ttfdP50Sec}초 / ${s.ttfdP90Sec}초`],
    ['오류 신고율 (상한 2%)', `${s.reportRate}%`],
    ['알림 허용', s.notifyGranted],
    ['코스 완료자 / 사전 구독 신청', `${s.courseCompleters} / ${s.presubscribed}`],
  ];

  return (
    <main className="p-5 text-sm">
      <h1 className="text-xl font-bold">Minicovery 어드민</h1>
      <div className="mt-4 grid grid-cols-2 gap-2">
        {cards.map(([k, v]) => (
          <div key={k} className="rounded-xl bg-shape-depth1 p-3">
            <div className="text-xs text-txt-black-tertiary">{k}</div>
            <div className="mt-1 text-lg font-bold">{v}</div>
          </div>
        ))}
      </div>
      <h2 className="mt-8 font-bold">오류 신고 ({s.reports.length})</h2>
      <ul className="mt-2 flex flex-col gap-1">
        {reported.map(({ r, drop }) => (
          <li key={r.id} className="rounded-lg border border-border-div p-2">
            {r.at.slice(0, 16)} · {drop?.title ?? r.dropId}
          </li>
        ))}
      </ul>
      <h2 className="mt-8 font-bold">추천 코스 후보 ({shared.length})</h2>
      <p className="mt-1 text-xs text-txt-black-tertiary">완주한 사용자가 추천을 켠 코스. 고른 코스만 새 코스 화면에 보여요 (만든 사람은 드러나지 않음)</p>
      <ul className="mt-2 flex flex-col gap-1">
        {shared.map(c => (
          <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-border-div p-2">
            <span>
              {c.title} · {c.category} · {c.outline.length}편 · 받음 {c.copies ?? 0}
            </span>
            <FeatureToggle courseId={c.id} featured={Boolean(c.featured)} token={searchParams.token!} />
          </li>
        ))}
      </ul>
      <h2 className="mt-8 font-bold">생성 실패 (최근 50)</h2>
      <ul className="mt-2 flex flex-col gap-1">
        {s.failures.map(f => (
          <li key={f.id} className="rounded-lg border border-border-div p-2">
            {f.at.slice(0, 16)} · {f.stage} · {f.message}
          </li>
        ))}
      </ul>
    </main>
  );
}
