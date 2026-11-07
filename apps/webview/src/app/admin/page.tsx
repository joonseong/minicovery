import { cookies, headers } from 'next/headers';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';

import { AdminShell } from '@/components/admin/AdminShell';
import { FeatureToggle } from '@/components/admin/FeatureToggle';
import { IapTestButton } from '@/components/admin/IapTestButton';
import { ADMIN_COOKIE, adminTokenOk } from '@/lib/auth';
import { accountRows, peopleSummary } from '@/lib/dashboard';
import { sharedCandidates } from '@/lib/learning';
import { adminSummary } from '@/lib/metrics';
import { getStore } from '@/lib/store';
import { kstDate, kstTime } from '@/lib/util';

export const dynamic = 'force-dynamic';

/**
 * 최소 어드민: 지표 요약, 오류 신고, 생성 실패, 비용 (PRD §31).
 * 접근: 쿠키(mc_admin) 또는 x-admin-token 헤더. /admin?token=… 으로 오면 쿠키를 심는 라우트로 보내 주소에서 토큰을 지운다
 */
export default async function AdminPage({ searchParams }: { searchParams: { token?: string } }) {
  if (!process.env.ADMIN_TOKEN) notFound();
  if (searchParams.token) {
    if (!adminTokenOk(searchParams.token)) notFound();
    redirect(`/api/admin/session?token=${encodeURIComponent(searchParams.token)}`);
  }
  if (!adminTokenOk(cookies().get(ADMIN_COOKIE)?.value) && !adminTokenOk(headers().get('x-admin-token'))) notFound();

  const s = await adminSummary();
  const accounts = await accountRows();
  const people = await peopleSummary();
  const when = (iso?: string) => (iso ? `${kstDate(iso).slice(5).replace('-', '/')} ${kstTime(iso)}` : '-');
  const NOTIFY: Record<string, string> = { granted: '허용', denied: '거절', unknown: '-' };
  const store = getStore();
  const shared = await sharedCandidates();
  const reported = await Promise.all(s.reports.map(async r => ({ r, drop: await store.getDrop(r.dropId) })));
  const REASON: Record<string, string> = { wrong: '틀린 사실', unclear: '이해 안 됨', inappropriate: '부적절' };

  const cards: [string, string | number][] = [
    ['사용자 (기록이 있는 사람, 시드 제외)', `${people.login + people.anon}명 · 로그인 ${people.login} · 비로그인 ${people.anon}`],
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
    ['Plus 구독자 (그중 Sandbox)', `${s.plusUsers} (${s.plusSandbox})`],
    ['빈 사용자 행 (사람 수에서 뺌: 10/31 전 첫 방문마다 생긴 행 등)', people.emptyRows],
  ];

  return (
    <AdminShell>
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-xl font-bold">Minicovery 어드민</h1>
        <Link href="/admin/dashboard" className="rounded-full bg-fuse-ink px-4 py-2 text-sm font-semibold text-txt-white-primary">
          대시보드 보기
        </Link>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
        {cards.map(([k, v]) => (
          <div key={k} className="rounded-xl bg-shape-depth1 p-3">
            <div className="text-xs text-txt-black-tertiary">{k}</div>
            <div className="mt-1 text-lg font-bold">{v}</div>
          </div>
        ))}
      </div>
      <h2 className="mt-8 font-bold">로그인한 사용자 ({accounts.length})</h2>
      <p className="mt-1 text-xs text-txt-black-tertiary">가입한 계정만, 최근 활동 순. 한국 시간</p>
      <div className="mt-2 overflow-x-auto rounded-xl border border-fuse-line">
        <table className="w-full min-w-[880px] text-xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
          <thead>
            <tr className="text-left text-txt-black-tertiary">
              {['로그인 방법', '이메일', '가입', '마지막 활동', '코스', '완료 Drop', 'Plus', '알림', 'id'].map(h => (
                <th key={h} className={h === '코스' || h === '완료 Drop' ? 'px-3 py-2 text-right font-medium' : 'px-3 py-2 font-medium'}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {accounts.map(a => (
              <tr key={a.id} className="border-t border-fuse-line">
                <td className="px-3 py-2">{a.methods.join(' · ') || '-'}</td>
                <td className="px-3 py-2">{a.email ?? '-'}</td>
                <td className="px-3 py-2">{when(a.signedUpAt)}</td>
                <td className="px-3 py-2">{when(a.lastActiveAt)}</td>
                <td className="px-3 py-2 text-right">{a.courses}</td>
                <td className="px-3 py-2 text-right">{a.drops}</td>
                <td className="px-3 py-2">{a.plus ?? '-'}</td>
                <td className="px-3 py-2">{NOTIFY[a.notify] ?? a.notify}</td>
                <td className="px-3 py-2 text-txt-black-tertiary">{a.id.slice(0, 8)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h2 className="mt-8 font-bold">App Store 서버 알림 점검</h2>
      <p className="mt-1 text-xs text-txt-black-tertiary">
        Apple에 테스트 알림을 요청해 /api/iap/notify가 서명 검증을 통과하고 200을 돌려주는지 확인해요 (App Store Connect에는 버튼이 없어요)
      </p>
      <IapTestButton />
      <h2 className="mt-8 font-bold">오류 신고 ({s.reports.length})</h2>
      <ul className="mt-2 flex flex-col gap-1">
        {reported.map(({ r, drop }) => (
          <li key={r.id} className="rounded-lg border border-border-div p-2">
            {r.at.slice(0, 16)} · {drop?.title ?? r.dropId}
            {r.reason ? ` · ${REASON[r.reason] ?? r.reason}` : ''}
          </li>
        ))}
      </ul>
      <h2 className="mt-8 font-bold">추천 코스 후보 ({shared.length})</h2>
      <p className="mt-1 text-xs text-txt-black-tertiary">완주한 사용자가 추천을 켠 코스는 새 코스 화면에 많이 눌러본 순으로 바로 보여요. 숨김을 누르면 빠져요 (만든 사람은 드러나지 않음)</p>
      <ul className="mt-2 flex flex-col gap-1">
        {shared.map(c => (
          <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg border border-border-div p-2">
            <span>
              {c.title} · {c.category} · {c.outline.length}편 · 열어 봄 {c.opens ?? 0} · 받음 {c.copies ?? 0}
            </span>
            <FeatureToggle courseId={c.id} featured={c.featured !== false} />
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
    </AdminShell>
  );
}
