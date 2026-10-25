'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { postJson } from '@/lib/client/ndjson';
import type { CourseCard } from '@/lib/views';

import { TomorrowList } from '../TomorrowList';
import { AppHeader, BottomNav, CHARACTER, IconClose, Main, PrimaryButton, Screen } from '../ui';

type Props = {
  dateLabel: string;
  cards: CourseCard[];
  pickedId?: string;
  doneToday: { dropId: string; title: string; courseId: string } | null;
  tomorrow: CourseCard | null;
  weekDays: number;
  stage: { key: 'rabbit' | 'cat' };
  showNotifyBanner: boolean;
};

const CHIPS = ['행동경제학', '진화론', '와인'];

/** 오늘: 한 장 카드(읽을 Drop) · 다 읽음 · 코스 없음 세 상태. 머리(날짜·제목·캐릭터)는 같다 */
export function TodayScreen({ dateLabel, cards, pickedId, doneToday, tomorrow, weekDays, stage, showNotifyBanner }: Props) {
  const router = useRouter();
  const [picked, setPicked] = useState(pickedId ?? cards[0]?.id);
  const [banner, setBanner] = useState(showNotifyBanner);
  const [busy, setBusy] = useState(false);
  const cur = cards.find(c => c.id === picked);
  const others = cards.filter(c => c.id !== picked);
  const ch = CHARACTER[stage.key];
  const upcoming = cards
    .filter(c => c.nextTitle)
    .map(c => ({ id: c.id, topic: c.topic, index: c.done, total: c.total, title: c.nextTitle! }));

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
            <p className="text-sm text-txt-black-tertiary">
              {dateLabel}
              {weekDays ? ` · 이번 주 ${weekDays}일째` : ''}
            </p>
            <h1 className="text-[28px] font-bold leading-9 tracking-[-1px]">오늘의 Drop</h1>
          </div>
          <Link href="/map" aria-label={`${ch.name} 단계 · 내 학습 보기`} className="-my-5 -mr-2 flex-shrink-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ch.still} alt="" className="h-24 w-24 object-contain" />
          </Link>
        </div>

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
            <h2 className="mt-3 text-2xl font-bold tracking-[-1px]">
              내일 아침에
              <br />
              다음 Drop이 열려요
            </h2>
            {upcoming.length ? (
              <div className="mt-4 flex flex-col gap-2">
                <p className="text-sm font-bold text-txt-black-secondary">내일의 Drop</p>
                <TomorrowList items={upcoming} tomorrowId={tomorrow?.id} size="md" />
              </div>
            ) : null}
            <Link
              href={`/drop/${doneToday.dropId}`}
              className="mc-press mt-5 flex h-14 items-center justify-center rounded-full border border-border-button bg-shape-white text-base font-semibold"
            >
              오늘 읽은 Drop 다시 보기
            </Link>
          </section>
        ) : cur ? (
          <>
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
                {cur.topic} · Drop {cur.done + 1} / {cur.total}
              </p>
              <h2 className="mt-1 text-2xl font-bold tracking-[-1px]">{cur.nextTitle}</h2>
              <div className="mt-4 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[rgba(255,255,255,0.3)]">
                  <div className="h-full rounded-full bg-shape-white" style={{ width: `${Math.round((cur.done / Math.max(1, cur.total)) * 100)}%` }} />
                </div>
                <span className="text-sm font-semibold">{cur.total - cur.done}편 남음</span>
              </div>
              <button
                type="button"
                onClick={() => void read()}
                className="mc-press mt-5 flex h-14 items-center justify-center rounded-full bg-shape-white text-base font-semibold text-txt-point"
              >
                {busy ? '여는 중…' : '읽기 시작'}
              </button>
            </section>
            {!cur.ready ? <p className="mt-3 text-sm text-txt-black-tertiary">이 코스는 지금 만들어서 30초쯤 걸려요.</p> : null}

            <section className="mt-8 flex flex-col gap-2">
              {others.length ? <h2 className="text-sm font-bold text-txt-black-secondary">다른 코스로 받기</h2> : null}
              {others.map(c => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setPicked(c.id)}
                  className="mc-press flex min-h-16 w-full items-center gap-3 rounded-2xl border border-border-div bg-shape-white py-3 pl-5 pr-4 text-left"
                >
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="text-sm text-txt-black-tertiary">
                      {c.topic} · Drop {c.done + 1} / {c.total}
                    </span>
                    <span className="text-base font-semibold">{c.nextTitle}</span>
                  </span>
                  <span className="flex-shrink-0 text-sm font-semibold text-txt-point">바꾸기</span>
                </button>
              ))}
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
                  href={`/start?topic=${encodeURIComponent(t)}`}
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

        {cur || doneToday ? (
          <Link href="/start" className="mt-4 flex min-h-11 items-center self-center px-3 text-sm text-txt-black-tertiary underline">
            새 주제로 코스 만들기
          </Link>
        ) : null}
      </Main>
      <BottomNav active="today" />
    </Screen>
  );
}
