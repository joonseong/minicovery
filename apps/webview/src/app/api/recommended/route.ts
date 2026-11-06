import { recommendedCourses } from '@/lib/learning';
import { currentUser } from '@/lib/session';

/** 다른 사람들이 만든 코스 다음 묶음 (새 코스 화면에서 아래로 내릴 때). ?offset=20 */
export async function GET(request: Request) {
  const user = await currentUser();
  const offset = Math.max(0, Number(new URL(request.url).searchParams.get('offset')) || 0);
  return Response.json(await recommendedCourses(user, offset));
}
