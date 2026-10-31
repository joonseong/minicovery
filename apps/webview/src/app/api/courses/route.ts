import { CATEGORIES, TOPIC_MAX_LENGTH } from '@/lib/constants';
import { currentUser } from '@/lib/session';
import { anonCourseAllowed, approvedTopic, courseQuota, createCourse, deleteFreeCourses, isPlus, ndjsonStream } from '@/lib/service';
import type { Level, TaskType } from '@/lib/types';

export const maxDuration = 300;

const LEVELS: Level[] = ['beginner', 'some', 'advanced'];
const TASK_TYPES: TaskType[] = ['work', 'hobby'];

/**
 * 코스 만들기. 무료는 진행 중 1개, Plus는 구독 한 달 3개, 바꾸기·새 코스는 하루 1번.
 * 무료 사용자가 replace=true로 보내면 지금 코스를 지우고 새로 만든다 (학습 기록은 남음).
 * 주제는 /api/topic/check를 통과한 것만 받는다 (400 unchecked). 익명은 같은 IP에서 하루 5명까지 (429 too_many)
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Partial<Record<'topic' | 'level' | 'category' | 'taskType', unknown>> & { replace?: unknown };
  const topic = typeof body.topic === 'string' ? body.topic.trim() : '';
  const level = body.level as Level;
  if (!topic || topic.length > TOPIC_MAX_LENGTH || !LEVELS.includes(level) || !TASK_TYPES.includes(body.taskType as TaskType)) {
    return Response.json({ error: 'invalid' }, { status: 400 });
  }

  const user = await currentUser();
  // 분류·종류는 검사를 통과할 때 받은 값을 믿는다 (body와 다르면 승인 값). 목록에 없는 분류는 '기타'
  const approved = approvedTopic(user, topic);
  if (!approved) return Response.json({ error: 'unchecked' }, { status: 400 });
  const category = (CATEGORIES as readonly string[]).includes(approved.category) ? approved.category : '기타';
  const taskType = TASK_TYPES.includes(approved.taskType) ? approved.taskType : (body.taskType as TaskType);

  if (!(await anonCourseAllowed(user, request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()))) {
    return Response.json({ error: 'too_many' }, { status: 429 });
  }
  const quota = await courseQuota(user);
  if (!quota.ok) {
    if (quota.reason === 'free' && body.replace === true && !isPlus(user)) await deleteFreeCourses(user);
    else return Response.json({ reason: quota.reason }, { status: 402 });
  }
  return ndjsonStream(send => createCourse(user, { topic, level, category, taskType }, send));
}
