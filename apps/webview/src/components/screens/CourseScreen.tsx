'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { postJson } from '@/lib/client/ndjson';

import { CatIcon } from '../CatIcon';
import { AppHeader, Footer, Main, PrimaryButton, Progress, Screen, Sheet, TextButton, cx } from '../ui';

type D = { id: string; index: number; title: string; done: boolean; skipped?: boolean };

/** 목차 한 줄 (캔버스 코스 상세): 위 줄과 가는 선으로 나눈다 */
const ROW = 'flex min-h-[60px] items-center gap-3 py-2';
const ROW_LINE = (i: number) => (i ? 'border-t border-[#F2F2F4]' : '');
const NUM = 'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-[13px] font-semibold';

export function CourseScreen(props: {
  courseId: string;
  title: string;
  meta: string;
  category: string;
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
  /** Plus인데 이번 달 전체 열기를 이미 썼을 때: 다시 쓸 수 있는 날 */
  openAllUsedUntil?: string;
  /** 이 코스를 열면 내일 대신 받게 될 코스 (이 코스가 내일 받을 코스일 때만) */
  nextTomorrowTopic?: string;
  /** 하루 한 편으로 받는 코스가 2개 이상 (받아요/쉬는 중 배지) */
  multiple: boolean;
  /** 다 배운 코스: 다른 사람에게 추천 중인지 */
  shared?: boolean;
  /** 추천 코스를 받아 읽은 코스면 다시 추천에 내놓지 않는다 */
  copied?: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [tomorrow, setTomorrow] = useState(props.isTomorrow);
  const [shared, setShared] = useState(Boolean(props.shared));
  const done = props.drops.filter(d => d.done).length;
  // 다음에 읽을 Drop 번호: 건너뛴 Drop이 있으면 done+1과 다르다
  const nextNo = (props.drops.find(d => !d.done && !d.skipped)?.index ?? done) + 1;
  const skipped = props.drops.filter(d => d.skipped && !d.done).length;
  const total = props.drops.length;
  const remaining = total - done - skipped;

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

  const toggleShare = async (on: boolean) => {
    setShared(on);
    const res = await postJson(`/api/courses/${props.courseId}/share`, { on });
    if (!res.ok) setShared(!on);
  };

  return (
    <Screen className="relative">
      <AppHeader layout="nav" back />
      <Main className="pb-6 pt-4">
        <section className="flex flex-col gap-2">
          <div className="flex items-center gap-2.5">
            <CatIcon category={props.category} />
            <span className="flex-1 text-sm text-fuse-sub">{props.meta}</span>
            {props.multiple && !props.completed && !props.openedAll ? (
              <span className={cx('flex-shrink-0 text-[13px] font-medium', tomorrow ? 'text-fuse-hot' : 'text-fuse-faint')}>{tomorrow ? '내일 받아요' : '쉬는 중'}</span>
            ) : null}
          </div>
          <h1 className="mt-1 text-[28px] font-bold leading-[1.3]">{props.title}</h1>
        </section>
        <section aria-label="진도" className="mt-5 flex flex-col gap-3">
          <p className="text-[52px] font-bold leading-none">
            {done}
            <span>
              {' '}
              / {total}
              <span className="relative -top-[0.14em] ml-2 text-[22px] leading-[1.3]">편 읽음</span>
            </span>
          </p>
          <Progress value={done / Math.max(1, total)} />
          {skipped ? <span className="text-[13px] text-fuse-sub">건너뜀 {skipped}</span> : null}
        </section>

        {props.canOpenAll && !props.openedAll && !props.completed && remaining > 1 ? (
          <section className="mt-5 flex items-center gap-3.5 rounded-card border border-fuse-line bg-fuse-card p-4">
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="text-[13px] font-medium leading-[1.3] text-fuse-hot">Plus · 전체 열기 1번 남음</span>
              <span className="text-base font-semibold leading-[1.3]">이 코스 전체 열기</span>
              <span className="text-[13px] text-fuse-sub">남은 {remaining}편을 기다리지 않고 바로 이어서 읽을 수 있어요.</span>
            </span>
            <button type="button" onClick={() => setSheet(true)} className="mc-press h-10 flex-shrink-0 rounded-full bg-fuse-ink px-4 text-sm font-semibold text-txt-white-primary">
              전체 열기
            </button>
          </section>
        ) : props.openAllUsedUntil && !props.openedAll && !props.completed && remaining > 1 ? (
          // 이번 달 전체 열기를 이미 썼어도 기능이 사라진 것처럼 보이지 않게 비활성 줄로 남긴다
          <p aria-disabled="true" className="mt-5 rounded-card border border-fuse-line bg-fuse-card p-4 text-sm font-medium text-fuse-faint">
            Plus · 전체 열기는 {props.openAllUsedUntil}부터 다시 쓸 수 있어요
          </p>
        ) : null}
        {props.openedAll && !props.completed ? (
          <p className="mt-5 text-sm font-medium leading-[1.3] text-fuse-hot">전체 열린 코스예요 · 원하는 만큼 이어서 읽어요</p>
        ) : null}

        {props.completed && !props.copied ? (
          <label className="mt-5 flex cursor-pointer items-center justify-between gap-3 rounded-card border border-fuse-line bg-fuse-card p-4">
            <span className="flex flex-col gap-0.5">
              <span className="text-base font-semibold leading-[1.3]">{shared ? '다른 사람에게 추천 중' : '다른 사람에게 추천하기'}</span>
              <span className="text-[13px] text-fuse-sub">내 이름 없이 코스 목차와 Drop만 보여 줘요. 언제든 끌 수 있어요.</span>
            </span>
            <span className="flex flex-shrink-0 items-center gap-2 text-sm font-semibold">
              {shared ? '끄기' : '켜기'}
              <input type="checkbox" checked={shared} onChange={e => void toggleShare(e.target.checked)} className="h-5 w-5 accent-[#0B0B0C]" />
            </span>
          </label>
        ) : null}

        <ol className="mt-6 flex flex-col">
          {props.drops.map(d => {
            const isNext = d.id === props.nextId;
            if (d.skipped && !d.done) {
              return (
                <li key={d.id} className={ROW_LINE(d.index)}>
                  <div className={ROW}>
                    <span className={cx(NUM, 'border-[1.5px] border-dashed border-fuse-edge text-fuse-faint')}>{d.index + 1}</span>
                    <span className="flex-1 text-sm text-fuse-faint line-through">{d.title}</span>
                    <span className="flex-shrink-0 text-[13px] text-fuse-faint">건너뜀</span>
                  </div>
                </li>
              );
            }
            if (props.openedAll && !d.done && !isNext) {
              return (
                <li key={d.id} className={ROW_LINE(d.index)}>
                  <Link href={`/drop/${d.id}`} className={ROW}>
                    <span className={cx(NUM, 'border border-fuse-edge bg-shape-white')}>{d.index + 1}</span>
                    <span className="flex-1 text-sm">{d.title}</span>
                  </Link>
                </li>
              );
            }
            if (d.done || isNext) {
              const row = (
                <>
                  <span className={cx(NUM, d.done ? 'bg-fuse-ink' : 'border border-fuse-ink bg-shape-white')}>
                    {d.done ? (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" role="img" aria-label="다 읽음">
                        <path d="M5 12.5 10 17.5 19 7" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      d.index + 1
                    )}
                  </span>
                  <span className={isNext ? 'flex-1 text-sm font-bold' : 'flex-1 text-sm'}>{d.title}</span>
                  {isNext && !props.openedAll ? <span className="flex-shrink-0 text-[13px] font-medium text-fuse-hot">{props.doneToday ? '내일' : '오늘'}</span> : null}
                </>
              );
              const cls = ROW;
              return (
                <li key={d.id} className={ROW_LINE(d.index)}>
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
              <li key={d.id} className={ROW_LINE(d.index)}>
                <div aria-disabled="true" className={ROW}>
                  <span className={cx(NUM, 'border-[1.5px] border-dashed border-fuse-edge text-fuse-faint')}>{d.index + 1}</span>
                  <span className="flex-1 text-sm text-fuse-faint">{d.title}</span>
                </div>
              </li>
            );
          })}
        </ol>
        <p className="mt-3 text-[13px] text-fuse-sub">
          {props.openedAll || props.completed
            ? '읽은 Drop은 언제든 다시 볼 수 있어요.'
            : props.isTomorrow
              ? 'Drop은 하루 한 편씩 열려요. 오늘 Drop을 읽으면 이 코스의 다음 편이 내일 0시에 열려요. 읽은 Drop은 언제든 다시 볼 수 있어요.'
              : 'Drop은 하루 한 편씩 열려요. 내일 받을 코스로 고르면 다음 편이 0시에 열려요. 읽은 Drop은 언제든 다시 볼 수 있어요.'}
          {skipped ? ' 건너뛴 Drop은 만들 수 없는 내용이라 진도에서 빠져요.' : ''}
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
            <PrimaryButton onClick={() => void receive()}>{props.isPicked ? `Drop ${nextNo} 읽기` : '오늘은 이 코스 읽기'}</PrimaryButton>
          )}
        </Footer>
      ) : null}

      <Sheet open={sheet} onClose={() => setSheet(false)} labelledBy="openAllTitle">
        <h2 id="openAllTitle" className="mt-6 text-2xl font-bold leading-[1.3]">
          이 코스를 전체 열까요?
        </h2>
        <p className="mt-1 text-sm text-fuse-sub">
          전체 열기는 구독 한 달에 한 코스만 쓸 수 있어요. {props.openAllNext}부터 다시 쓸 수 있어요.
        </p>
        <ul className="mt-4 flex flex-col gap-2 rounded-card border border-fuse-line bg-fuse-card p-4 text-[13px] text-fuse-sub">
          <li>열린 코스는 하루 한 편 목록에서 빠지고, 원하는 만큼 이어서 읽어요. 읽은 편은 학습 기록에 그대로 들어가요.</li>
          {props.nextTomorrowTopic ? (
            <li className="font-semibold text-fuse-ink">
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
