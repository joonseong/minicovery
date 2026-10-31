import { AppHeader, Footer, Main, PrimaryButton, Screen } from '@/components/ui';
import { CHARACTER } from '@/lib/characters';

/** 없는 코스·남의 Drop 등. 웹뷰에는 주소창이 없어서 돌아갈 길을 꼭 둔다 */
export default function NotFound() {
  return (
    <Screen>
      <AppHeader layout="logo" />
      <Main className="items-center justify-center pb-6 pt-4 text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={CHARACTER.rabbit.still} alt="" className="h-24 w-24 object-contain" />
        <h1 className="mt-4 text-2xl font-bold tracking-[-1px]">페이지를 찾을 수 없어요</h1>
        <p className="mt-2 text-base text-txt-black-secondary">
          주소가 바뀌었거나 지워진 페이지예요.
          <br />
          홈에서 오늘 Drop을 이어서 읽어 보세요.
        </p>
      </Main>
      <Footer>
        <PrimaryButton href="/today" replace>
          홈으로 가기
        </PrimaryButton>
      </Footer>
    </Screen>
  );
}
