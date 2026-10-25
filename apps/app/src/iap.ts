import { NativeModules, Platform } from 'react-native';

/** ios/Minicovery/MinicoveryIAP.swift (StoreKit 2). 거래 확인은 서버가 한다 */
type IapResult<T> = T & { error?: 'canceled' | 'pending' | 'not_found' | 'failed' };

const native = Platform.OS === 'ios' ? NativeModules.MinicoveryIAP : null;

export const iapAvailable = () => Boolean(native);

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
