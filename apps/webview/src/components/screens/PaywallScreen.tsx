'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { PLUS_PRICE_LABEL, PLUS_PRODUCT_ID } from '@/lib/constants';
import { canPurchase, isNative, nativePurchase, nativeRestore, nativeTrialEligible } from '@/lib/client/bridge';
import { postJson } from '@/lib/client/ndjson';
import type { PlusUsage } from '@/lib/service';

import { Doodle } from '../Doodle';
import { plusLeftText } from '../PlusLeft';
import { AppHeader, CHARACTER, Footer, Main, Screen } from '../ui';

const BENEFITS = [
  {
    title: '새 코스 한 달 3개',
    desc: '구독을 시작한 날부터 한 달마다 3개가 다시 채워져요. 하루에 1개까지 만들 수 있어요. 지금 진행 중인 코스도 이번 달 3개에 들어가요.',
  },
  { title: '한 달에 한 코스는 전체 열기', desc: '기다리지 않고 끝까지 읽어요. 해지해도 열린 코스는 계속 읽을 수 있어요.' },
  { title: '여러 코스를 함께 배우기', desc: '진행 중인 코스 중 내일 받을 하나를 골라요.' },
  { title: '다른 사람이 만든 코스 모두 읽기', desc: '무료로는 코스마다 3번째 Drop 앞부분까지 볼 수 있어요. 구독하면 모든 Drop을 끝까지 읽을 수 있어요.' },
];

/** 들어온 곳에 맞춘 첫 줄 (done 무료 코스 완료 · keep 코스 바꾸기 안내 · shared 다른 사람 코스 이어 읽기 · 그 밖은 profile) */
const HEADS = {
  done: { sub: '첫 코스를 다 배웠어요', line1: '다음 주제도', line2: '계속 배워 볼까요?' },
  keep: { sub: '지금 코스는 그대로 두고', line1: '새 주제를', line2: '하나 더 시작해 볼까요?' },
  profile: { sub: '미니커버리 Plus', line1: '궁금한 주제를', line2: '더 많이 배워 보세요' },
  shared: { sub: '다른 사람이 만든 코스', line1: '다른 사람의 Drop도', line2: '끝까지 읽어 보세요' },
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
  // 첫 구독 무료 체험: 받을 수 있는 계정인지는 Apple이 정한다 (체험 기간도 App Store Connect 설정값).
  // 확인 전(unknown)과 자격 있음은 같은 문구, 자격 없음이 확인됐을 때만 체험 문구를 뺀다 (심사 3.1.2)
  const [trial, setTrial] = useState<{ state: 'unknown' | 'eligible' | 'ineligible'; days: number }>({ state: 'unknown', days: 7 });
  // StoreKit 표시 가격이 오면 그대로, 없으면 기본 가격
  const [price, setPrice] = useState<string | null>(null);
  useEffect(() => {
    if (plus || beta) return;
    void nativeTrialEligible(PLUS_PRODUCT_ID).then(r => {
      if (r.price) setPrice(r.price);
      if (!r.known) return;
      setTrial({ state: r.eligible ? 'eligible' : 'ineligible', days: r.days ?? 7 });
    });
  }, [plus, beta]);
  const priceLabel = price ? `월 ${price}` : PLUS_PRICE_LABEL;
  const trialOn = trial.state !== 'ineligible';

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
      <Main className="pb-6 pt-3">
        <section className="flex items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-2">
            <p className="text-sm text-fuse-sub">{plus ? '지금 Plus를 쓰고 있어요' : head.sub}</p>
            <h1 className="text-[28px] font-bold leading-[1.3]">
              {head.line1}
              <br />
              {head.line2}
            </h1>
            {plus && usage ? <p className="text-[13px] text-fuse-sub">{plusLeftText(usage).replace(/^Plus · /, '')}</p> : null}
          </div>
          <Doodle animal={stageKey} act={plus ? 'idle' : 'tilt'} label={`${ch.name} 단계 캐릭터`} className="h-[72px] w-[72px] flex-shrink-0" />
        </section>
        <ul className="mt-7 flex flex-col">
          {(from === 'shared' && !plus ? [BENEFITS[3]!, ...BENEFITS.slice(0, 3)] : BENEFITS).map(b => (
            <li key={b.title} className="flex items-start gap-3.5 border-b border-[#F2F2F4] py-4">
              <span className="flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-[9px] bg-fuse-ink">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path d="M5 12.5 10 17.5 19 7" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </span>
              <span className="flex flex-col gap-1">
                <span className="text-base font-semibold leading-[1.3]">{b.title}</span>
                <span className="text-[13px] text-fuse-sub">{b.desc}</span>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-5 rounded-card border border-fuse-line bg-fuse-card p-4 text-[13px] text-fuse-sub">
          무료는 한 번에 코스 1개를 배울 수 있어요. 해지해도 만든 코스와 읽은 Drop은 그대로 남고, 진행 중인 코스도 계속 받아요. 새 코스는 진행 중인 코스가 1개 이하일 때 만들 수 있어요.
        </p>
        {plus ? <p className="mt-4 text-center text-[13px] text-fuse-sub">구독 관리 · 아이폰 설정 &gt; 내 이름 &gt; 구독</p> : null}
        {beta && !plus ? <p className="mt-6 text-center text-[13px] text-fuse-faint">베타 기간에는 결제 없이 Plus를 써 볼 수 있어요.</p> : null}
        {message ? <p className="mt-4 text-center text-sm text-fuse-sub">{message}</p> : null}
      </Main>
      <Footer className="gap-3 border-t border-[#F2F2F4]">
        <div className="flex flex-col gap-4 rounded-card bg-fuse-ink px-[18px] pb-4 pt-[18px] text-txt-white-primary">
          <div className="flex items-end justify-between gap-3">
            <span className="flex flex-col gap-1">
              <span className="text-base font-semibold leading-[1.3]">미니커버리 Plus</span>
              <span className={plus ? 'text-[13px] font-semibold text-fuse-hot' : 'text-[13px] font-semibold text-fuse-faint'}>
                {plus ? '이용 중' : trialOn ? `첫 구독 ${trial.days}일 무료` : '매달 자동 갱신'}
              </span>
            </span>
            <span className="text-xl font-bold leading-[1.3]">{priceLabel}</span>
          </div>
          {/* 체험 조건·가격·해지는 자격 확인 전·후 모두 한 줄로 고정 (심사 3.1.2) */}
          {plus ? null : (
            <p className="-mt-2 text-[13px] text-fuse-faint">
              {trialOn ? `첫 구독은 ${trial.days}일 무료 · 이후 ${priceLabel} 자동 갱신 · 언제든 해지할 수 있어요` : `${priceLabel} 자동 갱신 · 언제든 해지할 수 있어요`}
            </p>
          )}
          {plus ? (
            <Link href="/start" replace className="mc-press flex h-14 items-center justify-center rounded-full bg-shape-white text-base font-semibold text-fuse-ink">
              새 코스 만들기
            </Link>
          ) : (
            <button type="button" onClick={() => void start()} className="mc-press flex h-14 items-center justify-center rounded-full bg-shape-white text-base font-semibold text-fuse-ink">
              {busy ? '처리하는 중…' : trial.state === 'eligible' ? `${trial.days}일 무료로 시작하기` : 'Plus 시작하기'}
            </button>
          )}
        </div>
        <p className="text-center text-[13px] text-fuse-sub">
          {trialOn && !plus ? `체험 중에 해지하면 결제되지 않아요.` : '언제든 해지할 수 있어요.'}
          <br />
          {plus && !beta ? (
            <a href="https://apps.apple.com/account/subscriptions" className="inline-block px-0.5 py-1 underline">
              구독 관리
            </a>
          ) : (
            <button type="button" className="px-0.5 py-1 underline" onClick={() => void restore()}>
              구매 복원
            </button>
          )}{' '}
          ·{' '}
          <Link href="/terms" className="inline-block px-0.5 py-1 underline">
            이용약관
          </Link>{' '}
          ·{' '}
          <Link href="/privacy" className="inline-block px-0.5 py-1 underline">
            개인정보
          </Link>
        </p>
      </Footer>
    </Screen>
  );
}
