import { track } from '@/lib/service';
import { currentUser } from '@/lib/session';

/** 앱을 연 날 (하루 한 번, VisitPing). 어드민 대시보드의 활동·재방문율에 쓴다 */
export async function POST() {
  await track((await currentUser()).id, 'visit');
  return Response.json({ ok: true });
}
