import { recordSharedRead } from '@/lib/learning';
import { currentUser } from '@/lib/session';

/** 추천 코스 Drop을 열람했음 { n } ('N명이 읽었어요'). 미리 불러오기는 세지 않게 화면이 뜬 뒤에 보낸다 */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { n } = (await request.json().catch(() => ({}))) as { n?: number };
  if (!Number.isInteger(n) || n! < 1) return Response.json({ error: 'n' }, { status: 400 });
  await recordSharedRead(await currentUser(), params.id, n!);
  return Response.json({ ok: true });
}
