'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

/**
 * Fuse 디자인 캔버스(미니커버리 홈 · Fuse 스타일 시안)의 공통 요소.
 * 글자: 화면 제목 16 semibold, 본문 16, 보조 13·14, 큰 숫자 52, heading 28. 색은 tailwind `fuse-*`.
 * 카드 모서리 22(rounded-card)·테두리 #F0F0F2, 버튼은 검정 알약, 아래에서 올라오는 시트 위쪽만 28.
 * 안전 영역은 앱 껍데기(SafeAreaView)가 처리하므로 웹은 따로 두지 않는다.
 */

export function cx(...a: (string | false | null | undefined)[]) {
  return a.filter(Boolean).join(' ');
}

/* ---------- 아이콘 (Miniread UI 선 아이콘과 같은 모양) ---------- */

export function IconBack({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M15 5l-7 7 7 7" stroke="#0B0B0C" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconClose({ size = 24, color = '#0B0B0C' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M6 6l12 12M18 6 6 18" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </svg>
  );
}

export function IconArrow({ size = 16, color = '#AEAEB2' }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="m9 5 7 7-7 7" stroke={color} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function IconSetting({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="3" stroke="#0B0B0C" strokeWidth="2" />
      <path
        d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"
        stroke="#0B0B0C"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconCheck({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 12.5 10 17.5 19 7" stroke="#0B0B0C" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
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

/* ---------- 헤더 ---------- */

type HeaderProps = {
  /** nav: 동그란 뒤로·닫기 + 왼쪽 제목, large: 탭 화면 제목(16), logo: 로고 */
  layout?: 'nav' | 'logo' | 'large';
  title?: string;
  /** 뒤로 가기. true면 브라우저 기록으로 */
  back?: string | true;
  close?: string;
  settings?: boolean;
  /** 예전 구분선 (Fuse에서는 쓰지 않는다) */
  divider?: boolean;
};

/** 캔버스의 동그란 44 버튼 (테두리 #F0F0F2) */
const CIRCLE = 'mc-press flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-full border border-fuse-line bg-shape-white';

export function AppHeader({ layout = 'nav', title, back, close, settings }: HeaderProps) {
  const router = useRouter();
  return (
    <header className="relative flex min-h-[52px] flex-shrink-0 items-center gap-2 bg-shape-white px-5 pt-2">
      {layout === 'nav' && back ? (
        <button type="button" aria-label="뒤로" className={cx(CIRCLE, '-ml-2')} onClick={() => (back === true ? router.back() : router.push(back))}>
          <IconBack size={18} />
        </button>
      ) : null}
      {layout === 'nav' && close ? (
        <Link href={close} aria-label="닫기" className={cx(CIRCLE, '-ml-2')} replace>
          <IconClose size={16} />
        </Link>
      ) : null}
      {layout === 'logo' ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src="/logo.svg" alt="Minicovery" width={86} height={16} className="block h-4 w-auto" />
      ) : null}
      {layout === 'large' ? <h1 className="flex-1 text-base font-semibold">{title}</h1> : null}
      {layout === 'nav' && title ? <p className="min-w-0 flex-1 truncate text-sm font-medium">{title}</p> : <span className="flex-1" />}
      {settings ? (
        <Link href="/settings" aria-label="설정" className="-mr-2.5 flex h-11 w-11 items-center justify-center rounded-full">
          <IconSetting />
        </Link>
      ) : null}
    </header>
  );
}

/* ---------- 하단 탭 (떠 있는 알약 + 새 코스 버튼) ---------- */

const TABS = [
  { key: 'today', label: '홈', href: '/today' },
  { key: 'map', label: '내 학습', href: '/map' },
  { key: 'library', label: '프로필', href: '/library' },
] as const;

export type TabKey = (typeof TABS)[number]['key'] | 'explore';

function TabIcon({ tab, color }: { tab: (typeof TABS)[number]['key']; color: string }) {
  if (tab === 'today')
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M4 10.5 12 4l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" fill={color} />
      </svg>
    );
  if (tab === 'map')
    return (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M5 19V11M12 19V5M19 19v-5" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
      </svg>
    );
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="8.5" r="3.5" fill={color} />
      <path d="M5 19.5c1.2-3.3 3.8-5 7-5s5.8 1.7 7 5" stroke={color} strokeWidth="2.4" strokeLinecap="round" />
    </svg>
  );
}

/** 방금 눌러서 튕긴 탭. 새 화면의 탭바가 같은 탭을 한 번 더 튕기지 않게 (클라이언트 이동 동안 모듈 변수는 남는다) */
let poppedTab: { key: TabKey; at: number } | null = null;

/** 화면 위에 떠 있다. 쓰는 화면은 본문 아래에 여백(pb-32)을 둔다 */
export function BottomNav({ active }: { active: TabKey }) {
  // 누르는 즉시 그 탭을 켜고 튕긴다. 서버가 새 화면을 그리는 동안 기다리는 느낌을 줄인다
  const [pending, setPending] = useState<TabKey | null>(null);
  const [popOnMount] = useState(() => !(poppedTab && poppedTab.key === active && Date.now() - poppedTab.at < 3000));
  const shown = pending ?? active;
  return (
    <div
      className="pointer-events-none absolute inset-x-0 bottom-0 z-30 h-28"
      style={{ background: 'linear-gradient(rgba(255,255,255,0), #FFFFFF 60%)' }}
    >
      <nav aria-label="주요 메뉴" className="pointer-events-auto absolute inset-x-5 bottom-4 flex items-center justify-between">
        <div className="flex items-center gap-0.5 rounded-full bg-shape-white p-1 shadow-[0_8px_24px_rgba(15,15,20,0.10),0_0_0_1px_#F0F0F2]">
          {TABS.map(t => {
            const on = t.key === shown;
            const pop = on && (t.key === pending || (!pending && popOnMount));
            return (
              <Link
                key={t.key}
                href={t.href}
                replace
                aria-label={t.label}
                aria-current={t.key === active ? 'page' : undefined}
                onClick={() => {
                  if (t.key === active) return;
                  poppedTab = { key: t.key, at: Date.now() };
                  setPending(t.key);
                }}
                className={cx('mc-tab flex h-12 w-12 items-center justify-center rounded-full', on && 'bg-fuse-pill')}
              >
                <span className={cx('mc-ic flex', pop && 'mc-ic-on')}>
                  <TabIcon tab={t.key} color={on ? '#0B0B0C' : '#AEAEB2'} />
                </span>
              </Link>
            );
          })}
        </div>
        <Link
          href="/start"
          aria-label="새 코스 만들기"
          aria-current={active === 'explore' ? 'page' : undefined}
          className="mc-press flex h-[60px] w-[60px] items-center justify-center rounded-full bg-fuse-ink shadow-[0_8px_24px_rgba(15,15,20,0.25)]"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
            <path d="M12 5v14M5 12h14" stroke="#FFFFFF" strokeWidth="2.4" strokeLinecap="round" />
          </svg>
        </Link>
      </nav>
    </div>
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

const PRIMARY = 'mc-press flex h-14 w-full flex-shrink-0 items-center justify-center rounded-full bg-fuse-ink text-base font-semibold text-txt-white-primary';
const DISABLED = 'flex h-14 w-full flex-shrink-0 items-center justify-center rounded-full bg-fuse-pill text-base font-semibold text-fuse-faint';
const TEXT_BTN = 'flex h-12 w-full items-center justify-center text-sm font-semibold text-fuse-sub';
const OUTLINE =
  'mc-press flex h-14 w-full flex-shrink-0 items-center justify-center rounded-full border border-fuse-edge bg-shape-white text-base font-semibold text-fuse-ink';

type BtnProps = { children: ReactNode; href?: string; onClick?: () => void; disabled?: boolean; replace?: boolean; className?: string };

function Btn({ base, children, href, onClick, disabled, replace, className }: BtnProps & { base: string }) {
  // 비활성도 진짜 버튼으로 (보조 기술이 버튼으로 읽고, disabled 상태를 알린다)
  if (disabled) {
    return (
      <button type="button" disabled className={cx(DISABLED, className)}>
        {children}
      </button>
    );
  }
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

/** 캔버스의 분홍 글자 표시 (오늘 · 이용 중 · N일 연속) */
export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex flex-shrink-0 items-center gap-1 text-[13px] font-medium leading-5 text-fuse-hot', className)}>
      {children}
    </span>
  );
}

export function Progress({ value, track = 'bg-fuse-track', height = 6 }: { value: number; track?: string; height?: number }) {
  return (
    <div className={cx('flex-1 overflow-hidden rounded-full', track)} style={{ height }}>
      <div className="h-full rounded-full bg-fuse-ink" style={{ width: `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` }} />
    </div>
  );
}

export function Sheet({ open, onClose, children, labelledBy }: { open: boolean; onClose?: () => void; children: ReactNode; labelledBy?: string }) {
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-40">
      <div className="mc-fade absolute inset-0 bg-[rgba(0,0,0,0.35)]" onClick={onClose} />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className="mc-up absolute inset-x-0 bottom-0 flex max-h-[90%] flex-col overflow-y-auto rounded-t-[28px] bg-shape-white px-5 pb-5 pt-2.5 shadow-[0_-8px_24px_rgba(15,15,20,0.10)]"
      >
        <div aria-hidden="true" className="h-1 w-10 self-center rounded-full bg-fuse-edge" />
        {children}
      </section>
    </div>
  );
}

export function Loading({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 py-4">
      <span className="mc-pulse h-2 w-2 rounded-full bg-fuse-ink" />
      <span className="text-sm text-fuse-sub">{label}</span>
    </div>
  );
}

/* ---------- 토스트 (짧은 결과 안내, 3초 뒤 사라짐) ---------- */

export function useToast(ms = 3000): [string, (message: string) => void] {
  const [message, setMessage] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const show = useCallback(
    (m: string) => {
      setMessage(m);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setMessage(''), ms);
    },
    [ms],
  );
  useEffect(() => () => clearTimeout(timer.current), []);
  return [message, show];
}

export function Toast({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div role="status" aria-live="polite" className="mc-in pointer-events-none absolute inset-x-5 bottom-24 z-50 flex justify-center">
      <span className="rounded-full bg-shape-black px-5 py-3 text-center text-sm font-semibold text-txt-white-primary">{message}</span>
    </div>
  );
}

export { CHARACTER } from '@/lib/characters';
