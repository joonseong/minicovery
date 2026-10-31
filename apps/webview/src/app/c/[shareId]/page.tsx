import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';

import { shareCard } from '@/lib/learning';

export const dynamic = 'force-dynamic';

/** 완주 공유 페이지 (로그인 없이 열림). 만든 사람의 이름·계정 정보는 보여 주지 않는다 */
export async function generateMetadata({ params }: { params: { shareId: string } }): Promise<Metadata> {
  const card = await shareCard(params.shareId);
  if (!card) return {};
  const title = `${card.title} · ${card.total}편 완주`;
  return { title, description: card.takeaway, openGraph: { title, description: card.takeaway } };
}

export default async function SharePage({ params }: { params: { shareId: string } }) {
  const card = await shareCard(params.shareId);
  if (!card) notFound();
  // 앱 스토어 주소가 있을 때만 설치 안내를 붙인다
  const storeUrl = process.env.NEXT_PUBLIC_APP_STORE_URL;
  return (
    <main className="flex min-h-dvh flex-col bg-shape-brand px-7 pb-8 pt-12 text-txt-white-primary">
      <p className="text-sm font-bold text-txt-white-secondary">코스 완주 · {card.completedLabel}</p>
      <h1 className="mt-2 text-[28px] font-bold leading-9 tracking-[-1px]">{card.title}</h1>
      <p className="mt-2 text-base font-semibold text-txt-white-secondary">{card.total}편을 하루 한 편씩 다 읽었어요</p>
      <div className="flex flex-1 items-center justify-center py-8">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/img/rabbit.webp" alt="기뻐하는 토끼 캐릭터" className="h-[168px] w-[168px] object-contain" />
      </div>
      {card.takeaway ? (
        <div className="flex flex-col gap-2 rounded-2xl bg-shape-white p-5 text-txt-black-primary">
          <span className="text-sm font-bold text-txt-point">기억에 남는 한 문장</span>
          <span className="text-lg font-semibold">{card.takeaway}</span>
        </div>
      ) : null}
      <Link
        href={`/start?topic=${encodeURIComponent(card.topic)}&go=1`}
        className="mt-5 flex h-14 items-center justify-center rounded-full bg-shape-white text-base font-bold text-txt-point"
      >
        나도 ‘{card.topic}’ 코스 받기
      </Link>
      {storeUrl ? (
        <a href={storeUrl} className="mt-2 flex min-h-11 items-center justify-center text-sm font-semibold text-txt-white-primary underline">
          앱으로 매일 받기
        </a>
      ) : null}
      <p className="mt-3 text-center text-sm font-bold">미니커버리 · 하루 한 편 교양</p>
    </main>
  );
}
