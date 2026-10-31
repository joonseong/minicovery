'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { nativeRequestReview, openAppSettings, requestPushPermission } from '@/lib/client/bridge';
import { postJson } from '@/lib/client/ndjson';

import { PrimaryButton, Sheet, TextButton, Toast, useToast } from './ui';

export interface CompleteResult {
  firstEver: boolean;
  courseCompleted: boolean;
  courseId: string;
  levelUp: boolean;
  askNotify: boolean;
  /** 전에 거절했으면 iOS가 다시 묻지 않아서, 허용이 안 되면 설정 앱으로 보낸다 */
  notifyDenied?: boolean;
  askSignup: boolean;
  askReview?: boolean;
}

/** 완료 뒤 어디로 갈지: 단계 상승 → 코스 완료 → 오늘의 Drop 완료 */
export function afterCompleteHref(r: CompleteResult, dropId: string) {
  const done = r.courseCompleted ? `/course/${r.courseId}/done` : `/drop/${dropId}/done`;
  return r.levelUp ? `/levelup?next=${encodeURIComponent(done)}` : done;
}

/**
 * Drop을 다 읽은 뒤: 알림 권한 안내 또는 가입 안내(첫 Drop, 임시 계정) 중 하나만 → 완료 화면.
 * 한 번의 완료에 시트를 두 개 연속으로 띄우지 않는다. 알림을 물었으면 가입 권유는 다음 완료로 미룬다.
 * 다른 팝업이 없는 날 몇 편째(3·10·30편)에는 완료 화면 위로 App Store 리뷰를 요청한다.
 */
export function AfterComplete({ result, dropId }: { result: CompleteResult | null; dropId: string }) {
  const router = useRouter();
  const [step, setStep] = useState<'notify' | 'go' | null>(null);
  const [busy, setBusy] = useState(false);
  const [toast, showToast] = useToast(2500);
  // 가입 권유는 완료 화면 위에서 띄운다 (?signup=1). 코스 완주·레벨업 화면으로 갈 때는 생략
  const next = result
    ? afterCompleteHref(result, dropId) + (result.askSignup && !result.courseCompleted && !result.levelUp ? '?signup=1' : '')
    : '/today';

  useEffect(() => {
    if (!result) return;
    setStep(result.askNotify ? 'notify' : 'go');
  }, [result]);

  useEffect(() => {
    if (step !== 'go') return;
    if (result?.askReview) nativeRequestReview();
    router.replace(next);
  }, [step, next, router, result]);

  // 알림 시트 다음은 완료 화면. 가입 시트는 거기서 뜬다 (2026-11-01 대표 결정)
  const afterNotify = () => {
    setBusy(false);
    setStep('go');
  };
  // 토스트를 읽을 시간을 주고 넘어간다
  const goSoon = (ms: number) => setTimeout(afterNotify, ms);

  const allow = async () => {
    if (busy) return;
    setBusy(true);
    const r = await requestPushPermission();
    if (r.granted) {
      await postJson('/api/me/notify', { permission: 'granted', pushToken: r.token });
      showToast('알림을 켰어요. 시간은 설정에서 바꿀 수 있어요');
      goSoon(1200);
      return;
    }
    if (r.unavailable) {
      // 결과를 못 받은 건 거부가 아니다 (C3): 다음에 다시 묻도록 '나중에'로 둔다
      await postJson('/api/me/notify', { later: true });
      showToast('지금은 알림을 켤 수 없어요. 설정에서 다시 시도해 주세요');
      goSoon(1800);
      return;
    }
    await postJson('/api/me/notify', { permission: 'denied' });
    if (result?.notifyDenied) openAppSettings();
    else showToast('휴대폰 설정에서 미니커버리 알림을 켤 수 있어요');
    goSoon(1200);
  };

  const later = async (never: boolean) => {
    if (busy) return;
    setBusy(true);
    await postJson('/api/me/notify', never ? { never: true } : { later: true });
    afterNotify();
  };

  return (
    <>
      <Sheet open={step === 'notify'} labelledBy="notifyTitle">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/img/bell.png" alt="" className="mt-6 h-16 w-16 object-contain" />
        <h2 id="notifyTitle" className="mt-4 text-2xl font-bold tracking-[-1px]">
          내일 다음 Drop이 도착하면
          <br />
          알려드릴까요?
        </h2>
        <p className="mt-2 text-base text-txt-black-secondary">
          새 Drop은 매일 0시에 열려요. 알림은 하루 한 번, 오늘 읽은 시간쯤 아직 안 읽었을 때만 보내요.
        </p>
        <p className="mt-1 text-sm text-txt-black-secondary">밤 9시~아침 8시에 읽었다면 아침 8시로 맞춰요.</p>
        <div className="mt-8 flex flex-col gap-1 pb-2">
          <PrimaryButton onClick={() => void allow()}>{busy ? '확인하는 중…' : '알림 받기'}</PrimaryButton>
          <TextButton onClick={() => void later(false)}>나중에</TextButton>
          <TextButton onClick={() => void later(true)}>다시 묻지 않기</TextButton>
        </div>
      </Sheet>

      <Toast message={toast} />
    </>
  );
}
