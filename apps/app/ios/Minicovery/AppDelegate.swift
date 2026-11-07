import UIKit
import React
import React_RCTAppDelegate
import ReactAppDependencyProvider
import FirebaseCore
import GoogleSignIn
import KakaoSDKAuth

@main
class AppDelegate: UIResponder, UIApplicationDelegate {
  var window: UIWindow?

  var reactNativeDelegate: ReactNativeDelegate?
  var reactNativeFactory: RCTReactNativeFactory?
  var launchOptions: [UIApplication.LaunchOptionsKey: Any]?

  func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    // 구독 갱신·Ask to Buy 승인 거래는 앱이 켜지자마자 받아야 하므로 RN 모듈보다 먼저 StoreKit 리스너를 켠다
    MinicoveryIAP.startTransactionListener()

    // 푸시 알림: ios/Minicovery/GoogleService-Info.plist가 있을 때만 Firebase를 켠다
    // (Firebase 콘솔에서 받음, git에는 올리지 않음). 없으면 알림만 빠지고 앱은 그대로 동작한다
    if Bundle.main.path(forResource: "GoogleService-Info", ofType: "plist") != nil {
      FirebaseApp.configure()
    }

    let delegate = ReactNativeDelegate()
    let factory = RCTReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()

    reactNativeDelegate = delegate
    reactNativeFactory = factory
    self.launchOptions = launchOptions

    // 창은 SceneDelegate가 띄운다
    return true
  }
}

/// 앱 창 (UIScene 생명주기, Info.plist의 UIApplicationSceneManifest).
/// iOS 27 SDK로 빌드한 앱이 UIScene을 쓰지 않으면 iOS 27에서 켜자마자 종료된다 (1.0.1 빌드 9 심사 거절)
class SceneDelegate: UIResponder, UIWindowSceneDelegate {
  var window: UIWindow?

  func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
    guard let windowScene = scene as? UIWindowScene, let app = UIApplication.shared.delegate as? AppDelegate else { return }

    let window = UIWindow(windowScene: windowScene)
    self.window = window
    // Firebase 메시징 등 일부 라이브러리는 AppDelegate.window로 창을 찾는다
    app.window = window

    app.reactNativeFactory?.startReactNative(
      withModuleName: "Minicovery",
      in: window,
      launchOptions: app.launchOptions
    )

    self.scene(scene, openURLContexts: connectionOptions.urlContexts)
  }

  // 카카오톡·Google 로그인을 마치고 앱으로 돌아올 때
  func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
    guard let url = URLContexts.first?.url else { return }
    if AuthApi.isKakaoTalkLoginUrl(url) {
      _ = AuthController.handleOpenUrl(url: url)
    } else {
      _ = GIDSignIn.sharedInstance.handle(url)
    }
  }
}

class ReactNativeDelegate: RCTDefaultReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    self.bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: "index")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
