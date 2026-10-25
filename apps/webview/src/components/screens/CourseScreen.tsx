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
  /** Plus이고 이번 달 전체 열기가 남았을 때 */
  canOpenAll: boolean;
  /** 전체 열기를 쓰면 다시 쓸 수 있는 날 (예: 11월 1일) */
  openAllNext: string;
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
        <div className="mt-4 flex items-center gap-3">
          <Progress value={done / Math.max(1, total)} />
          <span className="flex-shrink-0 text-sm font-semibold text-txt-black-secondary">
            {done} / {total} 완료
          </span>
        </div>

        {props.canOpenAll && !props.openedAll && !props.completed && remaining > 1 ? (
          <section className="mt-6 flex flex-col rounded-2xl bg-shape-depth1 p-5">
            <span className="text-sm font-bold text-txt-point">Plus · 이번 달 1번 남음</span>
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
        <p className="mt-3 text-sm text-txt-black-tertiary">
          {props.openedAll ? '읽은 Drop은 언제든 다시 볼 수 있어요.' : 'Drop은 하루 한 편, 받는 중인 코스로 와요. 읽은 Drop은 언제든 다시 볼 수 있어요.'}
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
            <PrimaryButton onClick={() => void receive()}>{props.isPicked ? '오늘의 Drop 읽기' : '오늘은 이 코스로 받기'}</PrimaryButton>
          )}
        </Footer>
      ) : null}

      <Sheet open={sheet} onClose={() => setSheet(false)} labelledBy="openAllTitle">
        <h2 id="openAllTitle" className="mt-6 text-2xl font-bold tracking-[-1px]">
          이 코스를 전체 열까요?
        </h2>
        <p className="mt-1 text-base text-txt-black-secondary">
          전체 열기는 한 달에 한 코스만 쓸 수 있어요. 이번 달에는 다른 코스를 전체 열 수 없고, {props.openAllNext}에 다시 쓸 수 있어요.
        </p>
        <div className="mt-6 flex flex-col gap-1 pb-2">
          <PrimaryButton onClick={() => void openAll()}>{busy ? '여는 중…' : '전체 열기'}</PrimaryButton>
          <TextButton onClick={() => setSheet(false)}>나중에</TextButton>
        </div>
      </Sheet>
    </Screen>
  );
}
