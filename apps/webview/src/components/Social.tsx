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
 * 이메일 로그인 화면에서는 이메일 링크 대신 아래 이메일 입력과 나누는 줄(divider)을 붙인다.
 */
export function SocialButtons({
  height = 56,
  next,
  onDone,
  divider,
}: {
  height?: 52 | 56;
  next: string;
  onDone: () => void;
  divider?: string;
}) {
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
          <svg width="20" height="20" viewBox="0 0 48 48" aria-hidden="true" className="absolute left-5">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
          </svg>
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
      {divider ? (
        available.kakao || available.google || available.apple ? (
          <div className="mt-4 flex items-center gap-3">
            <span aria-hidden="true" className="h-px flex-1 bg-border-div" />
            <span className="text-sm text-txt-black-tertiary">{divider}</span>
            <span aria-hidden="true" className="h-px flex-1 bg-border-div" />
          </div>
        ) : null
      ) : (
        <Link
          href={`/login?mode=signup&next=${encodeURIComponent(next)}`}
          className={cx(base, 'mc-press border border-border-button bg-shape-white text-txt-black-primary')}
          style={{ height }}
        >
          이메일로 계속하기
        </Link>
      )}
      {error ? <p className="text-center text-sm text-txt-error">{error}</p> : null}
    </div>
  );
}
