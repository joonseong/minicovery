import { currentUser } from '@/lib/session';
import { ensureDropImage } from '@/lib/service';
import { getStore } from '@/lib/store';

export const maxDuration = 60;

/** 글은 있는데 그림이 아직 없는 Drop: 열 때 그린다 (다른 곳에서 그리는 중이면 기다린다). 그림 주소나 null */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  const drop = await getStore().getDrop(params.id);
  if (!drop || drop.userId !== user.id) return Response.json({ error: 'not found' }, { status: 404 });
  return Response.json({ url: await ensureDropImage(drop.id, 40_000) });
}
