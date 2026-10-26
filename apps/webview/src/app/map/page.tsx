import Link from 'next/link';

import { AppHeader, BottomNav, Main, Progress, Screen } from '@/components/ui';
import { CHARACTER } from '@/lib/characters';
import { currentUser } from '@/lib/session';
import { type MapPlace, mapData } from '@/lib/views';

export const dynamic = 'force-dynamic';

function Dot({ p }: { p: MapPlace }) {
  /* eslint-disable @next/next/no-img-element */
  if (p.state === 'done') return <img src="/img/flag.png" alt="다 배움" className="h-7 w-7 object-contain" />;
  if (p.state === 'here') return <img src={CHARACTER.rabbit.still} alt="오늘 받는 코스" className="h-9 w-9 object-contain" />;
  if (p.state === 'going') return <img src="/img/pin.png" alt="배우는 중" className="h-7 w-7 object-contain" />;
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" role="img" aria-label="다음 추천">
      <path d="M12 5v14M5 12h14" stroke="#858691" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
  /* eslint-enable @next/next/no-img-element */
}

export default async function MapPage() {
  const user = await currentUser();
  const d = await mapData(user);
  const ch = CHARACTER[d.stage.key];
  return (
    <Screen>
      <AppHeader layout="large" title="내 학습" />
      <Main className="pb-10 pt-2">
        <section className="mt-4 flex flex-col gap-4 rounded-2xl bg-shape-depth1 p-5">
          <div className="flex items-center gap-4">
            <div className="flex w-full flex-col gap-1">
              <span className="text-sm font-semibold text-txt-black-tertiary">{ch.name} 단계</span>
              <span className="text-2xl font-bold tracking-[-1px]">{d.learnedCount}개 주제 다 배움</span>
              <span className="text-sm text-txt-black-secondary">
                배우는 중 {d.going}개 · 다음 추천 {d.fog}개
              </span>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={ch.full} alt={`${ch.name} 캐릭터`} className="-my-3 -mr-2 h-[120px] w-[120px] flex-shrink-0 object-contain" />
          </div>
          {d.stage.next ? (
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Progress value={d.learnedCount / d.stage.next.min} track="bg-shape-white" />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={CHARACTER.cat.still} alt="다음 단계 고양이" className="h-8 w-8 flex-shrink-0 object-contain opacity-50 grayscale" />
              </div>
              <p className="text-sm font-semibold">
                주제 {d.stage.next.left}개만 더 다 배우면 <span className="text-txt-point">{d.stage.next.name}</span>로 성장해요
              </p>
              <p className="text-sm text-txt-black-secondary">코스의 Drop을 70% 넘게 읽고, 읽은 Drop의 절반 넘게 ‘이해했어요’를 누르면 다 배운 주제가 돼요.</p>
            </div>
          ) : null}
        </section>

        <section className="mt-10 flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-lg font-semibold">분야별 학습</h2>
            <p className="text-sm text-txt-black-secondary">
              + 표시는 배운 주제와 이어지는 다음 추천 주제예요. 누르면 새 코스를 만들어요.
              {d.usage ? ` (Plus · 새 코스 ${d.usage.coursesLeft}개 남음)` : ' 무료는 한 번에 코스 1개를 배울 수 있어요.'}
            </p>
          </div>
          {d.regions.length === 0 ? (
            <p className="rounded-2xl bg-shape-depth1 p-5 text-sm text-txt-black-secondary">첫 코스를 만들면 여기에 배운 주제가 쌓여요.</p>
          ) : null}
          {d.regions.map(r => (
            <article key={r.name} className="flex flex-col gap-4 rounded-[20px] border border-border-div p-5">
              <div className="flex flex-col gap-2">
                <div className="flex items-baseline justify-between gap-3">
                  <h3 className="text-lg font-semibold">{r.name}</h3>
                  <span className={r.done ? 'flex-shrink-0 text-sm font-bold text-txt-point' : 'flex-shrink-0 text-sm font-bold text-txt-black-tertiary'}>
                    {r.done} / {r.places.length}개 배움
                  </span>
                </div>
                <Progress value={r.done / r.places.length} height={6} />
              </div>
              <ul className="flex flex-col gap-2">
                {r.places.map(p => (
                  <li key={p.name}>
                    <Link
                      href={p.href}
                      className={
                        p.state === 'fog'
                          ? 'flex min-h-14 items-center gap-3 rounded-2xl bg-shape-white py-2 pl-2 pr-4'
                          : 'flex min-h-14 items-center gap-3 rounded-2xl bg-shape-depth1 py-2 pl-2 pr-4'
                      }
                    >
                      <span
                        className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-shape-white"
                        style={{ border: p.state === 'fog' ? '2px dashed #B4B5C1' : undefined }}
                      >
                        <Dot p={p} />
                      </span>
                      <span className="flex min-w-0 flex-1 flex-col">
                        <span className={p.state === 'fog' ? 'text-base text-txt-black-secondary' : 'text-base font-bold'}>{p.name}</span>
                        <span
                          className={
                            p.state === 'done' ? 'text-sm text-txt-point' : p.state === 'fog' ? 'text-sm text-txt-black-tertiary' : 'text-sm text-txt-black-secondary'
                          }
                        >
                          {p.status}
                        </span>
                      </span>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="m9 5 7 7-7 7" stroke="#B4B5C1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
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
