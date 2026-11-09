'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useState } from 'react';

import { postJson } from '@/lib/client/ndjson';
import { josa } from '@/lib/josa';
import type { Recommended } from '@/lib/learning';
import type { PlusUsage } from '@/lib/service';
import type { HomeStats } from '@/lib/stats';
import type { CourseCard } from '@/lib/views';

import { CatIcon } from '../CatIcon';
import { Doodle } from '../Doodle';
import { PlusLeft } from '../PlusLeft';
import { RecallCard, type RecallLike } from '../RecallCard';
import { RecommendList } from '../RecommendList';
import { TomorrowList } from '../TomorrowList';
import { AppHeader, Badge, BottomNav, CHARACTER, IconArrow, IconClose, Main, OutlineButton, PrimaryButton, Screen, cx } from '../ui';

type Props = {
  dateLabel: string;
  cards: CourseCard[];
  pickedId?: string;
  doneToday: { dropId: string; title: string; courseId: string } | null;
  /** 오늘 이미 읽은 코스 (Plus가 한 편 더 읽을 때) */
  readToday?: string[];
  /** Plus: 오늘 한 편 읽었고 다른 코스 한 편이 더 남음 */
  moreToday?: boolean;
  tomorrow: CourseCard | null;
  weekDays: number;
  weekDrops: number;
  stats: HomeStats;
  stage: { key: 'rabbit' | 'cat' };
  usage: PlusUsage | null;
  showNotifyBanner: boolean;
  /** KST 요일 0=일~6=토 (없으면 클라이언트에서 계산) */
  weekday?: number;
  /** 진행 중 코스가 없고 최근에 다 배운 주제 */
  justLearned?: { topic: string; courseId: string } | null;
  /** 마지막으로 읽은 뒤 지난 날 수 (2 이상이면 오랜만 배너) */
  daysSinceLastRead?: number | null;
  /** 오늘 아직 완료 전일 때 홈에 보여 줄 되짚기 */
  recall?: RecallLike | null;
  /** 로그인 때 이 기기의 코스를 계정에 합쳤음 (1회만 온다) */
  mergeNotice?: { topics: string[] } | null;
  /** 가입 전 임시 계정이면 가입 카드를 보여 준다 */
  anon?: boolean;
  /** 다른 사람들이 만든 코스 (첫 20개, 많이 눌러본 순) */
  recommended?: Recommended[];
  /** 더 불러올 추천 코스가 있음 (아래로 내리면 20개씩) */
  recommendedMore?: boolean;
};

const TOPICS = [
  { name: '행동경제학', category: '경제·금융' },
  { name: '진화론', category: '과학' },
  { name: '와인', category: '음식·와인' },
];

const CARD = 'rounded-card border border-fuse-line bg-fuse-card p-4';

/** 홈 (캔버스 홈 · 홈 · 다 읽음 · 홈 · 코스 없음): 읽을 Drop이 있을 때 · 오늘 다 읽음 · 코스 없음 세 상태. 맨 아래는 다른 사람들이 만든 코스 */
export function TodayScreen({
  dateLabel,
  cards,
  pickedId,
  doneToday,
  readToday = [],
  moreToday = false,
  tomorrow,
  weekDays,
  stats,
  stage,
  usage,
  showNotifyBanner,
  justLearned,
  daysSinceLastRead,
  recall,
  mergeNotice,
  anon,
  recommended = [],
  recommendedMore = false,
}: Props) {
  const router = useRouter();
  const [picked, setPicked] = useState(pickedId ?? cards[0]?.id);
  const [banner, setBanner] = useState(showNotifyBanner);
  const [merged, setMerged] = useState(Boolean(mergeNotice?.topics.length));
  const [busy, setBusy] = useState(false);
  const cur = cards.find(c => c.id === picked);
  const ch = CHARACTER[stage.key];
  const upcoming = cards
    .filter(c => c.nextTitle)
    .map(c => ({ id: c.id, topic: c.topic, index: c.done, total: c.total, title: c.nextTitle!, category: c.category }));
  const noCourse = cards.length === 0;
  const longGap = typeof daysSinceLastRead === 'number' && daysSinceLastRead >= 2;

  const read = async () => {
    if (!cur?.nextDropId || busy) return;
    setBusy(true);
    await postJson('/api/today/pick', { courseId: cur.id });
    router.push(`/drop/${cur.nextDropId}`);
  };

  const character = (
    <Link href="/map" aria-label={`${ch.name} 단계 · 내 학습 보기`} className="-mb-1 flex-shrink-0">
      <Doodle animal={stage.key} act={noCourse && !doneToday ? 'look' : doneToday ? 'hello' : 'idle'} className="h-20 w-20" />
    </Link>
  );

  const notices = (
    <>
      {merged && mergeNotice ? (
        <div className={cx('mc-in mt-5 flex items-start justify-between gap-2', CARD, 'py-3 pr-1')}>
          <p className="py-1 text-sm text-fuse-sub">
            이 기기의 ‘{mergeNotice.topics.join('’, ‘')}’ 코스를 계정에 합쳤어요.
            {!usage && cards.length > 1 ? ' 무료는 한 번에 한 코스라 나머지는 쉬는 중으로 두었어요.' : ''}
          </p>
          <button type="button" aria-label="안내 닫기" className="flex h-11 w-11 flex-shrink-0 items-center justify-center" onClick={() => setMerged(false)}>
            <IconClose size={18} color="#A1A1A6" />
          </button>
        </div>
      ) : null}
      {anon && (doneToday || cards.some(c => c.done > 0)) ? (
        <Link href="/signup?next=/today" className={cx('mt-3 flex items-center gap-3.5', CARD)}>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-base font-semibold leading-[1.3]">가입하고 기록 저장하기</span>
            <span className="text-[13px] text-fuse-sub">기기를 바꿔도 읽던 코스를 이어 가요</span>
          </span>
          <IconArrow />
        </Link>
      ) : null}
      {banner ? (
        <div className={cx('mt-3 flex items-center justify-between gap-2', CARD, 'py-3 pr-1')}>
          <Link href="/settings" className="flex flex-col gap-0.5">
            <span className="text-sm font-semibold">내일 Drop 알림을 받아 보세요</span>
            <span className="text-[13px] text-fuse-sub">새 Drop을 잊지 않게 아침 8시에 알려드려요.</span>
          </Link>
          <button
            type="button"
            aria-label="알림 안내 닫기"
            className="flex h-11 w-11 flex-shrink-0 items-center justify-center"
            onClick={() => {
              setBanner(false);
              void postJson('/api/me/notify', { dismissBanner: true });
            }}
          >
            <IconClose size={18} color="#A1A1A6" />
          </button>
        </div>
      ) : null}
    </>
  );

  const recs = <RecommendList items={recommended} hasMore={recommendedMore} className="mt-10" />;

  const review = weekDays ? (
    <Link href="/review" className={cx('mt-3 flex items-center gap-3.5', CARD)}>
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] bg-fuse-ink">
        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-base font-semibold leading-[1.3]">이번 주 복습</span>
        <span className="text-[13px] text-fuse-sub">이번 주에 배운 한 문장 {stats.week.count}개</span>
      </span>
      <IconArrow />
    </Link>
  ) : null;

  // 오늘 다 읽음
  if (doneToday) {
    return (
      <Screen>
        <AppHeader layout="large" title="오늘의 Drop" />
        <Main className="pb-32 pt-5">
          <section className="flex items-end justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-2.5">
              <span className="text-sm text-fuse-sub">
                {dateLabel}
                {weekDays ? ` · 이번 주 ${weekDays}일째` : ''}
              </span>
              {noCourse ? (
                <h2 className="text-[28px] font-bold leading-[1.3]">
                  {justLearned ? `‘${justLearned.topic}’${josa(justLearned.topic, '을/를').slice(justLearned.topic.length)} 다 배웠어요` : '진행 중인 코스가 없어요'}
                </h2>
              ) : (
                <h2 className="text-[28px] font-bold leading-[1.3]">
                  다음 Drop은
                  <br />
                  내일 0시에 열려요
                </h2>
              )}
            </div>
            {character}
          </section>
          {notices}
          {noCourse ? (
            <div className="mt-6 flex flex-col gap-2.5">
              <p className="text-[13px] text-fuse-sub">새 주제를 골라 두면 내일부터 이어져요.</p>
              <PrimaryButton href="/start">새 주제 시작하기</PrimaryButton>
              <OutlineButton href={`/drop/${doneToday.dropId}`}>오늘 읽은 Drop 다시 보기</OutlineButton>
            </div>
          ) : (
            <>
              {upcoming.length ? (
                <section aria-label="내일 받을 코스" className="mt-8 flex flex-col gap-2.5">
                  <h2 className="text-base font-semibold leading-[1.3]">{upcoming.length > 1 ? '내일 받을 코스' : '내일 받을 Drop'}</h2>
                  <TomorrowList items={upcoming} tomorrowId={tomorrow?.id} />
                </section>
              ) : null}
              <div className="mt-6 flex flex-col gap-2.5">
                <PrimaryButton href={`/drop/${doneToday.dropId}`}>오늘 읽은 Drop 다시 보기</PrimaryButton>
                <OutlineButton href="/start">새 주제로 코스 만들기</OutlineButton>
              </div>
            </>
          )}
          <PlusLeft usage={usage} />
          {review}
          {recs}
        </Main>
        <BottomNav active="today" />
      </Screen>
    );
  }

  // 진행 중인 코스 없음
  if (!cur) {
    return (
      <Screen>
        <AppHeader layout="large" title="오늘의 Drop" />
        <Main className="pb-32 pt-5">
          <section className="flex items-end justify-between gap-3">
            <div className="flex min-w-0 flex-col gap-2.5">
              <span className="text-sm text-fuse-sub">{dateLabel}</span>
              <h2 className="text-[28px] font-bold leading-[1.3]">
                요즘 궁금한 걸
                <br />
                코스로 만들어 볼까요?
              </h2>
            </div>
            {character}
          </section>
          {notices}
          <section aria-label="추천 주제" className="mt-8 grid grid-cols-3 gap-2.5">
            {TOPICS.map(t => (
              <Link
                key={t.name}
                href={`/start?topic=${encodeURIComponent(t.name)}&go=1`}
                className={cx('flex min-h-[104px] flex-col justify-between gap-4', CARD)}
              >
                <CatIcon category={t.category} />
                <span className="text-sm font-semibold leading-[1.3]">{t.name}</span>
              </Link>
            ))}
          </section>
          <PrimaryButton href="/start" className="mt-6">
            주제 입력하기
          </PrimaryButton>
          {recs}
        </Main>
        <BottomNav active="today" />
      </Screen>
    );
  }

  // 오늘 읽을 Drop이 있음
  return (
    <Screen>
      <AppHeader layout="large" title="오늘의 학습" />
      <Main className="pb-32 pt-5">
        <Stats stats={stats} character={character} />
        {notices}

        {longGap ? (
          <button
            type="button"
            onClick={() => document.getElementById('recall')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
            disabled={!recall}
            className={cx('mt-3 flex w-full flex-col gap-0.5 text-left', CARD)}
          >
            <span className="text-[13px] font-medium text-fuse-hot">{daysSinceLastRead}일 만이에요</span>
            <span className="text-sm text-fuse-sub">지난 Drop 한 문장부터 가볍게 떠올리고 이어가요.</span>
          </button>
        ) : null}

        <button type="button" onClick={() => void read()} className="mc-press mt-5 flex items-center gap-3.5 rounded-card border border-fuse-line bg-shape-white p-4 text-left">
          <span className="flex min-w-0 flex-1 flex-col gap-1">
            <span className="text-[13px] text-fuse-sub">
              오늘의 Drop · {cur.topic} {cur.nextIndex ?? cur.done + 1} / {cur.total}
            </span>
            <span className="text-base font-semibold leading-[1.3]">{cur.nextTitle}</span>
          </span>
          <span className="inline-flex h-10 flex-shrink-0 items-center rounded-full bg-fuse-ink px-4 text-sm font-semibold text-txt-white-primary">
            {busy ? '여는 중…' : '읽기'}
          </span>
        </button>
        {moreToday ? <p className="mt-2 text-[13px] font-medium text-fuse-hot">Plus라 오늘 다른 코스 한 편을 더 읽을 수 있어요.</p> : null}
        {!cur.ready ? <p className="mt-2 text-[13px] text-fuse-sub">오늘 Drop은 지금 써 드려요. 그림과 함께 30초쯤 걸려요.</p> : null}

        {recall ? <RecallCard recall={recall} id="recall" className="mt-3" /> : null}

        <section aria-label="진행 중인 코스" className="mt-3 grid grid-cols-2 gap-2.5">
          {cards.map(c => {
            const today = c.id === picked;
            const readNow = readToday.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => (today || readNow ? router.push(`/course/${c.id}`) : setPicked(c.id))}
                aria-label={today || readNow ? `${c.topic} 코스 보기` : `오늘 ${c.topic} 코스로 읽기`}
                className={cx('mc-press flex h-32 flex-col justify-between text-left', CARD)}
              >
                <span className="flex w-full items-start justify-between">
                  <CatIcon category={c.category} />
                  <span className={cx('text-[13px] font-medium', today ? 'text-fuse-hot' : 'text-fuse-sub')}>{readNow ? '오늘 읽음' : today ? '오늘' : '이걸로 읽기'}</span>
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="truncate text-sm text-fuse-sub">{c.topic}</span>
                  <span className="text-base font-semibold leading-[1.3]">
                    {c.done}
                    <span className="text-fuse-mute"> / {c.total}편</span>
                  </span>
                </span>
              </button>
            );
          })}
          <Link href="/start" className="mc-press flex h-32 flex-col justify-between rounded-card border-[1.5px] border-dashed border-fuse-edge bg-shape-white p-4">
            <span className="flex h-[30px] w-[30px] items-center justify-center rounded-[9px] bg-fuse-ink">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 5v14M5 12h14" stroke="#FFFFFF" strokeWidth="2.2" strokeLinecap="round" />
              </svg>
            </span>
            <span className="flex flex-col gap-0.5">
              <span className="text-base font-semibold leading-[1.3]">새 코스</span>
              <span className="text-[13px] text-fuse-faint">궁금한 주제로 시작</span>
            </span>
          </Link>
        </section>
        {cards.length > 1 ? <p className="mt-2 text-[13px] text-fuse-sub">다른 코스 카드를 누르면 오늘은 그 코스로 읽어요. 읽기 전까지 바꿀 수 있어요.</p> : null}
        <PlusLeft usage={usage} className="mt-3" />
        {review}
        {recs}
      </Main>
      <BottomNav active="today" />
    </Screen>
  );
}

const PERIODS = [
  { key: 'week', label: '주' },
  { key: 'month', label: '월' },
  { key: 'all', label: '전체' },
] as const;

/** 홈 위쪽 숫자 (캔버스 홈): 주·월·전체 읽은 Drop, 막대 하나 = 하루(전체는 한 주). 오늘 막대만 검정 */
function Stats({ stats, character }: { stats: HomeStats; character: ReactNode }) {
  const [period, setPeriod] = useState<(typeof PERIODS)[number]['key']>('week');
  const view =
    period === 'week'
      ? { label: '이번 주 읽은 Drop', count: stats.week.count, bars: stats.week.days, today: stats.week.todayIndex, badge: stats.week.streak >= 2 ? `${stats.week.streak}일 연속` : '' }
      : period === 'month'
        ? { label: '이번 달 읽은 Drop', count: stats.month.count, bars: stats.month.days, today: stats.month.todayIndex, badge: stats.month.diff > 0 ? `지난달보다 +${stats.month.diff}` : '' }
        : { label: '지금까지 읽은 Drop', count: stats.all.count, bars: stats.all.weeks, today: stats.all.weeks.length - 1, badge: stats.all.learned ? `주제 ${stats.all.learned}개 다 배움` : '' };
  return (
    <>
      <section className="flex items-end justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <span className="text-sm text-fuse-sub">{view.label}</span>
            {view.badge ? (
              <Badge>
                <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
                  <rect width="14" height="14" rx="3" fill="#FF4D6D" />
                  <path d="M4.5 9.5 9.5 4.5M5.5 4.5h4v4" stroke="#FFFFFF" strokeWidth="1.6" fill="none" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {view.badge}
              </Badge>
            ) : null}
          </div>
          <p className="text-[52px] font-bold leading-none">
            {view.count}
            <span className="ml-[3px]">편</span>
          </p>
        </div>
        {character}
      </section>
      <div aria-hidden="true" className="mt-9 flex h-10 items-end justify-between">
        {view.bars.map((on, i) => (
          <span
            key={i}
            className="block w-[1.5px] rounded-[1px]"
            style={{
              height: i === view.today ? 40 : on ? 22 : 10,
              background: i === view.today ? '#0B0B0C' : on ? '#C7C7CC' : '#E5E5EA',
            }}
          />
        ))}
      </div>
      <div role="tablist" aria-label="기간" className="mt-4 grid grid-cols-3 gap-1 px-12">
        {PERIODS.map(p => (
          <button
            key={p.key}
            type="button"
            role="tab"
            aria-selected={period === p.key}
            onClick={() => setPeriod(p.key)}
            className={cx('h-11 rounded-full text-[13px]', period === p.key ? 'font-semibold text-fuse-ink' : 'font-medium text-fuse-faint')}
          >
            {p.label}
          </button>
        ))}
      </div>
    </>
  );
}
