import { type ComponentType, type Ref, useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler, Linking, Platform, StatusBar, StyleSheet } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import WebViewBase, { type WebViewMessageEvent, type WebViewProps } from 'react-native-webview';

import { appleAuth } from '@invertase/react-native-apple-authentication';
import messaging from '@react-native-firebase/messaging';

import { WEB_URL } from './src/config';
import { entitlements, iapAvailable, purchase } from './src/iap';
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
  | { type: 'iapPurchase'; id: string; productId: string; accountToken: string }
  | { type: 'iapRestore'; id: string }
  | { type: 'kakaoSignIn'; id: string }
  | { type: 'googleSignIn'; id: string };

// 웹이 결제 기능 유무를 알 수 있게 페이지보다 먼저 심는다 (옛 앱 버전에는 없음)
const INJECT_BEFORE = `window.minicoveryNative = ${JSON.stringify({ iap: iapAvailable(), ...socialAvailable })}; true;`;

// 앱을 켤 때 유효한 구독을 서버에 알린다 (갱신·만료 반영, 알림을 놓쳤을 때 대비)
const syncEntitlementsJs = (jws: string[]) =>
  `fetch('/api/iap/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jws: ${JSON.stringify(jws)} }) }); true;`;

/** Apple로 계속하기: 로그인 창을 띄우고 identity token을 웹으로 넘긴다 (서버가 Apple 공개키로 검증) */
async function signInWithApple(): Promise<{ identityToken?: string; error?: string }> {
  try {
    const res = await appleAuth.performRequest({
      requestedOperation: appleAuth.Operation.LOGIN,
      requestedScopes: [appleAuth.Scope.EMAIL],
    });
    return { identityToken: res.identityToken ?? undefined };
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
  const synced = useRef(false);

  const reply = useCallback((detail: object) => {
    const js = `window.dispatchEvent(new CustomEvent('minicovery-native', { detail: ${JSON.stringify(detail)} })); true;`;
    webview.current?.injectJavaScript(js);
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
      let message: WebMessage;
      try {
        message = JSON.parse(event.nativeEvent.data) as WebMessage;
      } catch {
        return;
      }
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
        const result = await purchase(message.productId, message.accountToken);
        reply({ type: 'iapPurchase', id: message.id, ...result });
      }
      if (message.type === 'iapRestore') {
        const result = await entitlements(true);
        reply({ type: 'iapRestore', id: message.id, ...result });
      }
      if (message.type === 'openSettings') void Linking.openSettings();
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
          onLoadEnd={() => {
            if (synced.current || !iapAvailable()) return;
            synced.current = true;
            void entitlements(false).then(result => {
              if (result.jws?.length) webview.current?.injectJavaScript(syncEntitlementsJs(result.jws));
            });
          }}
          onNavigationStateChange={state => setCanGoBack(state.canGoBack)}
          // 출처 링크 등 외부 주소는 기본 브라우저로 연다
          onShouldStartLoadWithRequest={request => {
            if (request.url.startsWith(WEB_URL) || request.url.startsWith('about:')) return true;
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
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
});
