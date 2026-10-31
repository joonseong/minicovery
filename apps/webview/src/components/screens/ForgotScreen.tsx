'use client';

import { useState } from 'react';

import { postJson } from '@/lib/client/ndjson';

import { AppHeader, Footer, Main, PrimaryButton, Screen, TextButton } from '../ui';
import { EMAIL_OK } from './LoginScreen';

/** 비밀번호 재설정 메일 요청. 가입 여부는 드러내지 않는다 (서버는 항상 200) */
export function ForgotScreen({ initialEmail }: { initialEmail: string }) {
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const emailHelp = email && !EMAIL_OK.test(email) ? '이메일 형식을 확인해 주세요' : '';
  const ready = EMAIL_OK.test(email);

  const submit = async () => {
    if (!ready || busy) return;
    setBusy(true);
    setError('');
    const res = await postJson('/api/auth/forgot', { email });
    setBusy(false);
    if (!res.ok) {
      // 운영에 메일 설정이 아직 없으면(503 mail) 문의 경로를 안내한다
      setError(
        res.status === 503
          ? '지금은 재설정 메일을 보낼 수 없어요. 설정 > 문의하기로 연락해 주세요.'
          : '메일을 보내지 못했어요. 잠시 뒤 다시 시도해 주세요.',
      );
      return;
    }
    setSent(true);
  };

  return (
    <Screen>
      <AppHeader layout="nav" back />
      <Main className="pb-6 pt-4">
        <h1 className="text-2xl font-bold tracking-[-1px]">비밀번호 재설정</h1>
        {sent ? (
          <section className="mt-6 flex flex-col gap-2 rounded-2xl bg-shape-depth1 px-5 py-4">
            <p className="text-base font-semibold">메일을 보냈어요</p>
            <p className="text-sm text-txt-black-secondary">
              {email}로 보낸 메일의 링크를 1시간 안에 눌러 주세요. 메일이 안 보이면 스팸함도 확인해 주세요.
            </p>
          </section>
        ) : (
          <>
            <p className="mt-2 text-base text-txt-black-secondary">가입한 이메일을 적어 주시면 새 비밀번호를 정할 수 있는 링크를 보내 드려요.</p>
            <form
              className="mt-6 flex flex-col gap-2"
              onSubmit={e => {
                e.preventDefault();
                void submit();
              }}
            >
              <label htmlFor="fg-email" className="text-sm font-semibold text-txt-black-secondary">
                이메일
              </label>
              <input
                id="fg-email"
                type="email"
                autoComplete="email"
                placeholder="name@example.com"
                value={email}
                onChange={e => setEmail(e.target.value.trim())}
                aria-invalid={Boolean(emailHelp)}
                className={`h-14 rounded-2xl border px-4 text-base leading-6 outline-none focus:border-border-brand ${emailHelp ? 'border-border-error' : 'border-border-button'}`}
              />
              {emailHelp ? <p className="text-sm text-txt-error">{emailHelp}</p> : null}
              {error ? (
                <p role="alert" className="text-sm text-txt-error">
                  {error}
                </p>
              ) : null}
              <button type="submit" className="hidden" />
            </form>
          </>
        )}
      </Main>
      <Footer>
        {sent ? (
          <>
            <PrimaryButton href="/login" replace>
              로그인으로 돌아가기
            </PrimaryButton>
            <TextButton onClick={() => setSent(false)}>다른 이메일로 다시 보내기</TextButton>
          </>
        ) : (
          <PrimaryButton disabled={!ready} onClick={() => void submit()}>
            {busy ? '보내는 중…' : '재설정 메일 보내기'}
          </PrimaryButton>
        )}
      </Footer>
    </Screen>
  );
}
