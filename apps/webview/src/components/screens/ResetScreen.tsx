'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { setFlash } from '@/lib/client/flash';
import { postJson } from '@/lib/client/ndjson';

import { AppHeader, Footer, Main, PrimaryButton, Screen } from '../ui';
import { PW_MIN } from './LoginScreen';

const ERRORS: Record<string, string> = {
  invalid: '링크가 올바르지 않아요. 재설정 메일을 다시 요청해 주세요.',
  expired: '링크가 만료됐어요. 재설정 메일을 다시 요청해 주세요.',
  password: `비밀번호는 ${PW_MIN}자 이상이에요.`,
};

const INPUT = 'h-14 rounded-2xl border px-4 text-base leading-6 outline-none focus:border-border-brand';

/** 메일 링크(/reset?token=)로 들어와 새 비밀번호를 두 번 적는다 */
export function ResetScreen({ token }: { token: string }) {
  const router = useRouter();
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(token ? '' : ERRORS.invalid!);
  const pwHelp = pw && pw.length < PW_MIN ? `비밀번호는 ${PW_MIN}자 이상이에요` : '';
  const matchHelp = pw2 && pw !== pw2 ? '두 비밀번호가 서로 달라요' : '';
  const ready = Boolean(token) && pw.length >= PW_MIN && pw === pw2;
  const needNewLink = error === ERRORS.invalid || error === ERRORS.expired;

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    const res = await postJson<{ ok?: boolean; error?: string }>('/api/auth/reset', { token, password: pw });
    setBusy(false);
    if (!res.ok) {
      setError(ERRORS[res.data.error ?? ''] ?? '비밀번호를 바꾸지 못했어요. 잠시 뒤 다시 시도해 주세요.');
      return;
    }
    setFlash('비밀번호를 바꿨어요');
    router.replace('/today');
    router.refresh();
  };

  return (
    <Screen>
      <AppHeader layout="nav" close="/login" />
      <Main className="pb-6 pt-4">
        <h1 className="text-2xl font-bold tracking-[-1px]">새 비밀번호</h1>
        <p className="mt-2 text-base text-txt-black-secondary">{PW_MIN}자 이상으로 새 비밀번호를 정해 주세요.</p>
        <form
          className="mt-6 flex flex-col gap-4"
          onSubmit={e => {
            e.preventDefault();
            void submit();
          }}
        >
          <div className="flex flex-col gap-2">
            <label htmlFor="rs-pw" className="text-sm font-semibold text-txt-black-secondary">
              새 비밀번호
            </label>
            <input
              id="rs-pw"
              type="password"
              autoComplete="new-password"
              placeholder={`${PW_MIN}자 이상`}
              value={pw}
              onChange={e => setPw(e.target.value)}
              disabled={!token}
              aria-invalid={Boolean(pwHelp)}
              className={`${INPUT} ${pwHelp ? 'border-border-error' : 'border-border-button'}`}
            />
            {pwHelp ? <p className="text-sm text-txt-error">{pwHelp}</p> : null}
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor="rs-pw2" className="text-sm font-semibold text-txt-black-secondary">
              한 번 더
            </label>
            <input
              id="rs-pw2"
              type="password"
              autoComplete="new-password"
              placeholder="같은 비밀번호"
              value={pw2}
              onChange={e => setPw2(e.target.value)}
              disabled={!token}
              aria-invalid={Boolean(matchHelp)}
              className={`${INPUT} ${matchHelp ? 'border-border-error' : 'border-border-button'}`}
            />
            {matchHelp ? <p className="text-sm text-txt-error">{matchHelp}</p> : null}
          </div>
          {error ? (
            <p role="alert" className="text-sm text-txt-error">
              {error}
              {needNewLink ? (
                <>
                  {' '}
                  <Link href="/forgot" className="font-semibold underline">
                    다시 요청하기
                  </Link>
                </>
              ) : null}
            </p>
          ) : null}
          <button type="submit" className="hidden" />
        </form>
      </Main>
      <Footer>
        <PrimaryButton disabled={!ready} onClick={() => void submit()}>
          {busy ? '바꾸는 중…' : '비밀번호 바꾸기'}
        </PrimaryButton>
      </Footer>
    </Screen>
  );
}
