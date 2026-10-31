import { currentUser } from '@/lib/session';
import { completeDrop } from '@/lib/service';
import type { UnderstandingSignal } from '@/lib/types';

/** Drop 완료. 내 Drop이 아니면 404, 아직 열 수 없는 Drop이면 409 locked (이미 완료한 Drop은 그대로 결과를 돌려준다) */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { signal } = (await request.json().catch(() => ({}))) as { signal?: UnderstandingSignal };
  if (signal !== 'understood' && signal !== 'confused') return Response.json({ error: 'signal' }, { status: 400 });
  const result = await completeDrop(await currentUser(), params.id, signal);
  if (!result) return Response.json({ error: 'not found' }, { status: 404 });
  if ('error' in result) return Response.json(result, { status: 409 });
  return Response.json(result);
}
