'use client';

import Link from 'next/link';

import { PLUS_PRICE_LABEL } from '@/lib/constants';

import { PrimaryButton, Sheet } from './ui';

/** 무료 사용자가 새 주제로 바꿀 때: 진행 중인 코스는 지움(단계·다 배운 주제·주간 기록은 남음) + Plus 안내 */
export function ReplaceConfirm({ courseTopic, replaceHref, onClose }: { courseTopic?: string; replaceHref: string; onClose?: () => void }) {
  return (
    <>
      <h2 id="replaceTitle" className="mt-6 text-2xl font-bold tracking-[-1px]">
        지금 코스를 지우고 바꿀까요?
      </h2>
      <p className="mt-1 text-base text-txt-black-secondary">
        무료는 한 번에 코스 1개를 배울 수 있어요. 바꾸면 {courseTopic ? `‘${courseTopic}’ ` : '지금 '}코스와 읽은 Drop 본문이 지워져요. 단계, 다 배운
        주제, 이번 주 학습 기록은 그대로 남아요.
      </p>
      <div className="mt-5 flex flex-col gap-1 rounded-2xl bg-shape-depth1 px-5 py-4">
        <span className="text-sm font-bold text-txt-point">Plus · {PLUS_PRICE_LABEL}</span>
        <span className="text-lg font-semibold">구독하고 여러 코스를 경험해 보세요</span>
        <span className="text-sm text-txt-black-secondary">지금 코스는 그대로 두고, 새 코스를 한 달에 3개까지 만들 수 있어요.</span>
      </div>
      <PrimaryButton href="/plus?from=keep" className="mt-6">
        Plus로 여러 코스 두기
      </PrimaryButton>
      <Link href={replaceHref} onClick={onClose} className="mt-1 flex h-12 w-full items-center justify-center text-base font-semibold text-txt-error">
        지우고 새 주제로 바꾸기
      </Link>
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
