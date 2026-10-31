import { NativeEventEmitter, NativeModules, Platform } from 'react-native';

/** ios/Minicovery/MinicoveryIAP.swift (StoreKit 2). 거래 확인은 서버가 한다 */
type IapResult<T> = T & { error?: 'canceled' | 'pending' | 'not_found' | 'failed' };

const native = Platform.OS === 'ios' ? NativeModules.MinicoveryIAP : null;

/** Swift가 Transaction.updates 거래를 알리는 이벤트 이름 (MinicoveryIAP.transactionEvent와 같아야 한다). body는 { jws } */
const TRANSACTION_EVENT = 'minicoveryTransaction';

export const iapAvailable = () => Boolean(native);

/** 첫 구독 무료 체험을 받을 수 있는지 (Apple이 계정 기준으로 판단). price는 표시용 현지 가격 (예: ₩3,900) */
export async function trialEligible(productId: string): Promise<{ eligible: boolean; days?: number; price?: string }> {
  if (!native?.trialEligible) return { eligible: false };
  try {
    return await native.trialEligible(productId);
  } catch {
    return { eligible: false };
  }
}

/** App Store 리뷰 요청 (StoreKit). 완료 화면으로 넘어간 뒤 뜨도록 조금 기다린다 */
export function requestReview() {
  if (native?.requestReview) setTimeout(() => native.requestReview(), 1500);
}

export async function purchase(productId: string, accountToken: string): Promise<IapResult<{ jws?: string }>> {
  if (!native) return { error: 'failed' };
  try {
    return await native.purchase(productId, accountToken);
  } catch {
    return { error: 'failed' };
  }
}

/** 유효한 구독 거래 JWS 목록. sync=true면 App Store와 먼저 동기화 (구매 복원) */
export async function entitlements(sync: boolean): Promise<IapResult<{ jws?: string[] }>> {
  if (!native) return { error: 'failed' };
  try {
    return await native.currentEntitlements(sync);
  } catch {
    return { error: 'failed' };
  }
}

/** 자동 갱신·Ask to Buy 승인 등 앱 밖에서 완료된 거래의 JWS. 돌려주는 함수로 구독을 해제한다 */
export function onTransaction(listener: (jws: string) => void): () => void {
  if (!native) return () => {};
  const sub = new NativeEventEmitter(native).addListener(TRANSACTION_EVENT, (event: { jws?: unknown }) => {
    if (typeof event?.jws === 'string') listener(event.jws);
  });
  return () => sub.remove();
}
