import { currentUser } from '@/lib/session';
import { AI_BUSY_MESSAGE, assertAiBudget, easyExplain } from '@/lib/service';

export const maxDuration = 60;

/** 조금 헷갈려요 → 같은 내용을 더 쉽게 (Drop당 한 번 만들고 저장). 하루 AI 예산을 넘으면 503 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  try {
    await assertAiBudget();
  } catch {
    return Response.json({ error: 'busy', message: AI_BUSY_MESSAGE }, { status: 503 });
  }
  const easy = await easyExplain(await currentUser(), params.id);
  return easy ? Response.json(easy) : Response.json({ error: 'failed' }, { status: 500 });
}
