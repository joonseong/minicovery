'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { setFlash } from '@/lib/client/flash';
import { postJson } from '@/lib/client/ndjson';

import { SocialButtons } from '../Social';
import { AppHeader, Footer, Main, PrimaryButton, Screen } from '../ui';

/** 서버(lib/auth isEmail)와 같은 기준 */
export const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PW_MIN = 8;

const INPUT = 'h-14 rounded-2xl border px-4 text-base leading-6 outline-none focus:border-border-brand';

/** 로그인(소셜 + 이메일) · 이메일 가입 (보조 수단) */
export function LoginScreen({ next, mode }: { next: string; mode: 'login' | 'signup' }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const signup = mode === 'signup';
  // 형식 오류는 입력하는 동안 바로 알린다 (버튼만 회색으로 두지 않는다)
  const emailHelp = email && !EMAIL_OK.test(email) ? '이메일 형식을 확인해 주세요' : '';
  const pwHelp = signup && pw && pw.length < PW_MIN ? `비밀번호는 ${PW_MIN}자 이상이에요` : '';
  const ready = EMAIL_OK.test(email) && pw.length >= (signup ? PW_MIN : 1);

  // 로그인 ↔ 가입 전환 때 이전 오류는 지운다
  useEffect(() => {
    setError('');
  }, [mode]);

  const done = () => {
    router.replace(next);
    router.refresh();
  };

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    const res = await postJson<{ error?: string }>(`/api/auth/${mode}`, { email, password: pw });
    setBusy(false);
    if (!res.ok) {
      setError(res.data.error ?? '다시 시도해 주세요.');
      return;
    }
    setFlash(signup ? '학습 기록이 계정에 저장됐어요' : '로그인했어요');
    done();
  };

  return (
    <Screen>
      <AppHeader layout="nav" back />
      <Main className="pb-6 pt-4">
        <h1 className="text-2xl font-bold tracking-[-1px]">{signup ? '이메일로 가입' : '로그인'}</h1>
        <p className="mt-2 text-base text-txt-black-secondary">
          {signup ? '지금까지 읽은 코스와 진도가 그대로 저장돼요.' : '이 기기에서 읽은 코스와 기록도 계정으로 옮겨 드려요. 계정에 있던 코스도 그대로 남아요.'}
        </p>
        {signup ? null : (
          <div className="mt-6">
            <SocialButtons next={next} onDone={done} divider="또는 이메일로" />
          </div>
        )}
        <form
          className={`${signup ? 'mt-8' : 'mt-6'} flex flex-col gap-4`}
          onSubmit={e => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="li-email" className="text-sm font-semibold text-txt-black-secondary">
              이메일
            </label>
            <input
              id="li-email"
              type="email"
              autoComplete="email"
              placeholder="name@example.com"
              value={email}
              onChange={e => setEmail(e.target.value.trim())}
              aria-invalid={Boolean(emailHelp)}
              aria-describedby={emailHelp ? 'li-email-help' : undefined}
              className={`${INPUT} ${emailHelp ? 'border-border-error' : 'border-border-button'}`}
            />
            {emailHelp ? (
              <p id="li-email-help" className="text-sm text-txt-error">
                {emailHelp}
              </p>
            ) : null}
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="li-pw" className="text-sm font-semibold text-txt-black-secondary">
              비밀번호
            </label>
            <input
              id="li-pw"
              type="password"
              autoComplete={signup ? 'new-password' : 'current-password'}
              placeholder={signup ? `${PW_MIN}자 이상` : '비밀번호'}
              value={pw}
              onChange={e => setPw(e.target.value)}
              aria-invalid={Boolean(pwHelp)}
              aria-describedby={signup ? 'li-pw-help' : undefined}
              className={`${INPUT} ${pwHelp ? 'border-border-error' : 'border-border-button'}`}
            />
            {signup ? (
              <p id="li-pw-help" className={pwHelp ? 'text-sm text-txt-error' : 'text-sm text-txt-black-tertiary'}>
                {pwHelp || `${PW_MIN}자 이상으로 정해 주세요`}
              </p>
            ) : null}
          </div>
          {error ? (
            <p role="alert" className="text-sm text-txt-error">
              {error}
            </p>
          ) : null}
          <button type="submit" className="hidden" />
        </form>
        <div className="mt-4 flex flex-col items-center">
          {signup ? null : (
            <Link href={`/forgot${email ? `?email=${encodeURIComponent(email)}` : ''}`} className="flex min-h-11 items-center px-3 text-sm text-txt-black-tertiary underline">
              비밀번호를 잊으셨나요?
            </Link>
          )}
          <Link
            href={`/login?mode=${signup ? 'login' : 'signup'}&next=${encodeURIComponent(next)}`}
            replace
            className="flex min-h-11 items-center px-3 text-sm text-txt-black-tertiary underline"
          >
            {signup ? '이미 계정이 있어요 · 로그인' : '처음이에요 · 이메일로 가입'}
          </Link>
        </div>
      </Main>
      <Footer>
        <PrimaryButton disabled={!ready} onClick={() => void submit()}>
          {busy ? '확인하는 중…' : signup ? '가입하기' : '로그인'}
        </PrimaryButton>
      </Footer>
    </Screen>
  );
}
