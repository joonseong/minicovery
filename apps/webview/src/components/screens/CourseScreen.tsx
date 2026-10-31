'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { postJson } from '@/lib/client/ndjson';

import { AppHeader, Footer, IconCheck, Main, PrimaryButton, Progress, Screen, Sheet, TextButton } from '../ui';

type D = { id: string; index: number; title: string; done: boolean };

export function CourseScreen(props: {
  courseId: string;
  title: string;
  meta: string;
  drops: D[];
  nextId?: string;
  doneToday: boolean;
  isPicked: boolean;
  isTomorrow: boolean;
  completed: boolean;
  openedAll: boolean;
  /** Plus이고 이번 구독 기간에 전체 열기가 남았을 때 */
  canOpenAll: boolean;
  /** 전체 열기를 쓰면 다시 쓸 수 있는 날 = 다음 결제일 (예: 11월 27일) */
  openAllNext: string;
  /** 이 코스를 열면 내일 대신 받게 될 코스 (이 코스가 내일 받을 코스일 때만) */
  nextTomorrowTopic?: string;
  /** 하루 한 편으로 받는 코스가 2개 이상 (받아요/쉬는 중 배지) */
  multiple: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [tomorrow, setTomorrow] = useState(props.isTomorrow);
  const done = props.drops.filter(d => d.done).length;
  const total = props.drops.length;
  const remaining = total - done;

  const openAll = async () => {
    if (busy) return;
    setBusy(true);
    await postJson(`/api/courses/${props.courseId}/open-all`);
    setSheet(false);
    setBusy(false);
    router.refresh();
  };

  const receiveTomorrow = async () => {
    setTomorrow(true);
    await postJson('/api/tomorrow/pick', { courseId: props.courseId });
  };

  const receive = async () => {
    if (!props.nextId || busy) return;
    setBusy(true);
    await postJson('/api/today/pick', { courseId: props.courseId });
    router.push(`/drop/${props.nextId}`);
  };

  return (
    <Screen className="relative">
      <AppHeader layout="nav" back />
      <Main className="pb-6 pt-4">
        <p className="text-sm font-semibold text-txt-black-tertiary">{props.meta}</p>
        <h1 className="mt-1 text-2xl font-bold tracking-[-1px]">{props.title}</h1>
        {props.multiple && !props.completed && !props.openedAll ? (
          <span
            data-badge
            className={
              tomorrow
                ? 'mt-2 self-start rounded-full bg-shape-brand px-2 py-0.5 text-xs font-bold leading-4 text-txt-white-primary'
                : 'mt-2 self-start rounded-full bg-shape-depth2 px-2 py-0.5 text-xs font-bold leading-4 text-txt-black-tertiary'
            }
          >
            {tomorrow ? '내일 받아요' : '쉬는 중'}
          </span>
        ) : null}
        <div className="mt-4 flex items-center gap-3">
          <Progress value={done / Math.max(1, total)} />
          <span className="flex-shrink-0 text-sm font-semibold text-txt-black-secondary">
            {done} / {total}편 읽음
          </span>
        </div>

        {props.canOpenAll && !props.openedAll && !props.completed && remaining > 1 ? (
          <section className="mt-6 flex flex-col rounded-2xl bg-shape-depth1 p-5">
            <span className="text-sm font-bold text-txt-point">Plus · 전체 열기 1번 남음</span>
            <span className="mt-1 text-lg font-semibold">이 코스 전체 열기</span>
            <span className="mt-1 text-sm text-txt-black-secondary">남은 {remaining}편을 기다리지 않고 바로 이어서 읽을 수 있어요.</span>
            <button
              type="button"
              onClick={() => setSheet(true)}
              className="mc-press mt-4 h-12 rounded-full border border-border-button bg-shape-white text-base font-semibold text-txt-point"
            >
              전체 열기
            </button>
          </section>
        ) : null}
        {props.openedAll && !props.completed ? (
          <p className="mt-6 text-sm font-semibold text-txt-point">전체 열린 코스예요 · 원하는 만큼 이어서 읽어요</p>
        ) : null}

        <ol className="mt-8 flex flex-col gap-2">
          {props.drops.map(d => {
            const isNext = d.id === props.nextId;
            if (props.openedAll && !d.done && !isNext) {
              return (
                <li key={d.id}>
                  <Link href={`/drop/${d.id}`} className="flex min-h-14 items-center gap-3 rounded-2xl bg-shape-depth1 p-4">
                    <span className="w-6 flex-shrink-0 text-center text-sm font-bold text-txt-point">{d.index + 1}</span>
                    <span className="flex-1 text-sm">{d.title}</span>
                  </Link>
                </li>
              );
            }
            if (d.done || isNext) {
              const row = (
                <>
                  <span className="flex w-6 flex-shrink-0 justify-center text-sm font-bold text-txt-point">{d.done ? <IconCheck /> : d.index + 1}</span>
                  <span className={isNext ? 'flex-1 text-sm font-bold' : 'flex-1 text-sm'}>{d.title}</span>
                  {isNext && !props.openedAll ? <span className="flex-shrink-0 text-sm font-bold text-txt-point">{props.doneToday ? '내일' : '오늘'}</span> : null}
                </>
              );
              const cls = isNext
                ? 'flex min-h-14 items-center gap-3 rounded-2xl border-2 border-border-brand bg-shape-white p-4'
                : 'flex min-h-14 items-center gap-3 rounded-2xl bg-shape-depth1 p-4';
              return (
                <li key={d.id}>
                  {d.done || props.openedAll ? (
                    <Link href={`/drop/${d.id}`} className={cls}>
                      {row}
                    </Link>
                  ) : (
                    <div className={cls}>{row}</div>
                  )}
                </li>
              );
            }
            return (
              <li key={d.id}>
                <div aria-disabled="true" className="flex min-h-14 items-center gap-3 rounded-2xl bg-shape-depth1 p-4">
                  <span className="w-6 flex-shrink-0 text-center text-sm font-bold text-txt-black-tertiary">{d.index + 1}</span>
                  <span className="flex-1 text-sm text-txt-black-tertiary">{d.title}</span>
                </div>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-sm text-txt-black-secondary">
          {props.openedAll || props.completed
            ? '읽은 Drop은 언제든 다시 볼 수 있어요.'
            : props.isTomorrow
              ? 'Drop은 하루 한 편씩 열려요. 오늘 Drop을 읽으면 이 코스의 다음 편이 내일 0시에 열려요. 읽은 Drop은 언제든 다시 볼 수 있어요.'
              : 'Drop은 하루 한 편씩 열려요. 내일 받을 코스로 고르면 다음 편이 0시에 열려요. 읽은 Drop은 언제든 다시 볼 수 있어요.'}
        </p>
      </Main>
      {!props.completed && props.nextId ? (
        <Footer>
          {props.openedAll ? (
            <PrimaryButton href={`/drop/${props.nextId}`}>이어서 읽기</PrimaryButton>
          ) : props.doneToday ? (
            tomorrow ? (
              <PrimaryButton disabled>내일 이 코스로 받아요</PrimaryButton>
            ) : (
              <PrimaryButton onClick={() => void receiveTomorrow()}>내일은 이 코스로 받기</PrimaryButton>
            )
          ) : (
            <PrimaryButton onClick={() => void receive()}>{props.isPicked ? `Drop ${done + 1} 읽기` : '오늘은 이 코스 읽기'}</PrimaryButton>
          )}
        </Footer>
      ) : null}

      <Sheet open={sheet} onClose={() => setSheet(false)} labelledBy="openAllTitle">
        <h2 id="openAllTitle" className="mt-6 text-2xl font-bold tracking-[-1px]">
          이 코스를 전체 열까요?
        </h2>
        <p className="mt-1 text-base text-txt-black-secondary">
          전체 열기는 구독 한 달에 한 코스만 쓸 수 있어요. {props.openAllNext}부터 다시 쓸 수 있어요.
        </p>
        <ul className="mt-4 flex flex-col gap-2 rounded-2xl bg-shape-depth1 px-5 py-4 text-sm text-txt-black-secondary">
          <li>열린 코스는 하루 한 편 목록에서 빠지고, 원하는 만큼 이어서 읽어요. 읽은 편은 학습 기록에 그대로 들어가요.</li>
          {props.nextTomorrowTopic ? (
            <li className="font-semibold text-txt-black-primary">
              지금 이 코스로 내일 받기로 되어 있어서, 내일은 ‘{props.nextTomorrowTopic}’ 코스로 받아요. 다 읽은 뒤 바꿀 수 있어요.
            </li>
          ) : null}
          <li>구독을 해지해도 열린 코스는 계속 읽을 수 있어요.</li>
        </ul>
        <div className="mt-6 flex flex-col gap-1 pb-2">
          <PrimaryButton onClick={() => void openAll()}>{busy ? '여는 중…' : '전체 열기'}</PrimaryButton>
          <TextButton onClick={() => setSheet(false)}>나중에</TextButton>
        </div>
      </Sheet>
    </Screen>
  );
}
