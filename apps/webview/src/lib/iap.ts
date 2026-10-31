import { X509Certificate } from 'node:crypto';

import { SignJWT, compactVerify, decodeJwt, decodeProtectedHeader, importPKCS8 } from 'jose';

import { PLUS_PRODUCT_ID } from './constants';
import { track } from './service';
import { getStore } from './store';
import type { User } from './types';

/**
 * App Store 구독 확인 (App Store Server API).
 * 앱이 넘긴 거래 JWS는 거래 ID를 읽는 데만 쓰고, 실제 내용은 Apple 서버에서 다시 받아 믿는다.
 * 환경 변수: APPLE_IAP_KEY_ID, APPLE_IAP_ISSUER_ID, APPLE_IAP_PRIVATE_KEY(.p8 내용), APPLE_BUNDLE_ID,
 * IAP_ALLOW_SANDBOX(비우면 허용. 출시 뒤 'false'로 바꾸면 TestFlight·샌드박스 거래가 운영 Plus를 켜지 못한다)
 */

const BUNDLE_ID = process.env.APPLE_BUNDLE_ID ?? 'com.minicovery.app';
const HOSTS = ['https://api.storekit.itunes.apple.com', 'https://api.storekit-sandbox.itunes.apple.com'];

/** Apple Root CA - G3 (https://www.apple.com/certificateauthority/AppleRootCA-G3.cer). 알림 서명 인증서 체인의 뿌리 */
const APPLE_ROOT_CA_G3 = `-----BEGIN CERTIFICATE-----
MIICQzCCAcmgAwIBAgIILcX8iNLFS5UwCgYIKoZIzj0EAwMwZzEbMBkGA1UEAwwS
QXBwbGUgUm9vdCBDQSAtIEczMSYwJAYDVQQLDB1BcHBsZSBDZXJ0aWZpY2F0aW9u
IEF1dGhvcml0eTETMBEGA1UECgwKQXBwbGUgSW5jLjELMAkGA1UEBhMCVVMwHhcN
MTQwNDMwMTgxOTA2WhcNMzkwNDMwMTgxOTA2WjBnMRswGQYDVQQDDBJBcHBsZSBS
b290IENBIC0gRzMxJjAkBgNVBAsMHUFwcGxlIENlcnRpZmljYXRpb24gQXV0aG9y
aXR5MRMwEQYDVQQKDApBcHBsZSBJbmMuMQswCQYDVQQGEwJVUzB2MBAGByqGSM49
AgEGBSuBBAAiA2IABJjpLz1AcqTtkyJygRMc3RCV8cWjTnHcFBbZDuWmBSp3ZHtf
TjjTuxxEtX/1H7YyYl3J6YRbTzBPEVoA/VhYDKX1DyxNB0cTddqXl5dvMVztK517
IDvYuVTZXpmkOlEKMaNCMEAwHQYDVR0OBBYEFLuw3qFYM4iapIqZ3r6966/ayySr
MA8GA1UdEwEB/wQFMAMBAf8wDgYDVR0PAQH/BAQDAgEGMAoGCCqGSM49BAMDA2gA
MGUCMQCD6cHEFl4aXTQY2e3v9GwOAEZLuN+yRhHFD/3meoyhpmvOwgPUnPWTxnS4
at+qIxUCMG1mihDK1A3UT82NQz60imOlM27jbdoXt2QfyFMm+YhidDkLF1vLUagM
6BgD56KyKA==
-----END CERTIFICATE-----`;

/** Apple 서명 인증서를 구분하는 확장 OID (DER 인코딩). leaf: 영수증 서명 1.2.840.113635.100.6.11.1, 중간: WWDR 1.2.840.113635.100.6.2.1 */
const OID_RECEIPT_SIGNING = Buffer.from('060a2a864886f76364060b01', 'hex');
const OID_WWDR_INTERMEDIATE = Buffer.from('060a2a864886f76364060201', 'hex');

/** 만료 뒤에도 Plus로 봐주는 시간 (service.isPlus와 같은 값). 이 시간이 지나 다시 구독하면 혜택 한 달 창을 새로 잡는다 */
const EXPIRY_SLACK_MS = 6 * 3600_000;

interface AppleTransaction {
  transactionId: string;
  originalTransactionId: string;
  bundleId: string;
  productId: string;
  /** Apple 시각은 모두 ms epoch */
  purchaseDate: number;
  originalPurchaseDate?: number;
  expiresDate?: number;
  revocationDate?: number;
  appAccountToken?: string;
  /** 1: 도입 혜택(첫 구독 무료 체험 등) */
  offerType?: number;
  environment: 'Production' | 'Sandbox';
}

interface AppleRenewalInfo {
  productId?: string;
  autoRenewStatus?: number;
  gracePeriodExpiresDate?: number;
}

/** Apple에서 다시 받은 거래와, 구독 최신 상태(조회에 실패하면 비어 있다) */
interface Lookup {
  tx: AppleTransaction;
  latest?: AppleTransaction;
  renewal?: AppleRenewalInfo;
}

interface NotificationPayload {
  notificationType?: string;
  subtype?: string;
  notificationUUID?: string;
  data?: { signedTransactionInfo?: string };
}

/** 알림 서명이 맞지 않을 때. 라우트는 401로 돌려준다 */
export class IapSignatureError extends Error {}

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
async function fetchTransaction(token: string, transactionId: string): Promise<{ tx: AppleTransaction; host: string } | null> {
  for (const host of HOSTS) {
    const res = await fetch(`${host}/inApps/v1/transactions/${encodeURIComponent(transactionId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404 || (res.status === 401 && host === HOSTS[0])) continue;
    if (!res.ok) throw new Error(`app store ${res.status}`);
    const { signedTransactionInfo } = (await res.json()) as { signedTransactionInfo: string };
    return { tx: decodeJwt(signedTransactionInfo) as unknown as AppleTransaction, host };
  }
  return null;
}

/** 구독 최신 상태(자동 갱신 여부·유예 기간·최신 만료일). 거래를 찾은 호스트에서 읽고, 실패하면 거래 정보만으로 간다 */
async function fetchSubscription(token: string, host: string, transactionId: string): Promise<Pick<Lookup, 'latest' | 'renewal'>> {
  try {
    const res = await fetch(`${host}/inApps/v1/subscriptions/${encodeURIComponent(transactionId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return {};
    const { data } = (await res.json()) as {
      data?: { lastTransactions?: { signedTransactionInfo?: string; signedRenewalInfo?: string }[] }[];
    };
    for (const group of data ?? []) {
      for (const last of group.lastTransactions ?? []) {
        const latest = last.signedTransactionInfo ? (decodeJwt(last.signedTransactionInfo) as unknown as AppleTransaction) : undefined;
        const renewal = last.signedRenewalInfo ? (decodeJwt(last.signedRenewalInfo) as unknown as AppleRenewalInfo) : undefined;
        if (latest?.productId === PLUS_PRODUCT_ID || renewal?.productId === PLUS_PRODUCT_ID) return { latest, renewal };
      }
    }
    return {};
  } catch (error) {
    console.error('iap subscription', error);
    return {};
  }
}

async function lookupTransaction(transactionId: string): Promise<Lookup | null> {
  const token = await apiToken();
  const found = await fetchTransaction(token, transactionId);
  if (!found) return null;
  return { tx: found.tx, ...(await fetchSubscription(token, found.host, transactionId)) };
}

function transactionIdOf(jws: string): string | null {
  try {
    const id = decodeJwt(jws).transactionId;
    return typeof id === 'string' && /^\d+$/.test(id) ? id : null;
  } catch {
    return null;
  }
}

/** 만료일은 뒤로만 간다 (오래된 거래가 나중에 와도 줄이지 않음). 환불·해지는 revocationDate가 있으니 그대로 반영 */
function laterExpiry(current: string | undefined, tx: AppleTransaction | undefined): string | undefined {
  if (!tx?.expiresDate) return current;
  if (tx.revocationDate) return new Date(tx.revocationDate).toISOString();
  const next = new Date(tx.expiresDate).toISOString();
  return current && next < current ? current : next;
}

/**
 * 거래를 사용자에게 반영한다. 같은 구독(원거래)을 가진 다른 사용자가 있으면 그쪽은 풀고 지금 사용자에게 붙인다
 * (재설치 후 구매 복원, 기기 임시 계정에서 산 뒤 가입 등). 단, 다른 가입 계정이 산 구독(appAccountToken이 그 계정)은 가져가지 못한다
 */
async function applyTransaction(user: User, { tx, latest, renewal }: Lookup) {
  if (tx.bundleId !== BUNDLE_ID || tx.productId !== PLUS_PRODUCT_ID || !tx.expiresDate) return false;
  const store = getStore();
  // 출시 뒤 IAP_ALLOW_SANDBOX=false로 두면 TestFlight·샌드박스 구독이 운영 Plus를 켜지 못한다 (심사·TestFlight 동안은 허용)
  if (tx.environment === 'Sandbox' && process.env.IAP_ALLOW_SANDBOX === 'false') {
    await track(user.id, 'plus_sandbox_rejected', { transactionId: tx.transactionId });
    return false;
  }
  const owner = await store.findUserByPlusTx(tx.originalTransactionId);
  if (owner && owner.id !== user.id) {
    if (!owner.anon && tx.appAccountToken && tx.appAccountToken !== user.id) {
      await track(user.id, 'plus_relink_denied', { ownerId: owner.id, transactionId: tx.transactionId });
      return false;
    }
    owner.plusExpiresAt = undefined;
    owner.plusOriginalTxId = undefined;
    owner.plusGraceUntil = undefined;
    owner.plusAutoRenew = undefined;
    await store.saveUser(owner);
  }

  const now = Date.now();
  const started = !user.plusExpiresAt;
  const lapsed = user.plusExpiresAt ? Date.parse(user.plusExpiresAt) + EXPIRY_SLACK_MS < now : false;
  let expiresAt = laterExpiry(user.plusExpiresAt, tx);
  if (latest?.bundleId === BUNDLE_ID && latest.productId === PLUS_PRODUCT_ID) expiresAt = laterExpiry(expiresAt, latest);

  // 혜택 한 달 창의 기준일(대표 정책: 구독 시작일부터 한 달). 만료된 뒤 다시 구독하면 새 구매일로 다시 잡는다
  if (!user.plusSince) user.plusSince = new Date(tx.originalPurchaseDate ?? tx.purchaseDate ?? now).toISOString();
  else if (lapsed && expiresAt && Date.parse(expiresAt) > now) user.plusSince = new Date(tx.purchaseDate ?? now).toISOString();

  user.plusExpiresAt = expiresAt;
  user.plusOriginalTxId = tx.originalTransactionId;
  user.plusEnv = tx.environment;
  if (renewal) {
    user.plusAutoRenew = renewal.autoRenewStatus === 1;
    user.plusGraceUntil = renewal.gracePeriodExpiresDate ? new Date(renewal.gracePeriodExpiresDate).toISOString() : undefined;
  }
  await store.saveUser(user);
  if (started) await track(user.id, 'plus_started', { env: tx.environment, transactionId: tx.transactionId, trial: tx.offerType === 1 });
  return true;
}

/** 앱에서 결제·복원·실행 시 동기화로 넘어온 거래들을 확인해 반영한다 (클라이언트 JWS 내용은 믿지 않는다) */
export async function verifyTransactions(user: User, jwsList: string[]) {
  let applied = 0;
  for (const jws of jwsList.slice(0, 10)) {
    const id = transactionIdOf(jws);
    const lookup = id ? await lookupTransaction(id) : null;
    if (lookup && (await applyTransaction(user, lookup))) applied++;
  }
  return applied;
}

/** x5c 체인(leaf → 중간 → 루트)이 내장한 Apple Root CA - G3까지 이어지고 Apple 영수증 서명용 인증서인지 확인한다 */
function verifyAppleChain(x5c: string[]): X509Certificate {
  const root = new X509Certificate(APPLE_ROOT_CA_G3);
  const certs = x5c.map(b64 => new X509Certificate(new Uint8Array(Buffer.from(b64, 'base64'))));
  const [leaf, intermediate] = certs;
  if (!leaf || !intermediate) throw new IapSignatureError('x5c length');
  if (!leaf.raw.includes(OID_RECEIPT_SIGNING) || !intermediate.raw.includes(OID_WWDR_INTERMEDIATE)) throw new IapSignatureError('x5c purpose');
  const now = Date.now();
  const issuedBy = (cert: X509Certificate, issuer: X509Certificate) => cert.checkIssued(issuer) && cert.verify(issuer.publicKey);
  certs.forEach((cert, i) => {
    if (Date.parse(cert.validFrom) > now || Date.parse(cert.validTo) < now) throw new IapSignatureError('x5c expired');
    const next = certs[i + 1];
    // 체인 끝은 내장 루트 자신이거나 루트가 발급한 것이어야 한다
    const ok = next ? issuedBy(cert, next) : cert.fingerprint256 === root.fingerprint256 || issuedBy(cert, root);
    if (!ok) throw new IapSignatureError('x5c chain');
  });
  return leaf;
}

/** 알림 JWS 서명 확인: x5c 체인이 Apple 루트까지 이어지고, leaf 공개키로 ES256 서명이 맞아야 한다 */
async function verifySignedPayload(jws: string): Promise<NotificationPayload> {
  let leaf: X509Certificate;
  try {
    const header = decodeProtectedHeader(jws);
    if (header.alg !== 'ES256' || !header.x5c?.length) throw new IapSignatureError('header');
    leaf = verifyAppleChain(header.x5c);
  } catch (error) {
    throw error instanceof IapSignatureError ? error : new IapSignatureError('x5c parse');
  }
  try {
    const { payload } = await compactVerify(jws, leaf.publicKey, { algorithms: ['ES256'] });
    return JSON.parse(Buffer.from(payload).toString('utf8')) as NotificationPayload;
  } catch {
    throw new IapSignatureError('signature');
  }
}

/**
 * App Store Server Notifications V2: 갱신·해지·환불 등. 서명을 확인한 뒤에도 거래 ID만 읽고 Apple에서 다시 확인한다.
 * 같은 notificationUUID가 7일 안에 또 오면(응답 지연으로 Apple이 다시 보냄) 처리하지 않고 200만 돌려준다
 */
export async function handleNotification(signedPayload: string) {
  const payload = await verifySignedPayload(signedPayload);
  const { notificationType: type, subtype, notificationUUID: uuid } = payload;
  const store = getStore();
  if (uuid) {
    const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
    const seen = (await store.listEventsByName('iap_notification', since)).some(e => e.props?.uuid === uuid);
    if (seen) return { type, applied: false, duplicate: true };
  }
  // TEST 알림은 data가 없다 → 기록만 남기고 200
  const id = payload.data?.signedTransactionInfo ? transactionIdOf(payload.data.signedTransactionInfo) : null;
  const lookup = id ? await lookupTransaction(id) : null;
  const owner = lookup
    ? ((await store.findUserByPlusTx(lookup.tx.originalTransactionId)) ??
      (lookup.tx.appAccountToken ? await store.getUser(lookup.tx.appAccountToken) : null))
    : null;
  const applied = owner && lookup ? await applyTransaction(owner, lookup) : false;
  // 처리가 끝난 뒤에 남긴다 — 중간에 실패하면(500) Apple이 다시 보내고 그때 처리된다
  await track(owner?.id ?? 'system', 'iap_notification', { uuid, type, subtype, applied });
  return { type, applied };
}

/* ---------- 어드민: App Store 테스트 알림 ---------- */

export type IapEnv = 'production' | 'sandbox';
const hostOf = (env: IapEnv) => (env === 'production' ? HOSTS[0] : HOSTS[1]);

/**
 * Apple에 테스트 알림을 요청한다 (App Store Connect에는 버튼이 없고 API로만 가능).
 * Apple이 App Store Connect에 적힌 서버 URL(/api/iap/notify)로 TEST 알림을 보내므로 서명 검증·배포 상태를 확인할 수 있다.
 * 출시 전에는 운영 API가 401이라 샌드박스로 넘어간다 (fetchTransaction과 같은 규칙)
 */
export async function requestTestNotification(): Promise<{ env: IapEnv; token: string } | null> {
  const jwt = await apiToken();
  for (const env of ['production', 'sandbox'] as IapEnv[]) {
    const res = await fetch(`${hostOf(env)}/inApps/v1/notifications/test`, { method: 'POST', headers: { Authorization: `Bearer ${jwt}` } });
    if (res.status === 404 || (res.status === 401 && env === 'production')) continue;
    if (!res.ok) throw new Error(`app store ${res.status}`);
    const { testNotificationToken } = (await res.json()) as { testNotificationToken: string };
    return { env, token: testNotificationToken };
  }
  return null;
}

export interface TestNotificationAttempt {
  attemptDate: number;
  /** SUCCESS | TIMED_OUT | SSL_ISSUE | NO_RESPONSE | UNSUCCESSFUL_HTTP_RESPONSE_CODE | … */
  sendAttemptResult: string;
}

/** 테스트 알림을 우리 서버에 보낸 시도와 결과. Apple이 보내기까지 몇 초 걸려 처음엔 비어 있을 수 있다 */
export async function testNotificationStatus(env: IapEnv, token: string): Promise<TestNotificationAttempt[]> {
  const jwt = await apiToken();
  const res = await fetch(`${hostOf(env)}/inApps/v1/notifications/test/${encodeURIComponent(token)}`, {
    headers: { Authorization: `Bearer ${jwt}` },
  });
  if (!res.ok) throw new Error(`app store ${res.status}`);
  const data = (await res.json()) as { sendAttempts?: TestNotificationAttempt[] };
  return data.sendAttempts ?? [];
}
