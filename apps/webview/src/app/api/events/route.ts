import { currentUser } from '@/lib/session';
import { track } from '@/lib/service';

const ALLOWED = new Set(['app_open', 'push_opened', 'presub_card_view', 'notify_prompt_view', 'ttfd', 'drop_wait']);
/** props는 작은 숫자·id 정도만. 큰 덩어리는 저장소 낭비라 거절한다 */
const MAX_PROPS_BYTES = 1024;

export async function POST(request: Request) {
  const { name, props } = (await request.json().catch(() => ({}))) as { name?: string; props?: Record<string, unknown> };
  if (!name || !ALLOWED.has(name)) return Response.json({ error: 'name' }, { status: 400 });
  if (props !== undefined && (typeof props !== 'object' || props === null || Buffer.byteLength(JSON.stringify(props)) > MAX_PROPS_BYTES)) {
    return Response.json({ error: 'props' }, { status: 400 });
  }
  await track((await currentUser()).id, name, props);
  return Response.json({ ok: true });
}
