import { cookies, headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminShell } from '@/components/admin/AdminShell';
import { ColumnChart, formatValue } from '@/components/admin/ColumnChart';
import { ADMIN_COOKIE, adminTokenOk } from '@/lib/auth';
import { dashboardData, UNIT_LABEL, type Unit } from '@/lib/dashboard';
import { josa } from '@/lib/josa';
import { kstDate, kstTime } from '@/lib/util';

export const dynamic = 'force-dynamic';

/** 기간 이름: 이번 주 · 지난주 */
const WORDS: Record<Unit, { now: string; prev: string }> = {
  day: { now: '오늘', prev: '어제' },
  week: { now: '이번 주', prev: '지난주' },
  month: { now: '이번 달', prev: '지난달' },
};

const PURPOSE: Record<string, string> = { check: '주제 검사', curriculum: '목차', drop: 'Drop 글', verify: '사실 확인', easy: '쉬운 설명', image: '그림' };

/** 재방문 표 색: 파랑 한 가지, 비율이 높을수록 진하게 (진한 칸은 흰 글자) */
const RAMP = ['#F1F5FB', '#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#256abf', '#184f95'];
const rampIndex = (rate: number) => (rate === 0 ? 0 : rate < 0.1 ? 1 : rate < 0.2 ? 2 : rate < 0.35 ? 3 : rate < 0.5 ? 4 : rate < 0.7 ? 5 : 6);

/** components/ui의 cx는 클라이언트 모듈이라 서버 화면에서는 따로 둔다 */
const cx = (...a: (string | false | undefined)[]) => a.filter(Boolean).join(' ');

const pct = (rate: number | null) => (rate === null ? '-' : `${Math.round(rate * 100)}%`);

function Kpi({ label, value, sub, sub2 }: { label: string; value: string; sub: string; sub2?: string }) {
  return (
    <div className="rounded-2xl border border-fuse-line bg-fuse-card p-5">
      <p className="text-xs text-fuse-sub">{label}</p>
      <p className="mt-2 text-3xl font-bold leading-none">{value}</p>
      <p className="mt-2 text-xs text-fuse-sub">{sub}</p>
      {sub2 ? <p className="mt-0.5 text-xs text-fuse-sub">{sub2}</p> : null}
    </div>
  );
}

/** 로그인 a · 비로그인 b */
const splitText = (s: { login: number; anon: number }, unit = '') => `로그인 ${s.login}${unit} · 비로그인 ${s.anon}${unit}`;

/** 어드민 대시보드: 일·주·월 단위로 사용자·재방문·학습·수익·비용을 본다 (PC 넓은 화면) */
export default async function DashboardPage({ searchParams }: { searchParams: { unit?: string } }) {
  if (!process.env.ADMIN_TOKEN) notFound();
  if (!adminTokenOk(cookies().get(ADMIN_COOKIE)?.value) && !adminTokenOk(headers().get('x-admin-token'))) notFound();

  const unit: Unit = searchParams.unit === 'day' || searchParams.unit === 'month' ? searchParams.unit : 'week';
  const d = await dashboardData(unit);
  const words = WORDS[unit];
  const labels = d.periods.map(p => p.label);
  const delta = ([now, prev]: readonly [number, number], format?: 'won') =>
    now === prev ? `${josa(words.prev, '와/과')} 같아요` : `${words.prev} ${formatValue(prev, format)} · ${now > prev ? '▲' : '▼'} ${formatValue(Math.abs(now - prev), format)}`;
  const { d1, d7 } = d.returnRates;
  const step = unit === 'day' ? '일' : unit === 'week' ? '주' : '달';

  return (
    <AdminShell>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link href="/admin" className="text-xs text-fuse-sub underline">
            어드민
          </Link>
          <h1 className="mt-1 text-2xl font-bold">미니커버리 대시보드</h1>
          <p className="mt-1 text-xs text-fuse-sub">
            한국 시간 기준 · 추천 코스 시드 계정 3개 제외 · {kstDate(d.updatedAt)} {kstTime(d.updatedAt)} 기준
          </p>
        </div>
        <nav aria-label="단위" className="flex rounded-full bg-fuse-pill p-1">
          {(['day', 'week', 'month'] as const).map(u => (
            <Link
              key={u}
              href={`/admin/dashboard?unit=${u}`}
              aria-current={u === unit ? 'page' : undefined}
              className={cx('rounded-full px-5 py-2 text-sm font-semibold', u === unit ? 'bg-fuse-ink text-txt-white-primary' : 'text-fuse-sub')}
            >
              {UNIT_LABEL[u]}
            </Link>
          ))}
        </nav>
      </header>

      <section aria-label="핵심 숫자" className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi label={`새 사용자 (${words.now})`} value={formatValue(d.now.newUsers[0], undefined)} sub={delta(d.now.newUsers)} sub2={splitText(d.now.newSplit)} />
        <Kpi label={`활동한 사람 (${words.now})`} value={formatValue(d.now.active[0], undefined)} sub={delta(d.now.active)} sub2={splitText(d.now.activeSplit)} />
        <Kpi
          label="다음 날 재방문율"
          value={pct(d1.all.rate)}
          sub={`${d1.all.back}/${d1.all.cohort}명 · 처음 온 지 2~30일 된 사람`}
          sub2={`로그인 ${pct(d1.login.rate)} · 비로그인 ${pct(d1.anon.rate)}`}
        />
        <Kpi
          label="7일 안 재방문율"
          value={pct(d7.all.rate)}
          sub={`${d7.all.back}/${d7.all.cohort}명 · 처음 온 지 8~60일 된 사람`}
          sub2={`로그인 ${pct(d7.login.rate)} · 비로그인 ${pct(d7.anon.rate)}`}
        />
        <Kpi
          label={`다시 온 사람 (${words.now})`}
          value={formatValue(d.now.returning[0], undefined)}
          sub={delta(d.now.returning)}
          sub2={splitText(d.now.returningSplit)}
        />
        <Kpi
          label="사용자당 코스 수"
          value={`${d.courses.avg.toFixed(1)}개`}
          sub={`중앙값 ${d.courses.median}개 · 코스가 있는 ${d.courses.withCourse}명 기준`}
          sub2={`로그인 ${d.courses.avgLogin.toFixed(1)}개 · 비로그인 ${d.courses.avgAnon.toFixed(1)}개`}
        />
        <Kpi label="Plus 구독자" value={`${d.plus.active}명`} sub={`자동 갱신 끈 ${d.plus.autoRenewOff}명 · Sandbox 제외`} />
        <Kpi label={`AI 비용 (${words.now})`} value={formatValue(d.now.costKrw[0], 'won')} sub={delta(d.now.costKrw, 'won')} />
      </section>

      {d.groups.slice(0, 1).map(g => (
        <section key={g.title} className="mt-10">
          <h2 className="text-base font-bold">{g.title}</h2>
          <p className="mt-1 text-xs text-fuse-sub">
            지금까지 {d.people.login + d.people.anon}명 · {splitText(d.people, '명')}. 로그인은 지금 가입한 계정 기준이라, 나중에 가입하면 그 전 기록도 로그인으로 세요.
          </p>
          <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {g.charts.map(c => (
              <ColumnChart key={c.label} title={c.label} note={c.note} labels={labels} values={c.values} parts={c.parts} format={c.format} unitWord={words} />
            ))}
          </div>
        </section>
      ))}

      <section className="mt-10">
        <h2 className="text-base font-bold">재방문</h2>
        <p className="mt-1 text-xs text-fuse-sub">
          처음 온 {UNIT_LABEL[unit]}별로, 그 뒤 몇 {step} 지나서 다시 활동했는지. 색이 진할수록 많이 돌아왔어요. 흐린 칸은 아직 진행 중인 기간이에요.
        </p>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-fuse-line">
          <table className="w-full min-w-[640px] text-xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
            <thead>
              <tr className="text-fuse-sub">
                <th className="px-4 py-3 text-left font-medium">처음 온 {UNIT_LABEL[unit]}</th>
                <th className="px-4 py-3 text-right font-medium">사람</th>
                {Array.from({ length: d.retention.cols }, (_, j) => (
                  <th key={j} className="px-2 py-3 text-center font-medium">
                    +{j + 1}
                    {step}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {d.retention.rows.map(r => (
                <tr key={r.key} className="border-t border-fuse-line">
                  <td className="px-4 py-2">{r.label}</td>
                  <td className="px-4 py-2 text-right">{r.size}</td>
                  {r.cells.map((c, j) => {
                    if (!c) return <td key={j} className="px-2 py-2" />;
                    const i = rampIndex(c.rate);
                    return (
                      <td key={j} className="px-1 py-1">
                        <div
                          title={`${c.back}/${r.size}명${c.partial ? ' (진행 중)' : ''}`}
                          className={cx('rounded-md py-1.5 text-center font-semibold', i >= 4 ? 'text-txt-white-primary' : 'text-fuse-ink', c.partial && 'opacity-60')}
                          style={{ background: RAMP[i] }}
                        >
                          {pct(c.rate)}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {d.groups.slice(1, 2).map(g => (
        <section key={g.title} className="mt-10">
          <h2 className="text-base font-bold">{g.title}</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {g.charts.map(c => (
              <ColumnChart key={c.label} title={c.label} note={c.note} labels={labels} values={c.values} format={c.format} unitWord={words} />
            ))}
          </div>
        </section>
      ))}

      <section className="mt-10">
        <h2 className="text-base font-bold">사용자당 코스 수</h2>
        <p className="mt-1 text-xs text-fuse-sub">
          만든 코스와 받은 코스를 합쳐서 세요 (만들다 실패한 코스 제외). 처음 온 {d.courses.people}명 중 코스가 있는 사람은 {d.courses.withCourse}명이에요.
        </p>
        <div className="mt-3 grid gap-4 lg:grid-cols-[1fr_2fr]">
          <div className="grid grid-cols-2 gap-3">
            <Kpi label="평균" value={`${d.courses.avg.toFixed(1)}개`} sub="코스가 있는 사람 기준" />
            <Kpi label="중앙값" value={`${d.courses.median}개`} sub="가운데 사람의 코스 수" />
          </div>
          <div className="flex flex-col justify-center gap-3 rounded-2xl border border-fuse-line p-5">
            {['1개', '2개', '3개', '4개 이상'].map((name, i) => {
              const n = d.courses.dist[i]!;
              const share = d.courses.withCourse ? n / d.courses.withCourse : 0;
              return (
                <div key={name} className="flex items-center gap-3">
                  <span className="w-16 flex-shrink-0 text-xs text-fuse-sub">{name}</span>
                  <span className="h-3 flex-1 rounded-r bg-fuse-pill">
                    {n ? <span className="block h-3 rounded-r" style={{ width: `${share * 100}%`, background: '#2a78d6' }} /> : null}
                  </span>
                  <span className="w-24 flex-shrink-0 text-right text-xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
                    {n}명 · {pct(share)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {d.groups.slice(2).map(g => (
        <section key={g.title} className="mt-10">
          <h2 className="text-base font-bold">{g.title}</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {g.charts.map(c => (
              <ColumnChart key={c.label} title={c.label} note={c.note} labels={labels} values={c.values} format={c.format} unitWord={words} />
            ))}
            {g.title === '수익·비용' ? (
              <section className="rounded-2xl border border-fuse-line p-5">
                <h3 className="text-sm font-semibold">AI 비용 나눠 보기</h3>
                <p className="mt-0.5 text-xs text-fuse-sub">{unit === 'week' ? `${labels[0]!.replace('~', '')} 주부터` : `${labels[0]}부터`} 지금까지</p>
                <table className="mt-3 w-full text-xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
                  <tbody>
                    {d.costByPurpose.map(c => (
                      <tr key={c.purpose} className="border-t border-fuse-line">
                        <td className="py-1.5">{PURPOSE[c.purpose] ?? c.purpose}</td>
                        <td className="py-1.5 text-right">{formatValue(c.krw, 'won')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            ) : null}
          </div>
        </section>
      ))}

      <p className="mt-10 text-xs text-fuse-faint">
        활동은 앱 방문(하루 한 번, 2026-11-08부터 기록)·Drop 읽기·코스 만들기 같은 사용자 행동으로 세요. 알림 발송·결제 알림은 빼요. 사람 수는 기기 기준이고,
        가입·로그인하면 그 기기의 기록이 계정으로 합쳐져 한 사람으로 세요.
      </p>
    </AdminShell>
  );
}
