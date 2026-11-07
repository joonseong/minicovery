import { reportSharedDrop } from '@/lib/learning';
import { currentUser } from '@/lib/session';
import type { Report } from '@/lib/types';

const REASONS: NonNullable<Report['reason']>[] = ['wrong', 'unclear', 'inappropriate'];

/** 열람한 추천 코스 Drop 신고 { n, reason? } */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { n, reason } = (await request.json().catch(() => ({}))) as { n?: number; reason?: Report['reason'] };
  if (!Number.isInteger(n) || n! < 1) return Response.json({ error: 'n' }, { status: 400 });
  const ok = await reportSharedDrop(await currentUser(), params.id, n!, reason && REASONS.includes(reason) ? reason : undefined);
  return ok ? Response.json({ ok: true }) : Response.json({ error: 'not found' }, { status: 404 });
}
