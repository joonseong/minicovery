import { shareLink } from '@/lib/learning';
import { currentUser } from '@/lib/session';

/** 완주 공유 카드 링크 (/c/{shareId}). 앱 웹뷰에서는 요청 origin이 내부 주소일 수 있어 공개 주소를 환경 변수로 둔다 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const id = await shareLink(await currentUser(), params.id);
  if (!id) return Response.json({ error: 'not completed' }, { status: 400 });
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(request.url).origin;
  return Response.json({ url: `${origin.replace(/\/$/, '')}/c/${id}` });
}
