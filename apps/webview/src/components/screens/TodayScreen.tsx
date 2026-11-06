'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { postJson } from '@/lib/client/ndjson';
import { josa } from '@/lib/josa';
import type { PlusUsage } from '@/lib/service';
import type { CourseCard } from '@/lib/views';

import { PlusLeft } from '../PlusLeft';
import { RecallCard, type RecallLike } from '../RecallCard';
import { Doodle } from '../Doodle';
import { TomorrowList } from '../TomorrowList';
import { AppHeader, BottomNav, CHARACTER, IconClose, Main, OutlineButton, PrimaryButton, Screen } from '../ui';

type Props = {
  dateLabel: string;
  cards: CourseCard[];
  pickedId?: string;
  doneToday: { dropId: string; title: string; courseId: string } | null;
  tomorrow: CourseCard | null;
  weekDays: number;
  weekDrops: number;
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
};

const CHIPS = ['행동경제학', '진화론', '와인'];

/** 오늘: 한 장 카드(읽을 Drop) · 다 읽음 · 코스 없음 세 상태. 머리(날짜·제목·캐릭터)는 같다 */
export function TodayScreen({
  dateLabel,
  cards,
  pickedId,
  doneToday,
  tomorrow,
  weekDays,
  weekDrops,
  stage,
  usage,
  showNotifyBanner,
  weekday,
  justLearned,
  daysSinceLastRead,
  recall,
  mergeNotice,
  anon,
}: Props) {
  const router = useRouter();
  const [picked, setPicked] = useState(pickedId ?? cards[0]?.id);
  const [banner, setBanner] = useState(showNotifyBanner);
  const [merged, setMerged] = useState(Boolean(mergeNotice?.topics.length));
  const [busy, setBusy] = useState(false);
  const cur = cards.find(c => c.id === picked);
  const others = cards.filter(c => c.id !== picked);
  const ch = CHARACTER[stage.key];
  // 토·일 (KST)
  const day = weekday ?? new Date(Date.now() + 9 * 3600_000).getUTCDay();
  const weekend = day === 0 || day === 6;
  const upcoming = cards
    .filter(c => c.nextTitle)
    .map(c => ({ id: c.id, topic: c.topic, index: c.done, total: c.total, title: c.nextTitle! }));
  const noCourse = cards.length === 0;
  const longGap = typeof daysSinceLastRead === 'number' && daysSinceLastRead >= 2;

  const read = async () => {
    if (!cur?.nextDropId || busy) return;
    setBusy(true);
    await postJson('/api/today/pick', { courseId: cur.id });
    router.push(`/drop/${cur.nextDropId}`);
  };

  return (
    <Screen>
      <AppHeader layout="logo" settings />
      <Main className="pb-8 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-sm text-txt-black-secondary">
              {dateLabel}
              {weekDrops ? ` · 이번 주 ${weekDrops}편 읽음` : ''}
            </p>
            <h1 className="text-[28px] font-bold leading-9 tracking-[-1px]">오늘의 Drop</h1>
          </div>
          <Link href="/map" aria-label={`${ch.name} 단계 · 내 학습 보기`} className="-my-5 -mr-2 flex-shrink-0">
            <Doodle animal={stage.key} act={noCourse ? 'look' : doneToday ? 'hello' : 'idle'} className="h-24 w-24" />
          </Link>
        </div>

        {merged && mergeNotice ? (
          <div className="mc-in mt-5 flex items-start justify-between gap-2 rounded-2xl bg-shape-depth1 py-3 pl-4 pr-1">
            <p className="py-1 text-sm text-txt-black-secondary">
              이 기기의 ‘{mergeNotice.topics.join('’, ‘')}’ 코스를 계정에 합쳤어요.
              {!usage && cards.length > 1 ? ' 무료는 한 번에 한 코스라 나머지는 쉬는 중으로 두었어요.' : ''}
            </p>
            <button type="button" aria-label="안내 닫기" className="flex h-11 w-11 flex-shrink-0 items-center justify-center" onClick={() => setMerged(false)}>
              <IconClose size={20} color="#9FA0AA" />
            </button>
          </div>
        ) : null}

        {anon && (doneToday || cards.some(c => c.done > 0)) ? (
          <Link href="/signup?next=/today" className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-shape-depth1 py-4 pl-5 pr-4">
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-bold text-txt-point">가입하고 기록 저장하기</span>
              <span className="text-base font-semibold">기기를 바꿔도 읽던 코스를 이어 가요</span>
            </span>
            <span aria-hidden="true" className="text-txt-black-tertiary">›</span>
          </Link>
        ) : null}

        {weekend && weekDays ? (
          <Link href="/review" className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-border-button py-4 pl-5 pr-4">
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-bold text-txt-point">주말 복습</span>
              <span className="text-base font-semibold">이번 주에 배운 한 문장 다시 보기</span>
            </span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="flex-shrink-0">
              <path d="m9 5 7 7-7 7" stroke="#B4B5C1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
        ) : null}

        {banner ? (
          <div className="mt-5 flex items-center justify-between gap-2 rounded-2xl bg-shape-depth1 py-3 pl-4 pr-1">
            <Link href="/settings" className="flex flex-col gap-0.5">
              <span className="text-sm font-bold">내일 Drop 알림을 받아 보세요</span>
              <span className="text-sm text-txt-black-tertiary">바쁜 날에도 잊지 않게 하루 한 번 알려드려요.</span>
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
              <IconClose size={20} color="#9FA0AA" />
            </button>
          </div>
        ) : null}

        {doneToday ? (
          <section className="mt-5 flex flex-col rounded-2xl bg-shape-depth1 px-5 pb-5 pt-6">
            <div className="flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/img/check.png" alt="" className="h-7 w-7 object-contain" />
              <p className="text-sm font-semibold text-txt-black-secondary">오늘 Drop을 다 읽었어요</p>
            </div>
            {noCourse ? (
              // 진행 중 코스가 없으면 '내일 0시에 열려요'는 거짓이라, 다 배운 주제와 다음 할 일을 말한다
              <>
                <h2 className="mt-3 text-2xl font-bold tracking-[-1px]">
                  {justLearned ? `‘${justLearned.topic}’${josa(justLearned.topic, '을/를').slice(justLearned.topic.length)} 다 배웠어요` : '진행 중인 코스가 없어요'}
                </h2>
                <p className="mt-2 text-base text-txt-black-secondary">새 주제를 골라 두면 내일부터 이어져요.</p>
                <PrimaryButton href="/start" className="mt-5">
                  새 주제 시작하기
                </PrimaryButton>
                <OutlineButton href={`/drop/${doneToday.dropId}`} className="mt-2">
                  오늘 읽은 Drop 다시 보기
                </OutlineButton>
              </>
            ) : (
              <>
                <h2 className="mt-3 text-2xl font-bold tracking-[-1px]">
                  다음 Drop은
                  <br />
                  내일 0시에 열려요
                </h2>
                {upcoming.length ? (
                  <div className="mt-4 flex flex-col gap-2">
                    <p className="text-sm font-bold text-txt-black-secondary">{upcoming.length > 1 ? '내일 받을 코스' : '내일 받을 Drop'}</p>
                    <TomorrowList items={upcoming} tomorrowId={tomorrow?.id} size="md" />
                  </div>
                ) : null}
                <PrimaryButton href={`/drop/${doneToday.dropId}`} className="mt-5">
                  오늘 읽은 Drop 다시 보기
                </PrimaryButton>
                <OutlineButton href="/start" className="mt-2">
                  새 주제로 코스 만들기
                </OutlineButton>
              </>
            )}
            <PlusLeft usage={usage} />
          </section>
        ) : cur ? (
          <>
            {longGap ? (
              <button
                type="button"
                onClick={() => document.getElementById('recall')?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
                disabled={!recall}
                className="mt-5 flex w-full flex-col gap-0.5 rounded-2xl border border-border-button px-5 py-4 text-left"
              >
                <span className="text-sm font-bold text-txt-point">{daysSinceLastRead}일 만이에요</span>
                <span className="text-sm text-txt-black-secondary">지난 Drop 한 문장부터 가볍게 떠올리고 이어가요.</span>
              </button>
            ) : null}
            <section className="mt-5 flex flex-col rounded-2xl bg-shape-brand px-5 pb-5 pt-6 text-txt-white-primary">
              {cur.ready ? (
                <span
                  data-badge
                  className="self-start rounded-full bg-shape-white px-3 py-1 text-[13px] font-bold leading-5 text-txt-point"
                >
                  준비됨
                </span>
              ) : null}
              <p className={`${cur.ready ? 'mt-3' : ''} text-sm font-semibold`}>
                {cur.topic} · Drop {cur.nextIndex ?? cur.done + 1} / {cur.total}
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-[-1px]">{cur.nextTitle}</h2>
              <div className="mt-4 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.3)]">
                  <div className="h-full rounded-full bg-shape-white" style={{ width: `${Math.round((cur.done / Math.max(1, cur.total)) * 100)}%` }} />
                </div>
                <span className="text-sm font-semibold">
                  {cur.done} / {cur.total}편 읽음
                </span>
              </div>
              <button
                type="button"
                onClick={() => void read()}
                className="mc-press mt-5 flex h-14 items-center justify-center rounded-full bg-shape-white text-base font-semibold text-txt-point"
              >
                {busy ? '여는 중…' : '읽기 시작'}
              </button>
            </section>
            {!cur.ready ? <p className="mt-3 text-sm text-txt-black-tertiary">오늘 Drop은 지금 써 드려요. 30초쯤 걸려요.</p> : null}

            {recall ? <RecallCard recall={recall} id="recall" className="mt-5" /> : null}

            <section className="mt-8 flex flex-col gap-2">
              {others.length ? <h2 className="text-sm font-bold text-txt-black-secondary">오늘 다른 코스 읽기</h2> : null}
              {others.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setPicked(c.id)}
                  className="mc-press flex min-h-16 w-full items-center gap-3 rounded-2xl border border-border-div bg-shape-white py-3 pl-5 pr-4 text-left"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm text-txt-black-tertiary">
                      {c.topic} · Drop {c.nextIndex ?? c.done + 1} / {c.total}
                    </span>
                    <span className="text-base font-semibold">{c.nextTitle}</span>
                  </span>
                  <span className="flex-shrink-0 text-sm font-semibold text-txt-point">이걸로 읽기</span>
                </button>
              ))}
              {others.length ? (
                <p className="text-sm text-txt-black-secondary">위 카드가 오늘 읽을 Drop이에요. 읽기 전까지 다른 코스로 바꿀 수 있어요. 어제 고른 ‘내일 받을 코스’가 기본으로 와요.</p>
              ) : null}
              <OutlineButton href="/start" className="mt-4">
                새 주제로 코스 만들기
              </OutlineButton>
              <PlusLeft usage={usage} />
            </section>
          </>
        ) : (
          <section className="mt-5 flex flex-col rounded-2xl bg-shape-depth1 px-5 pb-5 pt-6">
            <p className="text-sm font-semibold text-txt-black-tertiary">진행 중인 코스가 없어요</p>
            <h2 className="mt-1 text-2xl font-bold tracking-[-1px]">
              요즘 궁금한 걸
              <br />
              코스로 만들어 볼까요?
            </h2>
            <div className="mt-4 flex flex-wrap gap-2">
              {CHIPS.map(t => (
                <Link
                  key={t}
                  href={`/start?topic=${encodeURIComponent(t)}&go=1`}
                  className="inline-flex min-h-11 items-center rounded-full bg-shape-white px-4 py-3 text-sm"
                >
                  {t}
                </Link>
              ))}
            </div>
            <PrimaryButton href="/start" className="mt-5">
              주제 입력하기
            </PrimaryButton>
          </section>
        )}

      </Main>
      <BottomNav active="today" />
    </Screen>
  );
}
