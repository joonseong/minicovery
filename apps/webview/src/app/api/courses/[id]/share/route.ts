import { setCourseShared } from '@/lib/learning';
import { currentUser } from '@/lib/session';

/** 완주한 코스를 추천 코스로 내놓기 켜고 끄기 (이름 없이) */
export async function POST(request: Request, { params }: { params: { id: string } }) {
  const { on } = (await request.json()) as { on: boolean };
  const ok = await setCourseShared(await currentUser(), params.id, Boolean(on));
  return Response.json({ ok }, { status: ok ? 200 : 400 });
}
