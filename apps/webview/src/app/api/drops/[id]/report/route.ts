import { currentUser } from '@/lib/session';
import { reportDrop } from '@/lib/service';
import type { Report } from '@/lib/types';

const REASONS: NonNullable<Report['reason']>[] = ['wrong', 'unclear', 'inappropriate'];

/** 오류 신고 { reason?: 'wrong' | 'unclear' | 'inappropriate' }. 같은 Drop을 다시 신고하면 그냥 200 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { reason } = (await request.json().catch(() => ({}))) as { reason?: Report['reason'] };
  const ok = await reportDrop(await currentUser(), params.id, reason && REASONS.includes(reason) ? reason : undefined);
  return ok ? Response.json({ ok: true }) : Response.json({ error: 'not found' }, { status: 404 });
}
