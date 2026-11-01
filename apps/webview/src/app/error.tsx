'use client';

import { useEffect } from 'react';

import { Doodle } from '@/components/Doodle';
import { AppHeader, Footer, Main, OutlineButton, PrimaryButton, Screen } from '@/components/ui';

/** 서버·렌더링 예외. 다시 시도(reset)와 홈으로 가는 길을 둔다 */
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[page error]', error);
  }, [error]);

  return (
    <Screen>
      <AppHeader layout="logo" />
      <Main className="items-center justify-center pb-6 pt-4 text-center">
        <Doodle animal="rabbit" act="tilt" className="h-24 w-24" />
        <h1 className="mt-4 text-2xl font-bold tracking-[-1px]">잠시 문제가 생겼어요</h1>
        <p className="mt-2 text-base text-txt-black-secondary">
          다시 시도해 주세요.
          <br />
          계속 같은 문제가 생기면 설정의 문의하기로 알려 주세요.
        </p>
      </Main>
      <Footer className="gap-2">
        <PrimaryButton onClick={reset}>다시 시도</PrimaryButton>
        <OutlineButton href="/today" replace>
          홈으로 가기
        </OutlineButton>
      </Footer>
    </Screen>
  );
}
