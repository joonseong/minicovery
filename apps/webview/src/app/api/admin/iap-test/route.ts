import { isAdminRequest } from '@/lib/auth';
import { type IapEnv, requestTestNotification, testNotificationStatus } from '@/lib/iap';

/**
 * 어드민: App Store 테스트 알림. POST로 요청하고 GET ?env=&token= 으로 전송 결과를 본다.
 * 쿠키(mc_admin) 또는 x-admin-token 헤더로 확인
 */
export async function POST(request: Request) {
  if (!isAdminRequest(request)) return new Response('not found', { status: 404 });
  try {
    const r = await requestTestNotification();
    if (!r) return Response.json({ error: 'unavailable' }, { status: 502 });
    return Response.json(r);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'failed' }, { status: 502 });
  }
}

export async function GET(request: Request) {
  if (!isAdminRequest(request)) return new Response('not found', { status: 404 });
  const url = new URL(request.url);
  const env = url.searchParams.get('env');
  const token = url.searchParams.get('token');
  if ((env !== 'production' && env !== 'sandbox') || !token) return Response.json({ error: 'invalid' }, { status: 400 });
  try {
    return Response.json({ attempts: await testNotificationStatus(env as IapEnv, token) });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'failed' }, { status: 502 });
  }
}
