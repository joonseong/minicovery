'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';

import { Doodle } from '../Doodle';
import { SocialButtons } from '../Social';
import { AppHeader, Footer, Main, Screen } from '../ui';

export function SignupScreen({ next }: { next: string }) {
  const router = useRouter();
  return (
    <Screen>
      <AppHeader layout="nav" back />
      <Main className="justify-center pb-6 pt-4">
        <Doodle animal="rabbit" act="hello" label="미니커버리 토끼 캐릭터" className="h-[120px] w-[120px]" />
        <h1 className="mt-7 text-[28px] font-bold leading-[1.3]">학습 기록 저장하기</h1>
        <p className="mt-2.5 text-sm text-fuse-sub">
          지금까지 읽은 코스와 진도가 그대로 저장돼요.
          <br />
          다른 기기에서도 이어서 읽을 수 있어요.
        </p>
      </Main>
      <Footer className="gap-2">
        <SocialButtons
          next={next}
          onDone={() => {
            router.replace(next);
            router.refresh();
          }}
        />
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="flex min-h-11 items-center self-center px-3 text-sm font-medium text-fuse-ink underline">
          이미 계정이 있어요 · 로그인
        </Link>
        <p className="mb-2 text-center text-[13px] text-fuse-sub">
          시작하면{' '}
          <Link href="/terms" className="underline">
            이용약관
          </Link>
          과{' '}
          <Link href="/privacy" className="underline">
            개인정보 처리방침
          </Link>
          에 동의하게 돼요.
        </p>
      </Footer>
    </Screen>
  );
}
