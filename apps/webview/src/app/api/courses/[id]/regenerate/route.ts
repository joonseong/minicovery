import { currentUser } from '@/lib/session';
import { assertAiBudget, createCourse, ndjsonStream } from '@/lib/service';
import { getStore } from '@/lib/store';

export const maxDuration = 300;

/** 커리큘럼 재생성은 코스당 1회 (US-13). 지운 코스는 되살리지 않는다 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const user = await currentUser();
  const store = getStore();
  const course = await store.getCourse(params.id);
  if (!course || course.userId !== user.id || (course.status !== 'active' && course.status !== 'failed')) {
    return Response.json({ error: 'not found' }, { status: 404 });
  }
  if (course.regenUsed) return Response.json({ error: 'used' }, { status: 409 });
  const drops = await store.listDrops(course.id);
  if (drops.some(d => d.completedAt)) return Response.json({ error: 'started' }, { status: 409 });
  // 한 번뿐인 재생성을 예산 초과로 날리지 않게 먼저 확인한다
  try {
    await assertAiBudget();
  } catch {
    return Response.json({ error: 'busy' }, { status: 503 });
  }
  // 생성 시작 전에 저장해 동시 요청이 두 번 쓰지 못하게
  course.regenUsed = true;
  await store.saveCourse(course);
  return ndjsonStream(send => createCourse(user, course, send, course));
}
