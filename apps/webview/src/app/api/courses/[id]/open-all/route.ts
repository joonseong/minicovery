import { openAllCourse } from '@/lib/service';
import { currentUser } from '@/lib/session';

/** Plus 전체 열기: 이 코스는 하루 한 편 제한 없이 읽는다 (한 달에 한 코스) */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const ok = await openAllCourse(await currentUser(), params.id);
  return Response.json({ ok }, { status: ok ? 200 : 400 });
}
