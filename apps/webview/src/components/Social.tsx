'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { canAppleSignIn, canSocialSignIn, nativeAppleSignIn, nativeGoogleSignIn, nativeKakaoSignIn } from '@/lib/client/bridge';
import { postJson } from '@/lib/client/ndjson';

import { cx } from './ui';

/**
 * 소셜 로그인 버튼. 카카오 → Google → Apple 순서.
 * 셋 다 앱(네이티브)이 로그인 창을 띄우고 받은 토큰을 서버가 검증한다. 앱에 그 기능이 있을 때만 보인다.
 * 웹이나 옛 앱 버전에서는 이메일로 계속하기만.
 */
export function SocialButtons({ height = 56, next, onDone }: { height?: 52 | 56; next: string; onDone: () => void }) {
  const [available, setAvailable] = useState({ apple: false, kakao: false, google: false });
  const [error, setError] = useState('');
  useEffect(() => setAvailable({ apple: canAppleSignIn(), kakao: canSocialSignIn('kakao'), google: canSocialSignIn('google') }), []);
  const base = 'relative flex items-center justify-center rounded-xl text-base font-semibold';

  /** 앱에서 토큰을 받아 서버에 넘긴다. 사용자가 닫은 경우(canceled)는 조용히 둔다 */
  const signIn = async (name: string, url: string, field: string, getToken: () => Promise<{ token?: string; error?: string }>) => {
    setError('');
    const r = await getToken();
    if (!r.token) {
      if (r.error && r.error !== 'canceled') setError(`${name} 로그인을 하지 못했어요. 다시 시도해 주세요.`);
      return;
    }
    const res = await postJson(url, { [field]: r.token });
    if (res.ok) onDone();
    else setError(`${name} 로그인을 확인하지 못했어요.`);
  };
  const signInApple = () =>
    signIn('Apple', '/api/auth/apple', 'identityToken', async () => {
      const r = await nativeAppleSignIn();
      return { token: r.identityToken, error: r.error };
    });
  const signInKakao = () =>
    signIn('카카오', '/api/auth/kakao', 'accessToken', async () => {
      const r = await nativeKakaoSignIn();
      return { token: r.accessToken, error: r.error };
    });
  const signInGoogle = () =>
    signIn('Google', '/api/auth/google', 'idToken', async () => {
      const r = await nativeGoogleSignIn();
      return { token: r.idToken, error: r.error };
    });

  return (
    <div className="flex flex-col gap-2">
      {available.kakao ? (
        <button type="button" onClick={() => void signInKakao()} className={cx(base, 'mc-press bg-[#FEE500] text-[rgba(0,0,0,0.85)]')} style={{ height }}>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" className="absolute left-5">
            <path d="M12 4C7.03 4 3 7.13 3 11c0 2.5 1.67 4.69 4.19 5.93l-.86 3.13c-.08.28.24.5.48.34l3.73-2.47c.48.05.97.07 1.46.07 4.97 0 9-3.13 9-7s-4.03-7-9-7z" fill="#000" />
          </svg>
          카카오로 시작하기
        </button>
      ) : null}
      {available.google ? (
        <button type="button" onClick={() => void signInGoogle()} className={cx(base, 'mc-press border border-border-button bg-shape-white')} style={{ height }}>
          Google로 시작하기
        </button>
      ) : null}
      {available.apple ? (
        <button type="button" onClick={() => void signInApple()} className={cx(base, 'mc-press bg-[#000] text-txt-white-primary')} style={{ height }}>
          <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true" className="absolute left-5">
            <path
              fill="#fff"
              d="M16.37 12.6c-.02-2.2 1.8-3.26 1.88-3.31-1.03-1.5-2.62-1.7-3.18-1.73-1.35-.14-2.64.8-3.33.8-.69 0-1.74-.78-2.86-.76-1.47.02-2.83.86-3.59 2.17-1.53 2.66-.39 6.6 1.1 8.76.73 1.06 1.6 2.24 2.73 2.2 1.1-.04 1.51-.71 2.84-.71 1.32 0 1.7.71 2.86.69 1.18-.02 1.93-1.07 2.65-2.13.84-1.22 1.18-2.41 1.2-2.47-.03-.01-2.3-.88-2.3-3.51zM14.2 6.13c.6-.73 1.01-1.75.9-2.76-.87.04-1.92.58-2.54 1.31-.56.65-1.05 1.68-.92 2.68.97.07 1.96-.49 2.56-1.23z"
            />
          </svg>
          Apple로 시작하기
        </button>
      ) : null}
      <Link
        href={`/login?mode=signup&next=${encodeURIComponent(next)}`}
        className={cx(base, 'mc-press border border-border-button bg-shape-white text-txt-black-primary')}
        style={{ height }}
      >
        이메일로 계속하기
      </Link>
      {error ? <p className="text-center text-sm text-txt-error">{error}</p> : null}
    </div>
  );
}
