'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { openAppSettings, requestPushPermission } from '@/lib/client/bridge';
import { postJson } from '@/lib/client/ndjson';
import { SUPPORT_EMAIL } from '@/lib/constants';
import type { PlusUsage } from '@/lib/service';

import { AppHeader, IconArrow, Main, PrimaryButton, Screen, Sheet, TextButton, Toast, useToast } from '../ui';

// 21시~08시는 고를 수 없다
const TIMES: string[] = [];
for (let m = 8 * 60; m <= 20 * 60 + 30; m += 30) TIMES.push(`${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`);

const ROW = 'flex min-h-16 items-center justify-between gap-4';

function Switch({ on, onChange, label }: { on: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={() => onChange(!on)}
      className="relative h-[31px] w-[51px] flex-shrink-0 rounded-full transition-colors"
      style={{ background: on ? '#20967A' : '#DEDFEB' }}
    >
      <span className="absolute top-0.5 h-[27px] w-[27px] rounded-full bg-shape-white shadow transition-all" style={{ left: on ? 22 : 2 }} />
    </button>
  );
}

export function SettingsScreen(props: {
  notifyOn: boolean;
  notifyTime: string;
  account: string | null;
  plus: boolean;
  /** 다음 결제일 'M월 D일' (Plus일 때) */
  renewLabel?: string;
  /** 자동 갱신을 껐으면 '갱신' 대신 '까지 이용' */
  autoRenew?: boolean;
  /** Plus 남은 횟수 */
  usage?: PlusUsage | null;
  version: string;
}) {
  const router = useRouter();
  const [on, setOn] = useState(props.notifyOn);
  const [time, setTime] = useState(props.notifyTime);
  const [notice, setNotice] = useState('');
  const [toast, showToast] = useToast();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);

  const toggle = async (v: boolean) => {
    setNotice('');
    if (!v) {
      setOn(false);
      await postJson('/api/me/notify', { permission: 'denied' });
      return;
    }
    const r = await requestPushPermission();
    if (r.granted) {
      setOn(true);
      await postJson('/api/me/notify', { permission: 'granted', pushToken: r.token });
      return;
    }
    setOn(false);
    if (r.unavailable) {
      // 결과를 못 받은 건 거부가 아니다 (C3): 서버에는 '나중에'로만 남긴다
      await postJson('/api/me/notify', { later: true });
      showToast('지금은 알림을 켤 수 없어요. 설정에서 다시 시도해 주세요');
      return;
    }
    await postJson('/api/me/notify', { permission: 'denied' });
    setNotice('휴대폰 설정에서 미니커버리 알림을 켜 주세요.');
  };

  const plusSub = !props.plus
    ? '무료 · 한 번에 코스 1개'
    : [
        '이용 중',
        props.usage ? `새 코스 ${props.usage.coursesLeft}개 · 전체 열기 ${props.usage.openAllLeft}번 남음 · ${props.usage.resetLabel}에 다시 채워져요` : '',
        props.renewLabel ? (props.autoRenew === false ? `${props.renewLabel}까지 이용` : `${props.renewLabel} 갱신`) : '',
      ]
        .filter(Boolean)
        .join(' · ');

  return (
    <Screen className="relative">
      <AppHeader layout="nav" title="설정" back />
      <Main className="gap-8 pb-8 pt-4">
        <section className="flex flex-col">
          <h2 className="mb-1 text-sm font-bold text-txt-black-secondary">알림</h2>
          <div className={ROW}>
            <div className="flex flex-col gap-0.5">
              <span className="text-base font-semibold">다음 Drop 알림</span>
              <span className="text-sm text-txt-black-tertiary">{on ? `매일 ${time}쯤 알려드려요` : '알림이 꺼져 있어요'}</span>
            </div>
            <Switch on={on} onChange={v => void toggle(v)} label="다음 Drop 알림" />
          </div>
          {notice ? (
            <p className="text-sm text-txt-black-secondary">
              {notice}{' '}
              <button type="button" className="font-semibold text-txt-point underline" onClick={openAppSettings}>
                설정 열기
              </button>
            </p>
          ) : null}
          {on ? (
            <>
              <label htmlFor="notify-time" className={`${ROW} border-t border-border-div`}>
                <span className="text-base font-semibold">알림 시간</span>
                <span className="relative inline-flex flex-shrink-0 items-center">
                  <select
                    id="notify-time"
                    value={time}
                    onChange={e => {
                      setTime(e.target.value);
                      void postJson('/api/me/notify', { notifyTime: e.target.value });
                    }}
                    className="h-11 appearance-none rounded-xl border border-border-button bg-shape-white py-0 pl-4 pr-10 text-base font-semibold text-txt-black-primary"
                  >
                    {TIMES.map(t => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="pointer-events-none absolute right-4">
                    <path d="m6 9 6 6 6-6" stroke="#858691" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
              </label>
              <p className="mt-1 text-sm text-txt-black-secondary">
                새 Drop은 매일 0시에 열려요. 알림은 정한 시간에 하루 한 번, 아직 안 읽은 날만 보내요. 밤 9시부터 아침 8시까지는 보내지 않아요.
              </p>
            </>
          ) : null}
        </section>

        <section className="flex flex-col">
          <h2 className="mb-1 text-sm font-bold text-txt-black-secondary">구독</h2>
          <Link href="/plus" className={ROW}>
            <span className="flex min-w-0 flex-col gap-0.5">
              <span className="text-base font-semibold">미니커버리 Plus</span>
              <span className="text-sm text-txt-black-secondary">{plusSub}</span>
            </span>
            <IconArrow />
          </Link>
          {props.plus ? (
            <p className="mt-1 text-sm text-txt-black-secondary">
              해지는 아이폰 설정 &gt; 내 이름 &gt; 구독에서 할 수 있어요. 해지해도 만든 코스와 읽은 Drop은 그대로 남고, 진행 중인 코스도 계속 받아요.
            </p>
          ) : null}
        </section>

        <section className="flex flex-col">
          <h2 className="mb-1 text-sm font-bold text-txt-black-secondary">계정</h2>
          <div className={ROW}>
            <span className="text-base font-semibold">로그인 계정</span>
            <span className="truncate text-sm text-txt-black-secondary">{props.account ?? '가입 전 (이 기기에만 저장)'}</span>
          </div>
          {props.account ? (
            <button
              type="button"
              className={`${ROW} border-t border-border-div text-left text-base font-semibold`}
              onClick={() => setConfirmLogout(true)}
            >
              로그아웃
            </button>
          ) : (
            <Link href="/signup?next=/settings" className={`${ROW} border-t border-border-div text-base font-semibold`}>
              가입하고 기록 저장하기
              <IconArrow />
            </Link>
          )}
          <button type="button" className={`${ROW} border-t border-border-div text-left text-base font-semibold text-txt-error`} onClick={() => setConfirmDelete(true)}>
            {props.account ? '계정 삭제' : '학습 기록 지우기'}
          </button>
        </section>

        <section className="flex flex-col">
          <h2 className="mb-1 text-sm font-bold text-txt-black-secondary">정보</h2>
          <Link href="/terms" className={`${ROW} text-base font-semibold`}>
            이용약관
            <IconArrow />
          </Link>
          <Link href="/privacy" className={`${ROW} border-t border-border-div text-base font-semibold`}>
            개인정보 처리방침
            <IconArrow />
          </Link>
          <a href={`mailto:${SUPPORT_EMAIL}`} className={`${ROW} border-t border-border-div text-base font-semibold`}>
            <span className="flex min-w-0 flex-col gap-0.5">
              문의하기
              <span className="truncate text-sm font-normal text-txt-black-tertiary">{SUPPORT_EMAIL}</span>
            </span>
            <IconArrow />
          </a>
          <Link href="/support" className={`${ROW} border-t border-border-div text-base font-semibold`}>
            자주 묻는 질문
            <IconArrow />
          </Link>
          <div className={`${ROW} border-t border-border-div`}>
            <span className="text-base font-semibold">버전</span>
            <span className="text-sm text-txt-black-tertiary">{props.version}</span>
          </div>
        </section>
      </Main>

      <Sheet open={confirmDelete} onClose={() => setConfirmDelete(false)} labelledBy="deleteTitle">
        <h2 id="deleteTitle" className="mt-6 text-2xl font-bold tracking-[-1px]">
          {props.account ? '계정을 삭제할까요?' : '학습 기록을 지울까요?'}
        </h2>
        <p className="mt-2 text-base text-txt-black-secondary">
          코스, 읽은 Drop, 내 학습 기록이 모두 지워지고 되돌릴 수 없어요.
          {props.plus ? ' Plus 구독은 자동으로 해지되지 않으니 아이폰 설정 > 구독에서 따로 해지해 주세요.' : ''}
        </p>
        <PrimaryButton
          className="mt-6 !bg-[#B82637]"
          onClick={async () => {
            await postJson('/api/me/delete');
            router.replace('/start?deleted=1');
            router.refresh();
          }}
        >
          삭제하기
        </PrimaryButton>
        <TextButton onClick={() => setConfirmDelete(false)}>취소</TextButton>
      </Sheet>

      <Sheet open={confirmLogout} onClose={() => setConfirmLogout(false)} labelledBy="logoutTitle">
        <h2 id="logoutTitle" className="mt-6 text-2xl font-bold tracking-[-1px]">
          로그아웃할까요?
        </h2>
        <p className="mt-2 text-base text-txt-black-secondary">읽은 코스와 기록은 계정에 남아 있어요. 다시 로그인하면 이어서 읽을 수 있어요.</p>
        <PrimaryButton
          className="mt-6"
          onClick={async () => {
            await postJson('/api/auth/logout');
            router.replace('/start?logout=1');
            router.refresh();
          }}
        >
          로그아웃
        </PrimaryButton>
        <TextButton onClick={() => setConfirmLogout(false)}>취소</TextButton>
      </Sheet>
      <Toast message={toast} />
    </Screen>
  );
}
