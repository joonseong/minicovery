# TestFlight 출시 체크리스트 (iOS 먼저)

앱은 **웹뷰 껍데기(apps/app, React Native)** 가 **웹앱(apps/webview, Next.js)** 을 띄우는 구조다.
그래서 TestFlight 빌드 전에 웹앱이 먼저 인터넷에 떠 있어야 한다.

## 1. 웹앱 배포 (Vercel + Supabase)

1. Supabase 프로젝트를 만들고 `supabase/migrations/0001_init.sql`, `0002_apple_login.sql` 을 차례로 실행한다.
2. Vercel 프로젝트를 만든다. Root Directory = `apps/webview`, 리전 = 서울(icn1, `vercel.json`에 지정).
3. Vercel 환경 변수 (`apps/webview/.env.example` 참고)
   - `ANTHROPIC_API_KEY` — 대표가 출시 직전에 넣는다. 비어 있으면 가짜 응답으로 동작한다.
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - `CRON_SECRET` (임의의 긴 문자열), `ADMIN_TOKEN`
   - `PLUS_BETA_FREE` — `true`면 결제 없이 Plus를 켠다(베타). 빌드 3(인앱 결제)부터는 끈다.
   - `APPLE_IAP_KEY_ID`, `APPLE_IAP_ISSUER_ID`, `APPLE_IAP_PRIVATE_KEY` — App Store Connect > 사용자 및 액세스 > 통합 > 앱 내 구입 키 (.p8 내용)
   - `APPLE_BUNDLE_ID=com.minicovery.app`
   - `FIREBASE_SERVICE_ACCOUNT` (푸시를 쓸 때)
4. 크론: `vercel.json` — 야간 생성(매일 02:00 KST), 결과 수거(05:30 KST). Hobby 요금제도 되는 하루 1회 크론만 둔다.
   알림(10분마다)은 Supabase pg_cron + pg_net (`0003_notify_cron.sql`) 이 `/api/cron/notify` 를 부른다. CRON_SECRET 값은 Supabase Vault에 이름 `cron_secret` 으로 넣는다.
5. 앱이 여는 주소는 `apps/app/src/config.ts` 의 `PROD_URL` (`https://minicovery.vercel.app`). 프로젝트 이름이 달라지면 바꾼다.

## 2. Apple 준비 (대표가 직접)

1. Apple Developer Program 가입 (연 $99).
2. App Store Connect에서 앱 생성: 번들 ID `com.minicovery.app`, 이름 "미니커버리".
3. Identifiers에서 `com.minicovery.app` 에 **Sign in with Apple**, **Push Notifications** 켜기.
4. 이 맥에 **Xcode 설치** (App Store, 약 15GB 여유 공간 필요).

## 3. 빌드와 업로드

```bash
cd apps/app/ios
pod install
open Minicovery.xcworkspace
```

Xcode에서:
1. Minicovery 타깃 → Signing & Capabilities → Team 선택 (자동 서명).
2. (푸시를 쓸 때) Firebase 콘솔에서 받은 `GoogleService-Info.plist` 를 Minicovery 폴더에 끌어다 넣는다 (git에는 올리지 않음).
   없으면 알림만 빠지고 앱은 그대로 동작한다.
3. 기기를 "Any iOS Device (arm64)"로 두고 Product → Archive.
4. Organizer → Distribute App → App Store Connect → Upload.
5. App Store Connect → TestFlight에서 빌드 처리 후 내부 테스터 추가.

버전: `MARKETING_VERSION = 1.0`, `CURRENT_PROJECT_VERSION = 1` (올릴 때마다 빌드 번호를 1씩 올린다).

## 4. 정식 출시 전에 남은 것

- 인앱 결제(Plus 월 3,900원): 상품 ID `com.minicovery.plus.monthly`. 앱은 StoreKit 2(`MinicoveryIAP.swift`), 서버는 `/api/iap/verify`가 App Store Server API로 확인한다.
  App Store Connect > 앱 정보 > App Store 서버 알림(버전 2)에 운영·샌드박스 모두 `https://minicovery.vercel.app/api/iap/notify` 를 넣는다.
  첫 구독 상품은 앱 버전과 함께 심사에 제출한다.
- 카카오·Google 로그인: 앱 키를 받으면 `NEXT_PUBLIC_KAKAO_LOGIN` / `NEXT_PUBLIC_GOOGLE_LOGIN` 을 켜고 OAuth 라우트를 붙인다.
- 이용약관·개인정보 처리방침(`/terms`, `/privacy`)은 초안이다. 사업자 정보와 연락처를 채우고 검토 받는다.
- 앱 아이콘은 토끼 얼굴 + 브랜드 녹색으로 만든 임시안이다.
