import Link from 'next/link';

import { CatIcon } from '@/components/CatIcon';
import { Doodle, type DoodleAnimal } from '@/components/Doodle';
import { AppHeader, BottomNav, IconArrow, Main, Progress, Screen } from '@/components/ui';
import { CHARACTER } from '@/lib/characters';
import { currentUser } from '@/lib/session';
import { type MapPlace, mapData } from '@/lib/views';

export const dynamic = 'force-dynamic';

/** 주제 앞 동그라미 (캔버스 내 학습): 다 배움 = 검정 체크, 오늘 받는 코스 = 캐릭터, 배우는 중 = 분홍 점, 다음 추천 = 점선 + */
function Dot({ p, animal }: { p: MapPlace; animal: DoodleAnimal }) {
  if (p.state === 'here') return <Doodle animal={animal} act="hop" label="오늘 받는 코스" className="h-9 w-9 flex-shrink-0" />;
  if (p.state === 'done')
    return (
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-fuse-ink">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" role="img" aria-label="다 배움">
          <path d="M5 12.5 10 17.5 19 7" stroke="#FFFFFF" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  if (p.state === 'going')
    return (
      <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-fuse-line bg-shape-white">
        <span role="img" aria-label="배우는 중" className="h-2.5 w-2.5 rounded-full bg-fuse-hot" />
      </span>
    );
  return (
    <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border-[1.5px] border-dashed border-fuse-edge bg-shape-white">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" role="img" aria-label="다음 추천">
        <path d="M12 5v14M5 12h14" stroke="#A1A1A6" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </span>
  );
}

export default async function MapPage() {
  const user = await currentUser();
  const d = await mapData(user);
  const ch = CHARACTER[d.stage.key];
  return (
    <Screen>
      <AppHeader layout="large" title="내 학습" />
      <Main className="pb-32 pt-5">
        <section className="flex items-end justify-between gap-3">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="text-sm text-fuse-sub">{ch.name} 단계</span>
            <p className="text-[52px] font-bold leading-none">
              {d.learnedCount}
              <span className="relative -top-[0.14em] ml-1.5 text-[22px] leading-[1.3]">개 주제 다 배움</span>
            </p>
            <span className="text-sm text-fuse-sub">
              배우는 중 {d.going}개 · 다음 추천 {d.fog}개
            </span>
          </div>
          <Doodle animal={d.stage.key} label={`${ch.name} 캐릭터`} className="h-20 w-20 flex-shrink-0" />
        </section>

        {d.stage.next ? (
          <section className="mt-6 flex flex-col gap-2.5">
            <div className="flex items-center gap-3">
              <Progress value={d.learnedCount / d.stage.next.min} />
              <Doodle animal="cat" still label="다음 단계 고양이" className="h-8 w-8 flex-shrink-0 opacity-50 grayscale" />
            </div>
            <p className="text-sm font-medium">
              주제 {d.stage.next.left}개만 더 다 배우면 {d.stage.next.name}로 성장해요
            </p>
            <p className="text-[13px] text-fuse-sub">코스를 끝까지 읽으면 다 배운 주제가 돼요. ‘조금 헷갈려요’를 눌러도 똑같이 쳐요.</p>
          </section>
        ) : null}

        <Link href="/review" className="mt-5 flex items-center gap-3.5 rounded-card border border-fuse-line bg-fuse-card p-4">
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[10px] bg-fuse-ink">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M4 12a8 8 0 1 0 2.3-5.6M4 4v4h4" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-sm font-medium leading-[1.3]">이번 주 복습</span>
            <span className="text-[13px] text-fuse-sub">이번 주에 배운 한 문장 다시 보기</span>
          </span>
          <IconArrow />
        </Link>

        <section className="mt-9 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-base font-semibold leading-[1.3]">분야별 학습</h2>
            <p className="text-[13px] text-fuse-sub">
              + 표시는 배운 주제와 이어지는 다음 추천 주제예요. 누르면 새 코스를 만들어요.
              {d.usage ? ` (Plus · 새 코스 ${d.usage.coursesLeft}개 남음)` : ' 무료는 한 번에 코스 1개를 배울 수 있어요.'}
            </p>
          </div>
          {d.regions.length === 0 ? (
            <p className="rounded-card border border-fuse-line bg-fuse-card p-4 text-sm text-fuse-sub">첫 코스를 만들면 여기에 배운 주제가 쌓여요.</p>
          ) : null}
          {d.regions.map(r => (
            <article key={r.name} className="flex flex-col gap-3 rounded-card border border-fuse-line bg-fuse-card p-4">
              <div className="flex flex-col gap-2.5">
                <div className="flex items-center gap-2.5">
                  <CatIcon category={r.name} />
                  <h3 className="flex-1 text-base font-semibold leading-[1.3]">{r.name}</h3>
                  <span className={`flex-shrink-0 text-[13px] font-medium ${r.done ? 'text-fuse-hot' : 'text-fuse-faint'}`}>
                    {r.done} / {r.places.length}개 배움
                  </span>
                </div>
                <Progress value={r.done / Math.max(1, r.places.length)} />
              </div>
              <ul className="flex flex-col">
                {r.places.map(p => (
                  <li key={p.name} className="border-t border-[#F2F2F4]">
                    <Link
                      // 안개 주제는 새 코스 화면이 주제 검사→수준 선택까지 바로 진행한다
                      href={p.state === 'fog' ? `${p.href}${p.href.includes('?') ? '&' : '?'}go=1` : p.href}
                      className="flex min-h-[60px] items-center gap-3 py-2"
                    >
                      <Dot p={p} animal={d.stage.key} />
                      <span className="flex min-w-0 flex-1 flex-col gap-px">
                        <span className={p.state === 'fog' ? 'text-sm font-medium text-fuse-sub' : 'text-sm font-bold'}>{p.name}</span>
                        <span className={`text-[13px] ${p.state === 'done' ? 'text-fuse-hot' : p.state === 'fog' ? 'text-fuse-faint' : 'text-fuse-sub'}`}>
                          {p.status}
                        </span>
                      </span>
                      <IconArrow />
                    </Link>
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </section>
      </Main>
      <BottomNav active="map" />
    </Screen>
  );
}
