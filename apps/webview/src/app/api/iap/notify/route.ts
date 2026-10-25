import { handleNotification } from '@/lib/iap';

/** App Store Server Notifications V2 수신 주소 (App Store Connect > 앱 정보에 등록) */
export async function POST(request: Request) {
  const { signedPayload } = (await request.json()) as { signedPayload?: string };
  if (!signedPayload) return Response.json({ error: 'payload' }, { status: 400 });
  try {
    return Response.json(await handleNotification(signedPayload));
  } catch (error) {
    // 500을 돌려주면 Apple이 다시 보낸다
    console.error('iap notify', error);
    return Response.json({ error: 'notify' }, { status: 500 });
  }
}
