import { redirect } from 'next/navigation';

import { Doodle } from '@/components/Doodle';
import { AppHeader, Footer, Main, PrimaryButton, Screen, TextButton } from '@/components/ui';
import { CHARACTER } from '@/lib/characters';
import { consumeLevelUp } from '@/lib/service';
import { currentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** 단계 상승 축하. 한 번만 보여 준다 (consumeLevelUp이 비우면 다시 못 들어온다) */
export default async function LevelUpPage({ searchParams }: { searchParams: { next?: string } }) {
  const user = await currentUser();
  const next = searchParams.next?.startsWith('/') ? searchParams.next : '/today';
  const up = await consumeLevelUp(user);
  // 이미 본 축하 화면은 다시 열리지 않는다 (1회성)
  if (!up) redirect('/map');
  const ch = CHARACTER[up.stage.key];
  const learned = user.learned?.length ?? 0;
  const last = user.learned?.[learned - 1];
  // 완주 화면(공유·추천)이 다음 차례라 1순위로, 내 학습은 보조
  const toDone = next.startsWith('/course/');
  return (
    <Screen>
      <AppHeader layout="nav" close={next} />
      <Main className="items-center justify-center pb-6 pt-4 text-center">
        <div className="mc-pop mt-4 flex aspect-square w-[min(224px,56vw)] items-center justify-center">
          <Doodle animal={up.stage.key} act="cheer" label={`${ch.name} 캐릭터`} className="block h-full w-full" />
        </div>
        <h1 className="mt-4 text-[28px] font-bold leading-9 tracking-[-1px]">{up.stage.name} 단계가 됐어요!</h1>
        <p className="mt-2 text-base text-txt-black-secondary">
          {last ? `‘${last.topic}’까지 ` : ''}다 배운 주제가 {learned}개가 됐어요.
        </p>
      </Main>
      <Footer>
        <PrimaryButton href={next} replace>
          {toDone ? '코스 완주 화면 보기' : '계속하기'}
        </PrimaryButton>
        <TextButton href="/map" replace>
          내 학습 보기
        </TextButton>
      </Footer>
    </Screen>
  );
}
