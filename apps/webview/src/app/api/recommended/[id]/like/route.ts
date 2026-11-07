import { likeShared } from '@/lib/learning';
import { currentUser } from '@/lib/session';

/** 추천 코스 좋아요 켜고 끄기 { on } */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { on } = (await request.json().catch(() => ({}))) as { on?: boolean };
  if (typeof on !== 'boolean') return Response.json({ error: 'on' }, { status: 400 });
  const ok = await likeShared(await currentUser(), params.id, on);
  return ok ? Response.json({ ok: true }) : Response.json({ error: 'not found' }, { status: 404 });
}
