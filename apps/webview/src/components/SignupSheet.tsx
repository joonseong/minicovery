'use client';

import { SocialButtons } from './Social';
import { Sheet, TextButton } from './ui';

/** 첫 Drop을 마친 임시 계정에게 완료 화면 위에서 띄우는 가입 권유 (2026-11-01 대표 결정: 알림 시트와 연속으로 띄우지 않고 완료 화면에서) */
export function SignupSheet({ open, next, onClose }: { open: boolean; next: string; onClose: () => void }) {
  return (
    <Sheet open={open} labelledBy="signupTitle" onClose={onClose}>
      <div className="mt-6 flex flex-col gap-1.5">
        <p className="inline-flex items-center gap-[3px] text-[13px] font-medium leading-[1.3] text-fuse-hot">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M5 12.5 10 17.5 19 7" stroke="#FF4D6D" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          첫 Drop을 읽었어요
        </p>
        <h2 id="signupTitle" className="text-2xl font-bold leading-[1.3]">
          학습 기록을 저장할까요?
        </h2>
      </div>
      <p className="mt-1 text-sm text-fuse-sub">
        가입하면 진도와 내 학습 기록이 저장되고,
        <br />
        다른 기기에서도 이어서 읽을 수 있어요.
      </p>
      <div className="mt-6 flex flex-col gap-2">
        <SocialButtons next={next} onDone={onClose} />
        <TextButton onClick={onClose}>나중에</TextButton>
        <p className="text-center text-[13px] text-fuse-faint">지금은 이 기기에만 저장돼요. 나중에 가입해도 그대로 옮겨져요.</p>
      </div>
    </Sheet>
  );
}
