'use client';

import { useEffect, useState } from 'react';

import { josa } from '@/lib/josa';
import type { PlusUsage } from '@/lib/service';

import { Doodle } from '../Doodle';
import { PlusLeft } from '../PlusLeft';
import { ReplaceConfirm } from '../QuotaSheets';
import { SignupSheet } from '../SignupSheet';
import { TomorrowList, type TomorrowItem } from '../TomorrowList';
import { Footer, Main, OutlineButton, PrimaryButton, Screen, Sheet, AppHeader, TextButton } from '../ui';
const LABELS = ['월', '화', '수', '목', '금', '토', '일'];

export function DropDoneScreen(props: {
  /** 첫 Drop을 마친 임시 계정: 완료 화면이 보인 뒤 가입 시트를 띄운다 */
  askSignup?: boolean;
  courseId: string;
  courseTitle: string;
  dropTitle: string;
  week: boolean[];
  courses: TomorrowItem[];
  tomorrowId?: string;
  plus: boolean;
  usage: PlusUsage | null;
  currentTopic: string;
  /** 이 코스에서 지금까지 읽은 편 수 (3편 이상이면 '다른 주제로 바꾸기'를 숨긴다) */
  courseDone: number;
  /** 전체 열린 코스: 하루 한 편과 상관없이 바로 다음 편으로 */
  openedAll?: boolean;
  /** 방금 읽은 Drop 번호 (0부터) */
  dropIndex?: number;
  /** 전체 열린 코스에서 이어서 읽을 다음 Drop */
  nextDropId?: string;
}) {
  const [confirm, setConfirm] = useState(false);
  const [signup, setSignup] = useState(false);
  useEffect(() => {
    if (!props.askSignup) return;
    // 완료 화면을 먼저 보여 주고 띄운다. 주소의 ?signup=1은 지워 새로고침 때 다시 뜨지 않게
    const t = setTimeout(() => {
      setSignup(true);
      window.history.replaceState(null, '', window.location.pathname);
    }, 700);
    return () => clearTimeout(t);
  }, [props.askSignup]);
  const days = props.week.filter(Boolean).length;
  // 오늘 요일 (KST, 월=0)
  const todayIdx = (new Date(Date.now() + 9 * 3600_000).getUTCDay() + 6) % 7;
  const n = (props.dropIndex ?? 0) + 1;

  return (
    <Screen className="relative">
      <AppHeader layout="nav" close="/today" />
      <Main className="pb-6 pt-2">
        <section className="flex flex-col items-center text-center">
          <Doodle animal="rabbit" act="hop" label="기뻐하는 토끼 캐릭터" className="mc-pop aspect-square w-[min(160px,40vw)]" />
          <h1 className="mt-4 text-[28px] font-bold leading-9 tracking-[-1px]">{props.openedAll ? `Drop ${n} 완료` : '오늘의 Drop 완료!'}</h1>
          {props.openedAll ? <p className="mt-1 text-sm font-semibold text-txt-point">이어서 읽을 수 있어요</p> : null}
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
          <p className="mt-1 text-center text-sm text-txt-black-secondary">
            이번 주 {days}일째 학습했어요.{props.openedAll ? '' : ' 내일도 한 편이 기다려요.'}
          </p>
        </section>

        {props.courses.length ? (
          <section className="mt-8 flex flex-col gap-2">
            <h2 className="text-sm font-bold text-txt-black-secondary">{props.courses.length > 1 ? '내일 받을 코스' : '내일 받을 Drop'}</h2>
            <TomorrowList items={props.courses} tomorrowId={props.tomorrowId} />
            {props.plus ? (
              <>
                <OutlineButton href="/start" className="mt-3">
                  새 주제로 코스 만들기
                </OutlineButton>
                <PlusLeft usage={props.usage} />
              </>
            ) : props.courseDone < 3 ? (
              // 3편 이상 읽은 코스는 매일 바꾸기를 권하지 않는다 (코스 페이지에는 남아 있다)
              <>
                <button
                  type="button"
                  onClick={() => setConfirm(true)}
                  className="mc-press mt-2 h-12 rounded-full border border-border-button bg-shape-white text-base font-semibold text-txt-black-secondary"
                >
                  다른 주제로 바꾸기
                </button>
                <p className="text-center text-sm text-txt-black-secondary">무료는 한 번에 코스 1개를 배울 수 있어요.</p>
              </>
            ) : null}
          </section>
        ) : null}
      </Main>
      <Footer className={props.openedAll ? 'gap-1' : undefined}>
        {props.openedAll ? (
          <>
            <PrimaryButton href={props.nextDropId ? `/drop/${props.nextDropId}` : `/course/${props.courseId}`} replace>
              {props.nextDropId ? `Drop ${n + 1} 이어서 읽기` : '코스로 돌아가기'}
            </PrimaryButton>
            <TextButton href="/today" replace>
              오늘 학습 마치기
            </TextButton>
          </>
        ) : (
          <PrimaryButton href="/today" replace>
            오늘 학습 마치기
          </PrimaryButton>
        )}
      </Footer>

      <Sheet open={confirm} onClose={() => setConfirm(false)} labelledBy="replaceTitle">
        <ReplaceConfirm courseTopic={props.currentTopic} replaceHref="/start?replace=1" onClose={() => setConfirm(false)} />
      </Sheet>
      <SignupSheet open={signup} next="/today" onClose={() => setSignup(false)} />
    </Screen>
  );
}
