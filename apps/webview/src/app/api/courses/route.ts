import { currentUser } from '@/lib/session';
import { courseQuota, createCourse, deleteFreeCourses, isPlus, ndjsonStream } from '@/lib/service';
import type { Level, TaskType } from '@/lib/types';

export const maxDuration = 300;

/**
 * 코스 만들기. 무료는 진행 중 1개, Plus는 구독 한 달 3개, 바꾸기·새 코스는 하루 1번.
 * 무료 사용자가 replace=true로 보내면 지금 코스를 지우고 새로 만든다 (학습 기록은 남음).
 */
export async function POST(request: Request) {
  const body = (await request.json()) as {
    topic: string;
    level: Level;
    category: string;
    taskType: TaskType;
    replace?: boolean;
  };
  const user = await currentUser();
  const quota = await courseQuota(user);
  if (!quota.ok) {
    if (quota.reason === 'free' && body.replace && !isPlus(user)) await deleteFreeCourses(user);
    else return Response.json({ reason: quota.reason }, { status: 402 });
  }
  return ndjsonStream(send => createCourse(user, body, send));
}
