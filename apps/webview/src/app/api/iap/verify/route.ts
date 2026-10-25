import { verifyTransactions } from '@/lib/iap';
import { isPlus } from '@/lib/service';
import { currentUser } from '@/lib/session';

/** 앱이 넘긴 App Store 거래(JWS)를 확인해 Plus를 켠다. 결제 직후, 구매 복원, 앱 실행 시 동기화에서 부른다 */
export async function POST(request: Request) {
  const { jws } = (await request.json()) as { jws?: string | string[] };
  const list = (Array.isArray(jws) ? jws : jws ? [jws] : []).filter(j => typeof j === 'string');
  const user = await currentUser();
  try {
    const applied = await verifyTransactions(user, list);
    return Response.json({ applied, plus: isPlus(user) });
  } catch (error) {
    console.error('iap verify', error);
    // 설정 문제를 찾기 쉽게 원인 종류만 돌려준다 (키 값은 담지 않음)
    const message = error instanceof Error ? error.message : '';
    const reason = /^(APPLE_IAP_\* not set|app store \d+)$/.test(message) ? message : 'key';
    return Response.json({ error: 'verify', reason, plus: isPlus(user) }, { status: 502 });
  }
}
