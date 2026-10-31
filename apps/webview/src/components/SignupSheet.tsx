'use client';

import { SocialButtons } from './Social';
import { Sheet, TextButton } from './ui';

/** 첫 Drop을 마친 임시 계정에게 완료 화면 위에서 띄우는 가입 권유 (2026-11-01 대표 결정: 알림 시트와 연속으로 띄우지 않고 완료 화면에서) */
export function SignupSheet({ open, next, onClose }: { open: boolean; next: string; onClose: () => void }) {
  return (
    <Sheet open={open} labelledBy="signupTitle" onClose={onClose}>
      <div className="mt-6 flex flex-col gap-1 text-center">
        <p className="text-sm font-semibold text-txt-black-tertiary">첫 Drop을 읽었어요</p>
        <h2 id="signupTitle" className="text-2xl font-bold tracking-[-1px]">
          학습 기록을 저장할까요?
        </h2>
      </div>
      <p className="mt-3 text-center text-base text-txt-black-secondary">
        가입하면 진도와 내 학습 기록이 저장되고,
        <br />
        다른 기기에서도 이어서 읽을 수 있어요.
      </p>
      <div className="mt-6 flex flex-col gap-2 pb-2">
        <SocialButtons height={52} next={next} onDone={onClose} />
        <TextButton onClick={onClose}>나중에</TextButton>
        <p className="text-center text-sm text-txt-black-secondary">지금은 이 기기에만 저장돼요. 나중에 가입해도 그대로 옮겨져요.</p>
      </div>
    </Sheet>
  );
}
