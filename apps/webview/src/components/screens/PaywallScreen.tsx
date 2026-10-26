'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { PLUS_PRICE_LABEL, PLUS_PRODUCT_ID } from '@/lib/constants';
import { canPurchase, isNative, nativePurchase, nativeRestore, nativeTrialEligible } from '@/lib/client/bridge';
import { postJson } from '@/lib/client/ndjson';
import type { PlusUsage } from '@/lib/service';

import { AppHeader, CHARACTER, Footer, IconCheck, Main, PrimaryButton, Screen } from '../ui';

const BENEFITS = [
  { title: '새 코스 한 달 3개', desc: '구독 시작일부터 한 달마다 3개가 다시 채워져요.' },
  { title: '한 달에 한 코스는 전체 열기', desc: '기다리지 않고 끝까지 읽어요. 해지해도 열린 코스는 계속 읽을 수 있어요.' },
  { title: '여러 코스를 함께 배우기', desc: '진행 중인 코스 중 내일 받을 하나를 골라요.' },
];

/** 들어온 곳에 맞춘 첫 줄 (done 무료 코스 완료 · keep 코스 바꾸기 안내 · 그 밖은 profile) */
const HEADS = {
  done: { sub: '첫 코스를 다 배웠어요', line1: '다음 주제도', line2: '계속 배워 볼까요?' },
  keep: { sub: '지금 코스는 그대로 두고', line1: '새 주제를', line2: '하나 더 시작해 볼까요?' },
  profile: { sub: '미니커버리 Plus', line1: '궁금한 주제를', line2: '더 많이 배워 보세요' },
} as const;
export type PaywallFrom = keyof typeof HEADS;

export function PaywallScreen({
  stageKey,
  plus,
  beta,
  accountToken,
  from,
  usage,
}: {
  stageKey: 'rabbit' | 'cat';
  plus: boolean;
  from: PaywallFrom;
  usage: PlusUsage | null;
  beta: boolean;
  /** App Store 거래에 붙이는 사용자 id (UUID) */
  accountToken: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const ch = CHARACTER[stageKey];
  const head = plus ? HEADS.profile : HEADS[from];
  // 첫 구독 무료 체험: 받을 수 있는 계정인지는 Apple이 정한다 (체험 기간도 App Store Connect 설정값)
  const [trialDays, setTrialDays] = useState(0);
  useEffect(() => {
    if (plus || beta) return;
    void nativeTrialEligible(PLUS_PRODUCT_ID).then(r => setTrialDays(r.eligible ? (r.days ?? 7) : 0));
  }, [plus, beta]);

  const verify = (jws: string | string[]) => postJson<{ plus?: boolean }>('/api/iap/verify', { jws });

  const start = async () => {
    if (busy) return;
    setMessage('');
    if (beta) {
      setBusy(true);
      const res = await postJson('/api/me/plus');
      setBusy(false);
      if (res.ok) router.replace('/start');
      return;
    }
    if (!canPurchase()) {
      setMessage(isNative() ? '앱을 최신 버전으로 업데이트하면 결제할 수 있어요.' : '결제는 미니커버리 iOS 앱에서 할 수 있어요.');
      return;
    }
    setBusy(true);
    const result = await nativePurchase(PLUS_PRODUCT_ID, accountToken);
    if (!result.jws) {
      setBusy(false);
      if (result.error === 'pending') setMessage('결제 승인을 기다리고 있어요. 승인되면 Plus가 켜져요.');
      else if (result.error !== 'canceled') setMessage('결제를 마치지 못했어요. 잠시 뒤 다시 시도해 주세요.');
      return;
    }
    const res = await verify(result.jws);
    setBusy(false);
    if (res.data.plus) router.replace('/start');
    else setMessage('결제를 확인하지 못했어요. 잠시 뒤 구매 복원을 눌러 주세요.');
  };

  const restore = async () => {
    if (busy) return;
    if (!canPurchase()) {
      setMessage(isNative() ? '앱을 최신 버전으로 업데이트하면 복원할 수 있어요.' : '구매 복원은 미니커버리 iOS 앱에서 할 수 있어요.');
      return;
    }
    setBusy(true);
    setMessage('');
    const result = await nativeRestore();
    const res = result.jws?.length ? await verify(result.jws) : null;
    setBusy(false);
    if (res?.data.plus) {
      setMessage('구독을 복원했어요.');
      router.refresh();
    } else setMessage(result.error && result.error !== 'canceled' ? '복원하지 못했어요. 잠시 뒤 다시 시도해 주세요.' : '복원할 구독이 없어요.');
  };

  return (
    <Screen>
      <AppHeader layout="nav" close="/today" />
      <Main className="pb-6 pt-2">
        <section className="flex flex-col items-center text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ch.face} alt={`${ch.name} 단계 캐릭터`} className="h-[72px] w-[72px] object-contain" />
          <p className="mt-3 text-sm font-bold text-txt-point">{plus ? '지금 Plus를 쓰고 있어요' : head.sub}</p>
          <h1 className="mt-1 text-[28px] font-bold leading-9 tracking-[-1px]">
            {head.line1}
            <br />
            {head.line2}
          </h1>
          {plus && usage ? (
            <p className="mt-2 text-sm text-txt-black-secondary">
              새 코스 {usage.coursesLeft}개 · 전체 열기 {usage.openAllLeft}번 남음 · {usage.resetLabel}에 다시 채워져요
            </p>
          ) : null}
        </section>
        <ul className="mt-8 flex flex-col gap-5">
          {BENEFITS.map(b => (
            <li key={b.title} className="flex items-start gap-3">
              <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-shape-depth1">
                <IconCheck />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-base font-semibold">{b.title}</span>
                <span className="text-sm text-txt-black-secondary">{b.desc}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-6 rounded-2xl bg-shape-depth1 px-5 py-4 text-sm text-txt-black-secondary">
          무료는 한 번에 코스 1개를 배울 수 있어요. 해지해도 만든 코스와 읽은 Drop은 그대로 남고, 새 코스 만들기와 전체 열기만 멈춰요.
        </p>
        {beta && !plus ? <p className="mt-6 text-center text-sm text-txt-black-tertiary">베타 기간에는 결제 없이 Plus를 써 볼 수 있어요.</p> : null}
        {message ? <p className="mt-4 text-center text-sm text-txt-black-secondary">{message}</p> : null}
      </Main>
      <Footer className="gap-3">
        <div className="flex items-center justify-between gap-3 rounded-2xl border-2 border-border-brand bg-shape-depth1 px-5 py-4">
          <span className="flex flex-col gap-0.5">
            <span className="text-base font-semibold">미니커버리 Plus</span>
            {trialDays ? (
              <span className="text-sm text-txt-point">처음 {trialDays}일 무료</span>
            ) : (
              <span className="text-sm text-txt-black-tertiary">매달 자동 갱신</span>
            )}
          </span>
          <span className="text-lg font-semibold">{PLUS_PRICE_LABEL}</span>
        </div>
        {plus ? (
          <PrimaryButton href="/start" replace>
            새 코스 만들기
          </PrimaryButton>
        ) : (
          <PrimaryButton onClick={() => void start()}>{busy ? '처리하는 중…' : trialDays ? `${trialDays}일 무료로 시작하기` : 'Plus 시작하기'}</PrimaryButton>
        )}
        <p className="text-center text-sm text-txt-black-tertiary">
          {trialDays && !plus
            ? `${trialDays}일 뒤 ${PLUS_PRICE_LABEL}이 결제돼요. 체험 중에 해지하면 결제되지 않아요.`
            : '언제든 해지할 수 있어요.'}
          <br />
          {plus && !beta ? (
            <a href="https://apps.apple.com/account/subscriptions" className="underline">
              구독 관리
            </a>
          ) : (
            <button type="button" className="underline" onClick={() => void restore()}>
              구매 복원
            </button>
          )}{' '}
          ·{' '}
          <Link href="/terms" className="underline">
            이용약관
          </Link>{' '}
          ·{' '}
          <Link href="/privacy" className="underline">
            개인정보
          </Link>
        </p>
      </Footer>
    </Screen>
  );
}
