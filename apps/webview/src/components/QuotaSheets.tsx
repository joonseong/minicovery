'use client';

import Link from 'next/link';

import { PLUS_PRICE_LABEL } from '@/lib/constants';

import { PrimaryButton, Sheet, TextButton } from './ui';

/** 무료 사용자가 새 주제로 바꿀 때: 진행 중인 코스는 지움(단계·다 배운 주제·주간 기록은 남음) + Plus 안내 */
export function ReplaceConfirm({ courseTopic, replaceHref, onClose }: { courseTopic?: string; replaceHref: string; onClose?: () => void }) {
  return (
    <>
      <h2 id="replaceTitle" className="mt-6 text-2xl font-bold tracking-[-1px]">
        지금 코스를 지우고 바꿀까요?
      </h2>
      <p className="mt-1 text-base text-txt-black-secondary">
        무료는 한 번에 코스 1개를 배울 수 있고, 바꾸기는 하루 1번이에요. 바꾸면 {courseTopic ? `‘${courseTopic}’ ` : '지금 '}코스와 읽은 Drop 본문이 지워져요. 단계, 다 배운
        주제, 이번 주 학습 기록은 그대로 남아요.
      </p>
      <div className="mt-5 flex flex-col gap-1 rounded-2xl bg-shape-depth1 px-5 py-4">
        <span className="text-sm font-bold text-txt-point">Plus · {PLUS_PRICE_LABEL}</span>
        <span className="text-lg font-semibold">구독하고 여러 코스를 경험해 보세요</span>
        <span className="text-sm text-txt-black-secondary">지금 코스는 그대로 두고, 새 코스를 한 달에 3개까지 만들 수 있어요.</span>
      </div>
      <PrimaryButton href="/plus?from=keep" className="mt-6">
        Plus로 여러 코스 함께 배우기
      </PrimaryButton>
      <Link href={replaceHref} onClick={onClose} className="mt-1 flex h-12 w-full items-center justify-center text-base font-semibold text-txt-error">
        지우고 새 주제로 바꾸기
      </Link>
      {onClose ? <TextButton onClick={onClose}>지금 코스 계속할게요</TextButton> : null}
    </>
  );
}

export function ReplaceSheet(props: { open: boolean; onClose: () => void; courseTopic?: string; replaceHref: string }) {
  return (
    <Sheet open={props.open} onClose={props.onClose} labelledBy="replaceTitle">
      <ReplaceConfirm courseTopic={props.courseTopic} replaceHref={props.replaceHref} onClose={props.onClose} />
    </Sheet>
  );
}

/** 하루 1번 · 진행 중 코스 초과(Plus 해지 뒤) 안내 */
export function LimitSheet({ kind, onClose, plus }: { kind: 'daily' | 'over' | null; onClose: () => void; plus?: boolean }) {
  return (
    <Sheet open={kind !== null} onClose={onClose} labelledBy="limitTitle">
      <h2 id="limitTitle" className="mt-6 text-2xl font-bold tracking-[-1px]">
        {kind === 'over' ? '진행 중인 코스가 여러 개예요' : plus ? '오늘은 새 코스를 만들었어요' : '오늘은 이미 주제를 바꿨어요'}
      </h2>
      <p className="mt-1 text-base text-txt-black-secondary">
        {kind === 'over'
          ? '진행 중인 코스는 그대로 이어서 받을 수 있어요. 무료는 진행 중인 코스가 1개 이하일 때 새 코스를 만들 수 있어요.'
          : plus
            ? '새 코스는 하루에 1개까지 만들 수 있어요. 내일 다시 만들 수 있어요.'
            : '주제 바꾸기는 하루에 1번까지 할 수 있어요. 내일 다시 바꿀 수 있어요.'}
      </p>
      {kind === 'over' && !plus ? (
        <div className="mt-6 flex flex-col gap-1 pb-2">
          <PrimaryButton href="/plus?from=keep">Plus로 여러 코스 함께 배우기</PrimaryButton>
          <Link href="/today" onClick={onClose} className="flex h-12 w-full items-center justify-center text-base font-semibold text-txt-black-secondary">
            진행 중인 코스 이어서 읽기
          </Link>
        </div>
      ) : (
        <div className="mt-6 flex flex-col gap-1 pb-2">
          <PrimaryButton onClick={onClose}>확인</PrimaryButton>
          {kind === 'daily' && !plus ? (
            <Link href="/plus?from=keep" onClick={onClose} className="flex min-h-11 items-center justify-center px-3 text-center text-sm font-semibold text-txt-point">
              Plus면 지금 코스를 두고 새 코스를 만들 수 있어요
            </Link>
          ) : null}
        </div>
      )}
    </Sheet>
  );
}

export function MonthlySheet({ open, onClose, resetLabel }: { open: boolean; onClose: () => void; resetLabel?: string }) {
  return (
    <Sheet open={open} onClose={onClose} labelledBy="monthlyTitle">
      <h2 id="monthlyTitle" className="mt-6 text-2xl font-bold tracking-[-1px]">
        새 코스를 다 만들었어요
      </h2>
      <p className="mt-1 text-base text-txt-black-secondary">Plus는 구독 시작일부터 한 달마다 새 코스를 3개까지 만들 수 있어요. {resetLabel ? `${resetLabel}에 다시 3개가 채워져요.` : ''}</p>
      <PrimaryButton className="mt-6" onClick={onClose}>
        확인
      </PrimaryButton>
    </Sheet>
  );
}
