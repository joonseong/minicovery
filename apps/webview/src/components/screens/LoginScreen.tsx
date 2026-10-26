'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { postJson } from '@/lib/client/ndjson';

import { SocialButtons } from '../Social';
import { AppHeader, Footer, Main, PrimaryButton, Screen } from '../ui';

/** 로그인(소셜 + 이메일) · 이메일 가입 (보조 수단) */
export function LoginScreen({ next, mode }: { next: string; mode: 'login' | 'signup' }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const signup = mode === 'signup';
  const ready = email.includes('@') && pw.length >= (signup ? 8 : 1);

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
              onChange={e => setEmail(e.target.value)}
              className="h-14 rounded-2xl border border-border-button px-4 text-base leading-6 outline-none focus:border-border-brand"
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="li-pw" className="text-sm font-semibold text-txt-black-secondary">
              비밀번호
            </label>
            <input
              id="li-pw"
              type="password"
              autoComplete={signup ? 'new-password' : 'current-password'}
              placeholder={signup ? '8자 이상' : '비밀번호'}
              value={pw}
              onChange={e => setPw(e.target.value)}
              className="h-14 rounded-2xl border border-border-button px-4 text-base leading-6 outline-none focus:border-border-brand"
            />
          </div>
          {error ? <p className="text-sm text-txt-error">{error}</p> : null}
          <button type="submit" className="hidden" />
        </form>
        <Link
          href={`/login?mode=${signup ? 'login' : 'signup'}&next=${encodeURIComponent(next)}`}
          replace
          className="mt-4 flex min-h-11 items-center self-center px-3 text-sm text-txt-black-tertiary underline"
        >
          {signup ? '이미 계정이 있어요 · 로그인' : '처음이에요 · 이메일로 가입'}
        </Link>
      </Main>
      <Footer>
        <PrimaryButton disabled={!ready} onClick={() => void submit()}>
          {busy ? '확인하는 중…' : signup ? '가입하기' : '로그인'}
        </PrimaryButton>
      </Footer>
    </Screen>
  );
}
