'use client';

import { useState } from 'react';

import Link from 'next/link';

import { josa } from '@/lib/josa';

import { ReplaceConfirm } from '../QuotaSheets';
import { TomorrowList, type TomorrowItem } from '../TomorrowList';
import { CHARACTER, Footer, Main, PrimaryButton, Screen, Sheet, AppHeader } from '../ui';
const LABELS = ['월', '화', '수', '목', '금', '토', '일'];

export function DropDoneScreen(props: {
  courseTitle: string;
  dropTitle: string;
  week: boolean[];
  courses: TomorrowItem[];
  tomorrowId?: string;
  plus: boolean;
  currentTopic: string;
}) {
  const [confirm, setConfirm] = useState(false);
  const days = props.week.filter(Boolean).length;
  // 오늘 요일 (KST, 월=0)
  const todayIdx = (new Date(Date.now() + 9 * 3600_000).getUTCDay() + 6) % 7;

  return (
    <Screen className="relative">
      <AppHeader layout="nav" close="/today" />
      <Main className="pb-6 pt-2">
        <section className="flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={CHARACTER.rabbit.full} alt="기뻐하는 토끼 캐릭터" className="mc-pop aspect-square w-[min(160px,40vw)] object-contain" />
          <h1 className="mt-4 text-[28px] font-bold leading-9 tracking-[-1px]">오늘의 Drop 완료!</h1>
          <p className="mt-2 text-base text-txt-black-secondary">
            <b>{props.courseTitle}</b>
            {josa(props.courseTitle, '을/를').slice(props.courseTitle.length)} 통해
            <br />‘{props.dropTitle}’{josa(props.dropTitle.replace(/[?？!.]$/, ''), '을/를').slice(-1)} 알게 됐어요.
          </p>
        </section>

        <section className="mt-8 flex flex-col items-center gap-3">
          <div className="relative grid w-full grid-cols-7">
            <span aria-hidden="true" className="absolute left-[7%] right-[7%] top-3 h-1 rounded-full bg-shape-depth2" />
            {LABELS.map((l, i) => (
              <div key={l} className="relative flex flex-col items-center gap-1.5">
                {props.week[i] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src="/img/check.png" alt="학습함" className="-m-px h-[30px] w-[30px] object-contain" />
                ) : (
                  <span className="h-7 w-7 rounded-full border-2 border-shape-depth2 bg-shape-white" />
                )}
                <span className={i === todayIdx ? 'text-sm font-bold text-txt-point' : 'text-sm text-txt-black-tertiary'}>{l}</span>
              </div>
            ))}
          </div>
          <p className="mt-1 text-center text-sm text-txt-black-secondary">이번 주 {days}일째 학습했어요. 내일도 한 편이 기다려요.</p>
        </section>

        {props.courses.length ? (
          <section className="mt-8 flex flex-col gap-2">
            <h2 className="text-sm font-bold text-txt-black-secondary">내일의 Drop</h2>
            <TomorrowList items={props.courses} tomorrowId={props.tomorrowId} />
            {props.courses.length > 1 ? <p className="text-sm text-txt-black-tertiary">코스를 누르면 내일 그 코스의 Drop을 받아요. 받는 코스는 하나예요.</p> : null}
            {props.plus ? (
              <Link href="/start" className="flex min-h-11 items-center self-center px-3 text-sm text-txt-black-tertiary underline">
                새 주제로 코스 만들기
              </Link>
            ) : (
              <button type="button" onClick={() => setConfirm(true)} className="flex min-h-11 items-center self-center px-3 text-sm text-txt-black-tertiary underline">
                새 주제로 바꾸기
              </button>
            )}
          </section>
        ) : null}
      </Main>
      <Footer>
        <PrimaryButton href="/today" replace>
          오늘 학습 마치기
        </PrimaryButton>
      </Footer>

      <Sheet open={confirm} onClose={() => setConfirm(false)} labelledBy="replaceTitle">
        <ReplaceConfirm courseTopic={props.currentTopic} replaceHref="/start?replace=1" onClose={() => setConfirm(false)} />
      </Sheet>
    </Screen>
  );
}
