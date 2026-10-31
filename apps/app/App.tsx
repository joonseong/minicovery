import { type ComponentType, type Ref, useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Linking, Platform, StatusBar, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import WebViewBase, { type WebViewMessageEvent, type WebViewProps } from 'react-native-webview';

import { appleAuth } from '@invertase/react-native-apple-authentication';
import messaging from '@react-native-firebase/messaging';

import { PLUS_PRODUCT_ID, WEB_URL } from './src/config';
import { ErrorScreen, LoadingScreen } from './src/fallback';
import { entitlements, iapAvailable, onTransaction, purchase, requestReview, trialEligible } from './src/iap';
import { signInWithGoogle, signInWithKakao, socialAvailable } from './src/social';
import { pathFromMessage, pushAvailable, requestPush } from './src/push';

/**
 * 미니커버리 앱 껍데기. 화면은 전부 웹뷰(apps/webview)이고,
 * 네이티브는 푸시 권한·토큰, 알림 탭 이동, Apple 로그인, 구독 결제, 외부 링크, 시스템 설정 이동만 맡는다.
 * 웹 쪽 프로토콜: apps/webview/src/lib/client/bridge.ts
 */
// react-native-webview 13 타입은 제네릭 기본값(undefined) 때문에 props가 never가 되어 한 번 감싼다
type WebViewRef = WebViewBase<object>;
const WebView = WebViewBase as unknown as ComponentType<WebViewProps & { ref?: Ref<WebViewRef> }>;

type WebMessage =
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

const MESSAGE_TYPES: ReadonlySet<string> = new Set<WebMessage['type']>([
  'requestPushPermission',
  'appleSignIn',
  'openSettings',
  'haptic',
  'requestReview',
  'iapTrial',
  'iapPurchase',
  'iapRestore',
  'kakaoSignIn',
  'googleSignIn',
]);
// 답(id)이 필요 없는 메시지
const FIRE_AND_FORGET: ReadonlySet<string> = new Set<WebMessage['type']>(['openSettings', 'haptic', 'requestReview']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** 웹 메시지 최소 검증: 아는 type이고, 답이 필요한 메시지는 id가 문자열이어야 한다 */
function parseMessage(data: string): WebMessage | null {
  let raw: unknown;
  try {
    raw = JSON.parse(data);
  } catch {
    return null;
  }
  if (typeof raw !== 'object' || raw === null) return null;
  const { type, id } = raw as { type?: unknown; id?: unknown };
  if (typeof type !== 'string' || !MESSAGE_TYPES.has(type)) return null;
  if (!FIRE_AND_FORGET.has(type) && typeof id !== 'string') return null;
  return raw as WebMessage;
}

// WEB_URL에 끝 슬래시가 없어 startsWith는 https://minicovery.vercel.app.evil.tld도 통과하므로 origin을 정확히 비교한다.
// RN의 URL 폴리필은 타입에 origin이 없어 직접 뽑는다: scheme://host[:port] (http·https만, 소문자). 그 밖의 스킴(mailto 등)은 null
const originOf = (url: string) => {
  const match = /^(https?):\/\/([^/?#]+)/i.exec(url);
  return match ? `${match[1]}://${match[2]}`.toLowerCase() : null;
};
const WEB_ORIGIN = originOf(WEB_URL);
const isWebOrigin = (url: string) => WEB_ORIGIN !== null && originOf(url) === WEB_ORIGIN;
// react-native-webview의 originWhitelist는 접두사 매칭이라 1차 거름망이고, 정확한 판정은 onShouldStartLoadWithRequest가 한다
const ORIGIN_WHITELIST = [WEB_ORIGIN ?? WEB_URL, 'about:'];

// 웹이 결제 기능 유무를 알 수 있게 페이지보다 먼저 심는다 (옛 앱 버전에는 없음)
const INJECT_BEFORE = `window.minicoveryNative = ${JSON.stringify({ iap: iapAvailable(), review: iapAvailable(), trial: iapAvailable(), ...socialAvailable })}; true;`;

// 앱을 켤 때 유효한 구독을 서버에 알린다 (갱신·만료 반영, 알림을 놓쳤을 때 대비)
const syncEntitlementsJs = (jws: string[]) =>
  `fetch('/api/iap/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jws: ${JSON.stringify(jws)} }) }); true;`;

/**
 * Apple로 계속하기: 로그인 창을 띄우고 identity token을 웹으로 넘긴다 (서버가 Apple 공개키로 검증).
 * authorizationCode는 서버가 계정 삭제 때 Sign in with Apple 토큰을 revoke하는 데 쓴다
 */
async function signInWithApple(): Promise<{ identityToken?: string; authorizationCode?: string; error?: string }> {
  try {
    const res = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
      requestedScopes: [appleAuth.Scope.EMAIL],
    });
    return { identityToken: res.identityToken ?? undefined, authorizationCode: res.authorizationCode ?? undefined };
  } catch (error) {
    const code = (error as { code?: string }).code;
    return { error: code === appleAuth.Error.CANCELED ? 'canceled' : 'failed' };
  }
}

const withFrom = (path: string, from: string) => `${WEB_URL}${path}${path.includes('?') ? '&' : '?'}from=${from}`;

export default function App() {
  const webview = useRef<WebViewRef>(null);
  const [uri, setUri] = useState(WEB_URL);
  const [canGoBack, setCanGoBack] = useState(false);
  // 서버 오류(5xx) 덮개. 네트워크 오류는 WebView의 renderError가 맡는다
  const [overlay, setOverlay] = useState<'none' | 'loading' | 'error'>('none');
  const httpFailed = useRef(false);
  const synced = useRef(false);

  const reply = useCallback((detail: object) => {
    const js = `window.dispatchEvent(new CustomEvent('minicovery-native', { detail: ${JSON.stringify(detail)} })); true;`;
    webview.current?.injectJavaScript(js);
  }, []);

  const retry = useCallback(() => {
    setOverlay('loading');
    webview.current?.reload();
  }, []);

  // 알림을 탭해 앱이 열리면 해당 Drop으로 이동
  useEffect(() => {
    if (!pushAvailable()) return;
    void messaging()
      .getInitialNotification()
      .then(message => {
        const path = pathFromMessage(message?.data);
        if (path) setUri(withFrom(path, 'push'));
      });
    return messaging().onNotificationOpenedApp(message => {
      const path = pathFromMessage(message.data);
      if (path) webview.current?.injectJavaScript(`window.location.href = ${JSON.stringify(withFrom(path, 'push'))}; true;`);
    });
  }, []);

  // 토큰이 바뀌면 서버에 다시 알린다
  useEffect(() => {
    if (!pushAvailable()) return;
    return messaging().onTokenRefresh(token => {
      webview.current?.injectJavaScript(
        `fetch('/api/me/notify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pushToken: ${JSON.stringify(token)} }) }); true;`,
      );
    });
  }, []);

  // 자동 갱신·Ask to Buy 승인처럼 앱 밖에서 완료된 거래를 서버에 동기화. 첫 페이지가 뜨기 전 것은 onLoad의 전체 동기화가 대신한다
  useEffect(
    () =>
      onTransaction(jws => {
        if (synced.current) webview.current?.injectJavaScript(syncEntitlementsJs([jws]));
      }),
    [],
  );

  // 안드로이드 뒤로가기는 웹뷰 히스토리부터
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack) return false;
      webview.current?.goBack();
      return true;
    });
    return () => sub.remove();
  }, [canGoBack]);

  const onMessage = useCallback(
    async (event: WebViewMessageEvent) => {
      // 결제·로그인 브리지는 우리 웹에서 온 메시지만 받는다
      if (!isWebOrigin(event.nativeEvent.url)) return;
      const message = parseMessage(event.nativeEvent.data);
      if (!message) return;
      if (message.type === 'requestPushPermission') {
        const result = await requestPush();
        reply({ type: 'pushPermission', id: message.id, ...result });
      }
      if (message.type === 'appleSignIn') {
        const result = await signInWithApple();
        reply({ type: 'appleSignIn', id: message.id, ...result });
      }
      if (message.type === 'kakaoSignIn') {
        const result = await signInWithKakao();
        reply({ type: 'kakaoSignIn', id: message.id, ...result });
      }
      if (message.type === 'googleSignIn') {
        const result = await signInWithGoogle();
        reply({ type: 'googleSignIn', id: message.id, ...result });
      }
      if (message.type === 'iapPurchase') {
        // 상품은 Plus 하나뿐이고 accountToken은 UUID여야 한다 (Swift가 appAccountToken으로 쓴다)
        const valid =
          message.productId === PLUS_PRODUCT_ID && typeof message.accountToken === 'string' && UUID_RE.test(message.accountToken);
        const result = valid ? await purchase(message.productId, message.accountToken) : { error: 'failed' as const };
        reply({ type: 'iapPurchase', id: message.id, ...result });
      }
      if (message.type === 'iapRestore') {
        const result = await entitlements(true);
        reply({ type: 'iapRestore', id: message.id, ...result });
      }
      if (message.type === 'openSettings') void Linking.openSettings();
      if (message.type === 'requestReview') requestReview();
      if (message.type === 'iapTrial') {
        const result = message.productId === PLUS_PRODUCT_ID ? await trialEligible(message.productId) : { eligible: false };
        reply({ type: 'iapTrial', id: message.id, ...result });
      }
    },
    [reply],
  );

  return (
    <SafeAreaProvider>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
        <WebView
          ref={webview}
          source={{ uri }}
          onMessage={onMessage}
          injectedJavaScriptBeforeContentLoaded={INJECT_BEFORE}
          startInLoadingState
          renderLoading={() => <LoadingScreen />}
          renderError={() => <ErrorScreen onRetry={retry} />}
          onLoadStart={() => {
            httpFailed.current = false;
          }}
          // 5xx면 서버 오류 화면을 덮는다 (4xx는 웹의 안내 페이지를 그대로 보인다)
          onHttpError={event => {
            if (event.nativeEvent.statusCode < 500) return;
            httpFailed.current = true;
            setOverlay('error');
          }}
          // 네트워크 오류는 WebView가 renderError를 보이므로 덮개를 걷는다
          onError={() => setOverlay('none')}
          onLoad={() => {
            if (httpFailed.current) return;
            setOverlay('none');
            if (synced.current || !iapAvailable()) return;
            synced.current = true;
            void entitlements(false).then(result => {
              if (result.jws?.length) webview.current?.injectJavaScript(syncEntitlementsJs(result.jws));
            });
          }}
          onNavigationStateChange={state => setCanGoBack(state.canGoBack)}
          // 우리 웹 origin만 웹뷰 안에서 열고, 출처 링크 등 외부 주소는 기본 브라우저로 연다
          originWhitelist={ORIGIN_WHITELIST}
          onShouldStartLoadWithRequest={request => {
            if (isWebOrigin(request.url) || request.url.startsWith('about:')) return true;
            void Linking.openURL(request.url);
            return false;
          }}
          setSupportMultipleWindows={false}
          sharedCookiesEnabled
          allowsBackForwardNavigationGestures
          pullToRefreshEnabled
          bounces={false}
          decelerationRate="normal"
          applicationNameForUserAgent="Minicovery"
        />
        {overlay === 'loading' && <LoadingScreen />}
        {overlay === 'error' && <ErrorScreen onRetry={retry} />}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
});
