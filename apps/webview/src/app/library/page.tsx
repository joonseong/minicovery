import Link from 'next/link';

import { CatIcon } from '@/components/CatIcon';
import { Doodle } from '@/components/Doodle';
import { AppHeader, Badge, BottomNav, Main, Screen } from '@/components/ui';
import { CHARACTER } from '@/lib/characters';
import { currentUser } from '@/lib/session';
import { type CourseCard, libraryData } from '@/lib/views';

export const dynamic = 'force-dynamic';

function Group({ name, items }: { name: string; items: CourseCard[] }) {
  if (!items.length) return null;
  return (
    <section className="mt-7 flex flex-col gap-2.5">
      <h2 className="text-[13px] font-semibold text-fuse-sub">
        {name} <span className="text-fuse-mute">{items.length}</span>
      </h2>
      <ul className="flex flex-col gap-2">
        {items.map(c => (
          <li key={c.id}>
            <Link href={`/course/${c.id}`} className="flex min-h-[76px] items-center gap-3.5 rounded-card border border-fuse-line bg-fuse-card p-4">
              <CatIcon category={c.category} />
              <span className="flex min-w-0 flex-1 flex-col gap-2">
                <span className="text-sm font-medium leading-[1.3]">{c.title}</span>
                <span className="flex items-center gap-2.5">
                  <span aria-hidden="true" className="block h-1.5 flex-1 overflow-hidden rounded-full bg-fuse-track">
                    <span className="block h-full rounded-full bg-fuse-ink" style={{ width: `${Math.round((c.done / Math.max(1, c.total)) * 100)}%` }} />
                  </span>
                  <span className="flex-shrink-0 text-[13px] font-semibold leading-[1.3]">
                    {c.done}
                    <span className="text-fuse-mute"> / {c.total}편</span>
                  </span>
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** 프로필 (캔버스 프로필 · Plus / 무료): 다 배운 주제 수 → 구독 → 코스 묶음 목록 */
export default async function LibraryPage() {
  const user = await currentUser();
  const d = await libraryData(user);
  const ch = CHARACTER[d.stage.key];
  return (
    <Screen>
      <AppHeader layout="large" title="프로필" settings />
      <Main className="pb-32 pt-3">
        <section className="flex items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <span className="text-sm text-fuse-sub">다 배운 주제</span>
              <Badge>{ch.name} 단계</Badge>
            </div>
            <p className="text-[52px] font-bold leading-none">
              {d.stage.learned}
              <span className="ml-[3px]">개</span>
            </p>
            <Link href="/map" className="-ml-0.5 inline-flex min-h-11 items-center gap-0.5 text-sm font-medium text-fuse-sub">
              내 학습 보기
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="m9 5 7 7-7 7" stroke="#8E8E93" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </Link>
          </div>
          <Doodle animal={d.stage.key} label={`${ch.name} 단계`} className="h-20 w-20 flex-shrink-0" />
        </section>
        {d.anon ? (
          <>
            <Link href="/signup?next=/library" className="mt-1 text-sm font-semibold underline">
              가입하고 학습 기록 저장하기
            </Link>
            <Link href="/login?next=/library" className="mt-3 text-sm font-medium text-fuse-sub underline">
              이미 계정이 있어요 · 로그인
            </Link>
          </>
        ) : null}

        {d.plus ? (
          <section className="mt-5 flex flex-col gap-2.5">
            <h2 className="text-[13px] font-medium text-fuse-sub">구독</h2>
            <Link href="/plus" className="flex items-center gap-3.5 rounded-card border border-fuse-line bg-fuse-card p-4">
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-center gap-2 text-base font-semibold leading-[1.3]">
                  미니커버리 Plus <Badge>이용 중</Badge>
                </span>
                {d.usage ? (
                  <>
                    <span className="text-[13px]">
                      새 코스 {d.usage.coursesLeft}개 · 전체 열기 {d.usage.openAllLeft}번 남음
                    </span>
                    <span className="text-[13px] text-fuse-sub">{d.usage.resetLabel}에 다시 채워져요</span>
                  </>
                ) : null}
              </span>
              <span className="inline-flex h-10 flex-shrink-0 items-center rounded-full bg-fuse-pill px-4 text-sm font-semibold">관리</span>
            </Link>
          </section>
        ) : (
          // 무료 사용자: 구독 자리를 눈에 띄는 Plus 카드로. 혜택 설명·결제는 /plus에서만
          <Link href="/plus?from=profile" className="mc-press mt-5 flex flex-col gap-[18px] rounded-card bg-fuse-ink p-5 text-txt-white-primary">
            <span className="flex flex-col gap-1">
              <span className="text-[13px] font-medium text-fuse-faint">미니커버리 Plus</span>
              <span className="text-xl font-bold leading-[1.3]">Plus로 더 많이 배워 보세요</span>
            </span>
            <span className="flex h-14 items-center justify-center rounded-full bg-shape-white text-base font-semibold text-fuse-ink">시작하기</span>
          </Link>
        )}

        <Group name="진행 중인 코스" items={d.active} />
        <Group name="다 배운 코스" items={d.done} />
        {!d.active.length && !d.done.length ? (
          <p className="mt-7 rounded-card border border-fuse-line bg-fuse-card p-4 text-sm text-fuse-sub">
            아직 코스가 없어요. 아래 + 버튼으로 궁금한 주제를 입력해 보세요.
          </p>
        ) : null}
      </Main>
      <BottomNav active="library" />
    </Screen>
  );
}
