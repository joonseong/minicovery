import { ImageResponse } from 'next/og';

import { shareCard } from '@/lib/learning';

export const runtime = 'nodejs';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

const FONT = 'https://cdn.jsdelivr.net/npm/pretendard@1.3.9/dist/public/static/Pretendard-Bold.otf';

/** 카톡·인스타 링크 미리보기 이미지 (완주 공유 카드) */
export default async function Image({ params }: { params: { shareId: string } }) {
  const card = await shareCard(params.shareId);
  const font = await fetch(FONT).then(r => r.arrayBuffer());
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', background: '#20967A', color: '#FFFFFF', padding: 64, fontFamily: 'Pretendard' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 30, color: '#EEEEF9' }}>{card ? `코스 완주 · ${card.total}편` : '코스 완주'}</div>
          <div style={{ marginTop: 16, fontSize: 60, lineHeight: 1.25 }}>{card?.title ?? '미니커버리'}</div>
        </div>
        {card?.takeaway ? (
          <div style={{ display: 'flex', background: '#FFFFFF', color: '#151517', borderRadius: 28, padding: '28px 36px', fontSize: 36, lineHeight: 1.4 }}>{card.takeaway}</div>
        ) : null}
        <div style={{ fontSize: 30 }}>미니커버리 · 하루 한 편 교양</div>
      </div>
    ),
    { ...size, fonts: [{ name: 'Pretendard', data: font, weight: 700, style: 'normal' }] },
  );
}
