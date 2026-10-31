import { IapSignatureError, handleNotification } from '@/lib/iap';

/** App Store Server Notifications V2 수신 주소 (App Store Connect > 앱 정보에 등록) */
export async function POST(request: Request) {
  const { signedPayload } = (await request.json().catch(() => ({}))) as { signedPayload?: unknown };
  if (typeof signedPayload !== 'string' || !signedPayload) return Response.json({ error: 'payload' }, { status: 400 });
  try {
    return Response.json(await handleNotification(signedPayload));
  } catch (error) {
    // 서명이 맞지 않으면 401 (Apple이 보낸 것이 아니다). 그 밖의 오류는 500 → Apple이 다시 보낸다
    if (error instanceof IapSignatureError) return Response.json({ error: 'signature' }, { status: 401 });
    console.error('iap notify', error);
    return Response.json({ error: 'notify' }, { status: 500 });
  }
}
