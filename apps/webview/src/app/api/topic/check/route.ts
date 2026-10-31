import { TOPIC_MAX_LENGTH } from '@/lib/constants';
import { currentUser } from '@/lib/session';
import { approveTopics, checkTopic } from '@/lib/service';

/**
 * 주제 검사. 통과(ok)한 주제와, 넓은 주제(broad)를 좁힌 제안은 24시간 동안 user.approvedTopics에 남겨
 * /api/courses가 그 주제만 받게 한다 (검사를 건너뛴 직접 호출 차단)
 */
export async function POST(request: Request) {
  const { input } = (await request.json().catch(() => ({}))) as { input?: string };
  const text = typeof input === 'string' ? input.trim() : '';
  if (!text) return Response.json({ error: 'empty' }, { status: 400 });
  if (text.length > TOPIC_MAX_LENGTH) return Response.json({ error: 'invalid' }, { status: 400 });
  const user = await currentUser();
  const result = await checkTopic(user, text);
  if (result.status === 'ok') {
    await approveTopics(user, [{ topic: result.topic, category: result.category, taskType: result.taskType }]);
  } else if (result.status === 'broad') {
    // 좁힌 제안을 고르면 다시 검사하지만, 또 넓다고 나오면 화면이 그 제안을 그대로 쓴다 (BroadScreen)
    await approveTopics(
      user,
      result.suggestions.map(topic => ({ topic, category: result.category, taskType: result.taskType })),
    );
  }
  return Response.json(result);
}
