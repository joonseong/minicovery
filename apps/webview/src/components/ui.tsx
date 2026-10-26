'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { ReactNode } from 'react';

/**
 * 디자인 캔버스(미니커버리 앱 디자인)의 공통 요소.
 * 글자: 가장 작은 글자 14, 타이틀 18, 본문 16, heading 24·28. 뱃지 13, 하단 탭 라벨 12.
 * 카드 모서리 16, 아래에서 올라오는 시트 위쪽만 24.
 * 안전 영역은 앱 껍데기(SafeAreaView)가 처리하므로 웹은 따로 두지 않는다.
 */

export function cx(...a: (string | false | null | undefined)[]) {
  return a.filter(Boolean).join(' ');
}

/* ---------- 아이콘 (Miniread UI 선 아이콘과 같은 모양) ---------- */

export function IconBack({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 5 8 12l7 7" stroke="#151517" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconClose({ size = 24, color = '#151517' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function IconArrow({ size = 20, color = '#9FA0AA' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m9 5 7 7-7 7" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconSetting({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        stroke="#3F4047"
        strokeWidth="1.8"
      />
      <path
        d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1.1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1Z"
        stroke="#3F4047"
        strokeWidth="1.8"
      />
    </svg>
  );
}

export function IconCheck({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12.5 10 17.5 19 7" stroke="#18715B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconPlus({ size = 20, color = '#858691' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 5v14M5 12h14" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

export function IconSwap() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 8h14m0 0-3.5-3.5M18 8l-3.5 3.5M20 16H6m0 0 3.5-3.5M6 16l3.5 3.5"
        stroke="#3F4047"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ---------- 헤더 (높이 44) ---------- */

type HeaderProps = {
  layout?: 'nav' | 'logo' | 'large';
  title?: string;
  /** 뒤로 가기. true면 브라우저 기록으로 */
  back?: string | true;
  close?: string;
  settings?: boolean;
  divider?: boolean;
};

export function AppHeader({ layout = 'nav', title, back, close, settings, divider }: HeaderProps) {
  const router = useRouter();
  return (
    <header
      className="relative flex h-11 flex-shrink-0 items-center justify-between bg-shape-white px-2"
      style={{ boxShadow: divider ? 'inset 0 -1px 0 #EEEEF9' : undefined }}
    >
      <div className="flex min-w-12 items-center">
        {layout === 'nav' && back ? (
          <button
            type="button"
            aria-label="뒤로"
            className="flex h-11 w-12 items-center justify-center"
            onClick={() => (back === true ? router.back() : router.push(back))}
          >
            <IconBack />
          </button>
        ) : null}
        {layout === 'logo' ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src="/logo.svg" alt="Minicovery" width={86} height={16} className="ml-3 block h-4 w-auto" />
        ) : null}
        {layout === 'large' ? <h1 className="ml-3 text-lg font-semibold">{title}</h1> : null}
      </div>
      {layout === 'nav' && title ? (
        <p className="absolute left-16 right-16 truncate text-center text-lg font-semibold">{title}</p>
      ) : null}
      <div className="flex min-w-12 items-center justify-end">
        {settings ? (
          <Link href="/settings" aria-label="설정" className="flex h-11 w-12 items-center justify-center">
            <IconSetting />
          </Link>
        ) : null}
        {close ? (
          <Link href={close} aria-label="닫기" className="flex h-11 w-12 items-center justify-center" replace>
            <IconClose />
          </Link>
        ) : null}
      </div>
    </header>
  );
}

/* ---------- 하단 탭 ---------- */

const TABS = [
  { key: 'today', label: '홈', href: '/today', icon: 'today' },
  { key: 'explore', label: '새 코스', href: '/start', icon: 'explore' },
  { key: 'map', label: '내 학습', href: '/map', icon: 'learn' },
  { key: 'library', label: '프로필', href: '/library', icon: 'profile' },
] as const;

export type TabKey = (typeof TABS)[number]['key'];

export function BottomNav({ active }: { active: TabKey }) {
  return (
    <nav
      aria-label="주요 메뉴"
      className="grid flex-shrink-0 grid-cols-4 bg-shape-white px-2 pb-1 pt-2"
      style={{ boxShadow: 'inset 0 1px 0 #EEEEF9' }}
    >
      {TABS.map(t => {
        const on = t.key === active;
        return (
          <Link
            key={t.key}
            href={t.href}
            replace
            aria-current={on ? 'page' : undefined}
            className="mc-tab flex h-12 flex-col items-center justify-center gap-0.5"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/img/tab/${t.icon}-${on ? 'on' : 'off'}.png`}
              alt=""
              width={30}
              height={30}
              className={cx('mc-ic block h-[30px] w-[30px] object-contain', on && 'mc-ic-on')}
            />
            <span className={cx('text-xs leading-4', on ? 'font-bold text-txt-black-primary' : 'text-txt-black-tertiary')}>
              {t.label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

/* ---------- 레이아웃 ---------- */

export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('flex h-full min-h-0 flex-1 flex-col bg-shape-white', className)}>{children}</div>;
}

export function Main({ children, className }: { children: ReactNode; className?: string }) {
  return <main className={cx('flex min-h-0 flex-1 flex-col overflow-y-auto px-5', className)}>{children}</main>;
}

export function Footer({ children, className }: { children: ReactNode; className?: string }) {
  return <footer className={cx('flex flex-shrink-0 flex-col gap-1 bg-shape-white px-5 pb-2 pt-3', className)}>{children}</footer>;
}

/* ---------- 버튼 ---------- */

const PRIMARY = 'mc-press flex h-14 w-full items-center justify-center rounded-full bg-shape-brand text-base font-semibold text-txt-white-primary';
const DISABLED = 'flex h-14 w-full items-center justify-center rounded-full bg-shape-depth2 text-base font-semibold text-txt-black-tertiary';
const TEXT_BTN = 'flex h-12 w-full items-center justify-center text-sm font-semibold text-txt-black-tertiary';
const OUTLINE =
  'mc-press flex h-14 w-full items-center justify-center rounded-full border border-border-button bg-shape-white text-base font-semibold text-txt-black-primary';

type BtnProps = { children: ReactNode; href?: string; onClick?: () => void; disabled?: boolean; replace?: boolean; className?: string };

function Btn({ base, children, href, onClick, disabled, replace, className }: BtnProps & { base: string }) {
  if (disabled) return <div aria-disabled="true" className={cx(DISABLED, className)}>{children}</div>;
  if (href) {
    return (
      <Link href={href} replace={replace} className={cx(base, className)} onClick={onClick}>
        {children}
      </Link>
    );
  }
  return (
    <button type="button" className={cx(base, className)} onClick={onClick}>
      {children}
    </button>
  );
}

export const PrimaryButton = (p: BtnProps) => <Btn base={PRIMARY} {...p} />;
export const OutlineButton = (p: BtnProps) => <Btn base={OUTLINE} {...p} />;
export const TextButton = (p: BtnProps) => <Btn base={TEXT_BTN} {...p} />;

/* ---------- 조각 ---------- */

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex flex-shrink-0 items-center rounded-full bg-shape-depth1 px-3 py-1 text-[13px] font-bold leading-5 text-txt-point', className)}>
      {children}
    </span>
  );
}

export function Progress({ value, track = 'bg-shape-depth2', height = 8 }: { value: number; track?: string; height?: number }) {
  return (
    <div className={cx('flex-1 overflow-hidden rounded-full', track)} style={{ height }}>
      <div className="h-full rounded-full bg-shape-brand" style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }} />
    </div>
  );
}

export function Sheet({ open, onClose, children, labelledBy }: { open: boolean; onClose?: () => void; children: ReactNode; labelledBy?: string }) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-40">
      <div className="mc-fade absolute inset-0 bg-[rgba(21,21,23,0.5)]" onClick={onClose} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="mc-up absolute inset-x-0 bottom-0 flex max-h-[90%] flex-col overflow-y-auto rounded-t-[24px] bg-shape-white px-5 pb-4 pt-3"
      >
        <div aria-hidden="true" className="h-1 w-10 self-center rounded-full bg-shape-div" />
        {children}
      </section>
    </div>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-4">
      <span className="mc-pulse h-2 w-2 rounded-full bg-shape-brand" />
      <span className="text-sm text-txt-black-tertiary">{label}</span>
    </div>
  );
}

export { CHARACTER } from '@/lib/characters';
