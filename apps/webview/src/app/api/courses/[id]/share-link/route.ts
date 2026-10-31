import { shareLink } from '@/lib/learning';
import { currentUser } from '@/lib/session';

/** 완주 공유 카드 링크 (/c/{shareId}) */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const id = await shareLink(await currentUser(), params.id);
  if (!id) return Response.json({ error: 'not completed' }, { status: 400 });
  return Response.json({ url: `${new URL(request.url).origin}/c/${id}` });
}
