import Link from 'next/link';

import { AppHeader, BottomNav, Main, Screen } from '@/components/ui';
import { CHARACTER } from '@/lib/characters';
import { currentUser } from '@/lib/session';
import { type CourseCard, libraryData } from '@/lib/views';

export const dynamic = 'force-dynamic';

const Chevron = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true" className="flex-shrink-0">
    <path d="m9 5 7 7-7 7" stroke="#B4B5C1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function Group({ name, items }: { name: string; items: CourseCard[] }) {
  if (!items.length) return null;
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-sm font-bold text-txt-black-secondary">
        {name} <span className="font-normal text-txt-black-tertiary">{items.length}</span>
      </h2>
      <ul className="overflow-hidden rounded-2xl bg-shape-depth1">
        {items.map(c => (
          <li key={c.id} style={{ boxShadow: 'inset 0 -1px 0 #FFFFFF' }}>
            <Link href={`/course/${c.id}`} className="flex items-center gap-3 py-4 pl-5 pr-4">
              <span className="flex min-w-0 flex-1 flex-col gap-2">
                <span className="text-base font-semibold">{c.title}</span>
                <span className="flex items-center gap-2">
                  <span className="block h-1.5 flex-1 overflow-hidden rounded-full bg-shape-white">
                    <span className="block h-full rounded-full bg-shape-brand" style={{ width: `${Math.round((c.done / Math.max(1, c.total)) * 100)}%` }} />
                  </span>
                  <span className="flex-shrink-0 text-sm text-txt-black-tertiary">
                    {c.done} / {c.total}편
                  </span>
                </span>
              </span>
              <Chevron />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 프로필: 등급 · 다 배운 주제 수 → 구독 → 코스 묶음 목록 */
export default async function LibraryPage() {
  const user = await currentUser();
  const d = await libraryData(user);
  const ch = CHARACTER[d.stage.key];
  return (
    <Screen>
      <AppHeader layout="large" title="프로필" settings />
      <Main className="gap-8 pb-8 pt-2">
        <section className="flex flex-col items-center pt-2 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={ch.face} alt={`${ch.name} 단계`} className="h-[72px] w-[72px] object-contain" />
          <p className="mt-3 text-sm font-bold text-txt-point">{ch.name} 단계</p>
          <p className="mt-0.5 text-2xl font-bold tracking-[-1px]">다 배운 주제 {d.stage.learned}개</p>
          <Link href="/map" className="mt-1 inline-flex min-h-11 items-center gap-0.5 text-sm text-txt-black-tertiary">
            내 학습 보기
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="m9 5 7 7-7 7" stroke="#858691" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          {d.anon ? (
            <Link href="/signup?next=/library" className="text-sm font-semibold text-txt-point underline">
              가입하고 학습 기록 저장하기
            </Link>
          ) : null}
        </section>

        {d.plus ? (
          <section className="flex flex-col gap-2">
            <h2 className="text-sm font-bold text-txt-black-secondary">구독</h2>
            <Link href="/plus" className="flex items-center gap-3 rounded-2xl bg-shape-depth1 py-4 pl-5 pr-4">
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-base font-semibold">
                  미니커버리 Plus <span className="text-txt-point">이용 중</span>
                </span>
                {d.usage ? (
                  <>
                    <span className="text-sm text-txt-black-secondary">
                      새 코스 {d.usage.coursesLeft}개 · 전체 열기 {d.usage.openAllLeft}번 남음
                    </span>
                    <span className="text-sm text-txt-black-tertiary">{d.usage.resetLabel}에 다시 채워져요</span>
                  </>
                ) : null}
              </span>
              <span className="flex flex-shrink-0 items-center gap-1 text-sm font-semibold text-txt-black-secondary">
                관리
                <Chevron />
              </span>
            </Link>
          </section>
        ) : (
          // 무료 사용자: 구독 자리를 눈에 띄는 Plus 배너로. 혜택 설명·결제는 /plus에서만
          <Link href="/plus?from=profile" className="mc-press flex flex-col gap-4 rounded-2xl bg-shape-brand p-5 text-txt-white-primary">
            <span className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-txt-white-secondary">미니커버리 Plus</span>
              <span className="text-lg font-bold">Plus로 더 많이 배워 보세요</span>
            </span>
            <span className="flex h-[52px] items-center justify-center rounded-full bg-shape-white text-base font-bold text-txt-point">시작하기</span>
          </Link>
        )}

        <Group name="진행 중인 코스" items={d.active} />
        <Group name="다 배운 코스" items={d.done} />
        {!d.active.length && !d.done.length ? (
          <p className="rounded-2xl bg-shape-depth1 p-5 text-sm text-txt-black-secondary">아직 코스가 없어요. 새 코스 탭에서 궁금한 주제를 입력해 보세요.</p>
        ) : null}
      </Main>
      <BottomNav active="library" />
    </Screen>
  );
}
