# 1.0.1 제출 (2026-11-07)

1.0(8) 출시 뒤 첫 업데이트. 네이티브 변경은 앱 아이콘과 UIScene 전환이고, 화면(Fuse 디자인·Drop 그림·다른 사람들이 만든 코스)은 운영 웹으로 이미 나가 있다.

빌드 9는 같은 날 심사에서 거절됐다 (2.1(a), iPhone 17 Pro Max·iOS 27.2에서 켜자마자 종료). Xcode 27(iOS 27 SDK)로 빌드한 앱은 UIScene 생명주기를 쓰지 않으면 iOS 27에서 UIKit이 앱을 멈춘다. 빌드 10에서 창 띄우기와 로그인 복귀 주소 처리를 SceneDelegate로 옮겼다. Xcode를 올린 뒤에는 제출 전에 TestFlight로 실기기에서 켜 본다.

## App Store Connect 입력값

- 새 버전: 1.0.1, 빌드 1.0.1 (10)
- 스크린샷: iPhone 6.9형에 `~/Desktop/2026/minicovery/store-2026-11/1290x2796/01~06`. 기존 것은 지운다. 6.3형(`1206x2622`)은 선택.
- 앱 심사 정보: 로그인 필요 체크, 데모 계정은 1.0 심사 때 쓴 이메일 계정 그대로 (제출 전에 앱에서 로그인되는지 확인)
- 출시: 승인 후 자동 출시, 단계적 출시 끔
- 서버: 심사 중에는 익명 하루 한도 30, IAP_ALLOW_SANDBOX 그대로. 화면이 바뀌는 PR은 심사가 끝난 뒤 머지

## 이번 버전의 새로운 기능

```
- 앱 아이콘이 새로워졌어요.
- 화면을 더 깔끔하게 다듬었어요.
- Drop마다 내용에 맞는 그림이 함께 나와요.
- 다른 사람들이 만든 코스를 홈에서 바로 받아 읽을 수 있어요.
```

## 앱 심사 메모 (App Review Information › Notes)

데모 계정은 '로그인 정보'의 사용자 이름·암호 칸에 넣고, 아래 문구는 고칠 것 없이 그대로 붙인다.

```
Hello App Review team,

Build 10 fixes the launch crash on iOS 27 that you found in build 9. The app now uses the UIScene life cycle.

What's new in 1.0.1: a new app icon, a refreshed design, one illustration with each Drop, and a list of courses that other users finished and chose to share ("다른 사람들이 만든 코스").

How to review
- No login is required. On first launch, type a topic, choose a level and tap "코스 만들기". Today's Drop opens. Each Drop now has one illustration.
- "다른 사람들이 만든 코스" is at the bottom of Home and on the new-course screen (+ button). Tap a course to preview its outline, then "이 코스 받기" to copy it.
- Demo account: the email account in Sign-In Information. To sign in: Profile tab › Settings (top right) › 가입하고 기록 저장하기 › 이미 계정이 있어요 · 로그인.
- Minicovery Plus (auto-renewable monthly subscription, ₩3,900, 7-day free trial for first-time subscribers): Profile › Settings › 미니커버리 Plus. "구매 복원" is on the same screen.
- Account deletion: Profile › Settings › 계정 삭제.

Content shared by other users
- When users finish a course, they can turn on "이 코스를 다른 사람에게 추천하기". The course's title, outline, Drops and illustrations are then listed for other users. No names, profiles, comments or messages are shown, and users cannot contact each other.
- Every topic passes an AI safety check before a course is created. Unsafe topics are refused.
- Every Drop has a "내용이 이상해요" button to report wrong or inappropriate content. The operator reviews reports and can hide any shared course at any time. Contact: minimalReading@gmail.com

External services
- Anthropic Claude API: writes course outlines and Drops (with web search to check facts).
- OpenAI Image API: draws one illustration per Drop from the Drop's title and key points. No account information is sent.
- Supabase (database and image storage, Seoul region), Vercel (hosting), Firebase Cloud Messaging (opt-in daily reminders), Sign in with Apple / Google / Kakao, Apple In-App Purchase.

Thank you.
```
