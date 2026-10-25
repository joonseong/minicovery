/**
 * 네이티브 껍데기(apps/app)와 주고받는 메시지.
 * 웹 → 앱: window.ReactNativeWebView.postMessage(JSON)
 * 앱 → 웹: window에 'minicovery-native' CustomEvent
 */
export type NativeRequest =
  | { type: 'requestPushPermission'; id: string }
  | { type: 'appleSignIn'; id: string }
  | { type: 'openSettings' }
  | { type: 'haptic' }
  | { type: 'requestReview' }
  | { type: 'iapTrial'; id: string; productId: string }
  | { type: 'iapPurchase'; id: string; productId: string; accountToken: string }
  | { type: 'iapRestore'; id: string }
  | { type: 'kakaoSignIn'; id: string }
  | { type: 'googleSignIn'; id: string };

export type NativeResponse =
  | { type: 'pushPermission'; id: string; granted: boolean; token?: string }
  | { type: 'appleSignIn'; id: string; identityToken?: string; error?: string }
  | { type: 'iapPurchase'; id: string; jws?: string; error?: IapError }
  | { type: 'iapRestore'; id: string; jws?: string[]; error?: IapError }
  | { type: 'kakaoSignIn'; id: string; accessToken?: string; error?: string }
  | { type: 'googleSignIn'; id: string; idToken?: string; error?: string }
  | { type: 'iapTrial'; id: string; eligible: boolean; days?: number };

/** canceled: 사용자가 닫음, pending: 승인 대기(자녀 보호 등), unsupported: 결제 기능이 없는 옛 앱 버전 */
export type IapError = 'canceled' | 'pending' | 'unsupported' | 'not_found' | 'failed';

declare global {
  interface Window {
    ReactNativeWebView?: { postMessage: (message: string) => void };
    /** 앱이 페이지보다 먼저 심는 기능 목록. 옛 앱 버전에는 없다 */
    minicoveryNative?: { iap?: boolean; review?: boolean; trial?: boolean; kakao?: boolean; google?: boolean };
  }
}

export const isNative = () => typeof window !== 'undefined' && Boolean(window.ReactNativeWebView);

export function postNative(message: NativeRequest) {
  window.ReactNativeWebView?.postMessage(JSON.stringify(message));
}

/** 알림 권한 요청. 앱에서는 OS 권한, 웹에서는 브라우저 권한(개발 확인용) */
export async function requestPushPermission(): Promise<{ granted: boolean; token?: string }> {
  if (isNative()) {
    const id = Math.random().toString(36).slice(2);
    return new Promise(resolve => {
      const handler = (e: Event) => {
        const detail = (e as CustomEvent<NativeResponse>).detail;
        if (detail?.type === 'pushPermission' && detail.id === id) {
          window.removeEventListener('minicovery-native', handler);
          resolve({ granted: detail.granted, token: detail.token });
        }
      };
      window.addEventListener('minicovery-native', handler);
      postNative({ type: 'requestPushPermission', id });
      setTimeout(() => {
        window.removeEventListener('minicovery-native', handler);
        resolve({ granted: false });
      }, 60_000);
    });
  }
  if (typeof Notification === 'undefined') return { granted: false };
  const result = await Notification.requestPermission();
  return { granted: result === 'granted' };
}

/** iOS 앱에서만: Apple로 계속하기. 앱이 Apple 로그인 창을 띄우고 identity token을 돌려준다 */
export const canAppleSignIn = () => isNative() && /iPhone|iPad|iPod/.test(navigator.userAgent);

export function nativeAppleSignIn(): Promise<{ identityToken?: string; error?: string }> {
  const id = Math.random().toString(36).slice(2);
  return new Promise(resolve => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<NativeResponse>).detail;
      if (detail?.type === 'appleSignIn' && detail.id === id) {
        window.removeEventListener('minicovery-native', handler);
        resolve({ identityToken: detail.identityToken, error: detail.error });
      }
    };
    window.addEventListener('minicovery-native', handler);
    postNative({ type: 'appleSignIn', id });
  });
}

/** 앱에 요청을 보내고 같은 id의 답을 기다린다. 답이 없으면(옛 앱 버전) unsupported */
function askNative<T extends NativeResponse>(message: NativeRequest & { id: string }, timeoutMs: number): Promise<T | null> {
  return new Promise(resolve => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<NativeResponse>).detail;
      if (detail?.type === message.type && detail.id === message.id) {
        window.removeEventListener('minicovery-native', handler);
        clearTimeout(timer);
        resolve(detail as T);
      }
    };
    const timer = setTimeout(() => {
      window.removeEventListener('minicovery-native', handler);
      resolve(null);
    }, timeoutMs);
    window.addEventListener('minicovery-native', handler);
    postNative(message);
  });
}

/** 결제 기능이 있는 iOS 앱 (빌드 3부터) */
export const canPurchase = () => isNative() && Boolean(window.minicoveryNative?.iap);

/** iOS 앱에서만: App Store 구독 결제. 성공하면 서버가 확인할 거래 JWS를 돌려준다 */
export async function nativePurchase(productId: string, accountToken: string): Promise<{ jws?: string; error?: IapError }> {
  if (!canPurchase()) return { error: 'unsupported' };
  const id = Math.random().toString(36).slice(2);
  // 결제 시트에서 오래 머물 수 있어 넉넉히 기다린다
  const res = await askNative<Extract<NativeResponse, { type: 'iapPurchase' }>>({ type: 'iapPurchase', id, productId, accountToken }, 10 * 60_000);
  return res ?? { error: 'unsupported' };
}

/** iOS 앱에서만: 구매 복원. 이 Apple 계정의 유효한 구독 거래들을 돌려준다 */
export async function nativeRestore(): Promise<{ jws?: string[]; error?: IapError }> {
  if (!canPurchase()) return { error: 'unsupported' };
  const id = Math.random().toString(36).slice(2);
  const res = await askNative<Extract<NativeResponse, { type: 'iapRestore' }>>({ type: 'iapRestore', id }, 60_000);
  return res ?? { error: 'unsupported' };
}

/** 카카오·Google 로그인 기능이 있는 앱 (빌드 4부터) */
export const canSocialSignIn = (provider: 'kakao' | 'google') => isNative() && Boolean(window.minicoveryNative?.[provider]);

/** 앱이 카카오 로그인(카카오톡 또는 카카오계정)을 띄우고 액세스 토큰을 돌려준다. 서버가 카카오에 확인한다 */
export async function nativeKakaoSignIn(): Promise<{ accessToken?: string; error?: string }> {
  const id = Math.random().toString(36).slice(2);
  const res = await askNative<Extract<NativeResponse, { type: 'kakaoSignIn' }>>({ type: 'kakaoSignIn', id }, 5 * 60_000);
  return res ?? { error: 'failed' };
}

/** 앱이 Google 로그인을 띄우고 ID 토큰을 돌려준다. 서버가 Google 공개키로 검증한다 */
export async function nativeGoogleSignIn(): Promise<{ idToken?: string; error?: string }> {
  const id = Math.random().toString(36).slice(2);
  const res = await askNative<Extract<NativeResponse, { type: 'googleSignIn' }>>({ type: 'googleSignIn', id }, 5 * 60_000);
  return res ?? { error: 'failed' };
}

/** iOS 앱에서만 (빌드 5부터): App Store 리뷰 요청. 띄울지는 iOS가 정하고 결과는 알 수 없다 */
export function nativeRequestReview() {
  if (isNative() && window.minicoveryNative?.review) postNative({ type: 'requestReview' });
}

/** iOS 앱에서만: 시스템 설정의 이 앱 화면 열기 (알림을 거절한 뒤 다시 켤 때) */
export function openAppSettings() {
  if (isNative()) postNative({ type: 'openSettings' });
}

/** iOS 앱에서만 (빌드 6부터): 이 Apple 계정이 첫 구독 무료 체험을 받을 수 있는지. 모르면 false */
export async function nativeTrialEligible(productId: string): Promise<{ eligible: boolean; days?: number }> {
  if (!isNative() || !window.minicoveryNative?.trial) return { eligible: false };
  const id = Math.random().toString(36).slice(2);
  const res = await askNative<Extract<NativeResponse, { type: 'iapTrial' }>>({ type: 'iapTrial', id, productId }, 10_000);
  return res ? { eligible: res.eligible, days: res.days } : { eligible: false };
}
