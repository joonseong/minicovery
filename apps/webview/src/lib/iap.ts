import { SignJWT, decodeJwt, importPKCS8 } from 'jose';

import { PLUS_PRODUCT_ID } from './constants';
import { track } from './service';
import { getStore } from './store';
import type { User } from './types';
import { nowIso } from './util';

/**
 * App Store 구독 확인 (App Store Server API).
 * 앱이 넘긴 거래 JWS는 거래 ID를 읽는 데만 쓰고, 실제 내용은 Apple 서버에서 다시 받아 믿는다.
 * 환경 변수: APPLE_IAP_KEY_ID, APPLE_IAP_ISSUER_ID, APPLE_IAP_PRIVATE_KEY(.p8 내용), APPLE_BUNDLE_ID
 */

const BUNDLE_ID = process.env.APPLE_BUNDLE_ID ?? 'com.minicovery.app';
const HOSTS = ['https://api.storekit.itunes.apple.com', 'https://api.storekit-sandbox.itunes.apple.com'];

interface AppleTransaction {
  transactionId: string;
  originalTransactionId: string;
  bundleId: string;
  productId: string;
  purchaseDate: number;
  expiresDate?: number;
  revocationDate?: number;
  appAccountToken?: string;
  /** 1: 도입 혜택(첫 구독 무료 체험 등) */
  offerType?: number;
  environment: 'Production' | 'Sandbox';
}

async function apiToken() {
  const { APPLE_IAP_KEY_ID: kid, APPLE_IAP_ISSUER_ID: iss, APPLE_IAP_PRIVATE_KEY: pem } = process.env;
  if (!kid || !iss || !pem) throw new Error('APPLE_IAP_* not set');
  // Vercel에 줄바꿈이 \n 문자로 들어간 경우도 받아 준다
  const key = await importPKCS8(pem.replace(/\\n/g, '\n'), 'ES256');
  return new SignJWT({ bid: BUNDLE_ID })
    .setProtectedHeader({ alg: 'ES256', kid, typ: 'JWT' })
    .setIssuer(iss)
    .setIssuedAt()
    .setExpirationTime('20m')
    .setAudience('appstoreconnect-v1')
    .sign(key);
}

/**
 * 운영 서버에 없으면 샌드박스(TestFlight·심사)에서 찾는다.
 * 출시 전에는 운영 서버가 404 대신 401을 돌려주므로 운영 쪽 401도 넘어간다
 */
async function fetchTransaction(transactionId: string): Promise<AppleTransaction | null> {
  const token = await apiToken();
  for (const host of HOSTS) {
    const res = await fetch(`${host}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404 || (res.status === 401 && host === HOSTS[0])) continue;
    if (!res.ok) throw new Error(`app store ${res.status}`);
    const { signedTransactionInfo } = (await res.json()) as { signedTransactionInfo: string };
    return decodeJwt(signedTransactionInfo) as unknown as AppleTransaction;
  }
  return null;
}

function transactionIdOf(jws: string): string | null {
  try {
    const id = decodeJwt(jws).transactionId;
    return typeof id === 'string' && /^\d+$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** 같은 구독(원거래)을 가진 다른 사용자가 있으면 그쪽은 풀고 지금 사용자에게 붙인다 (재설치 후 구매 복원 등) */
async function applyTransaction(user: User, tx: AppleTransaction) {
  if (tx.bundleId !== BUNDLE_ID || tx.productId !== PLUS_PRODUCT_ID || !tx.expiresDate) return false;
  const store = getStore();
  for (const other of await store.listUsers()) {
    if (other.id !== user.id && other.plusOriginalTxId === tx.originalTransactionId) {
      other.plusExpiresAt = undefined;
      other.plusOriginalTxId = undefined;
      await store.saveUser(other);
    }
  }
  const expiresAt = new Date(tx.revocationDate ?? tx.expiresDate).toISOString();
  const started = !user.plusExpiresAt;
  user.plusSince ??= nowIso();
  user.plusExpiresAt = expiresAt;
  user.plusOriginalTxId = tx.originalTransactionId;
  await store.saveUser(user);
  if (started) await track(user.id, 'plus_started', { env: tx.environment, transactionId: tx.transactionId, trial: tx.offerType === 1 });
  return true;
}

/** 앱에서 결제·복원·실행 시 동기화로 넘어온 거래들을 확인해 반영한다 */
export async function verifyTransactions(user: User, jwsList: string[]) {
  let applied = 0;
  for (const jws of jwsList.slice(0, 10)) {
    const id = transactionIdOf(jws);
    const tx = id ? await fetchTransaction(id) : null;
    if (tx && (await applyTransaction(user, tx))) applied++;
  }
  return applied;
}

/** App Store Server Notifications V2: 갱신·해지·환불 등. 알림 내용도 거래 ID만 읽고 Apple에서 다시 확인한다 */
export async function handleNotification(signedPayload: string) {
  const payload = decodeJwt(signedPayload) as { notificationType?: string; data?: { signedTransactionInfo?: string } };
  const id = payload.data?.signedTransactionInfo ? transactionIdOf(payload.data.signedTransactionInfo) : null;
  if (!id) return { type: payload.notificationType, applied: false };
  const tx = await fetchTransaction(id);
  if (!tx) return { type: payload.notificationType, applied: false };
  const store = getStore();
  const owner =
    (await store.listUsers()).find(u => u.plusOriginalTxId === tx.originalTransactionId) ??
    (tx.appAccountToken ? await store.getUser(tx.appAccountToken) : null);
  if (!owner) return { type: payload.notificationType, applied: false };
  return { type: payload.notificationType, applied: await applyTransaction(owner, tx) };
}
