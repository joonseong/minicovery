# 다음 업데이트 제출용 메모 (2026-11-09 기준)

1.0.1 승인 뒤 바뀐 점을 반영한 심사 메모다. 1.0.1 때 원문은 `app-review-1.0.1.md`.
1.0.1 뒤 운영 웹에 바로 나간 변경: 다른 사람들이 만든 코스를 '받기' 대신 그 자리에서 열람(PR #19), 그 코스에 좋아요를 누르면 만든 사람에게 알림, 무료는 3번째 Drop 앞부분까지·나머지는 Plus(PR 공유 코스 Plus), 다음 Drop 알림은 모두 아침 8시(PR #26).

## 1.0.2 (빌드 11, 2026-11-10 업로드)

네이티브 변경: 새 스플래시(검은 바탕 두들 말풍선 + MINICOVERY + 슬로건, 웹 첫 화면까지 이어짐). 버전 1.0.2에 빌드 11을 고르고, 메모의 What's new는 아래로.

이번 버전의 새로운 기능:

```
- 앱을 켤 때 새 시작 화면이 나와요.
- 다른 사람들이 만든 코스를 바로 읽고, 마음에 들면 좋아요를 누를 수 있어요.
- 다음 Drop 알림이 매일 아침 8시에 와요.
```

심사 메모 What's new 줄: `a new launch screen, reading courses that other users shared (with likes), and a daily 8 AM reminder.`

## 제출 전에 할 것

- Xcode를 올렸으면 TestFlight로 실기기에서 켜 본다 (1.0.1 빌드 9 거절 원인).
- 심사 중에는 익명 하루 한도를 30으로 올린다. Vercel 환경 변수 `ANON_IP_DAILY_LIMIT=30`을 넣고 재배포한다(대표가 대시보드에서). 심사가 끝나면 지워서 기본값 5로 돌린다.
- `IAP_ALLOW_SANDBOX`는 켠 채로 둔다 (심사관은 Sandbox로 결제).
- 심사 중에는 화면이 바뀌는 PR을 master에 올리지 않는다 (앱이 운영 웹을 그대로 보여 준다).
- 데모 계정이 앱에서 로그인되는지 확인한다.

## 앱 심사 메모 (App Review Information › Notes)

`<버전>`과 'What's new' 줄만 그 버전에 맞게 고친다.

```
Hello App Review team,

What's new in <버전>: <이번 버전 변경>.

How to review
- No login is required. On first launch, type a topic, choose a level and tap "코스 만들기". Today's Drop opens. Each Drop has one illustration.
- "다른 사람들이 만든 코스" is at the bottom of Home and on the new-course screen (+ button). Tap a course to see its outline, then "첫 Drop 읽기" to read it right away. Reading does not add the course to your own courses. Free users can read the first two Drops and the beginning of the third; the rest of each shared course is part of Minicovery Plus ("Plus로 이어 읽기" opens the subscription screen).
- The heart button on that screen is a like. The person who made the course gets a push notification that someone liked it. It does not say who.
- Demo account: the email account in Sign-In Information. To sign in: Profile tab › Settings (top right) › 로그인.
- Minicovery Plus (auto-renewable monthly subscription, ₩3,900, 7-day free trial for first-time subscribers): Profile › Settings › 미니커버리 Plus. "구매 복원" is on the same screen.
- Account deletion: Profile › Settings › 계정 삭제.

Content shared by other users
- When users finish a course, they can turn on "이 코스를 다른 사람에게 추천하기". The course's title, outline, Drops and illustrations are then listed for other users. No names, profiles, comments or messages are shown, and users cannot contact each other.
- Likes are anonymous. The only thing the course maker receives is a notification that someone liked the course. Notifications are opt-in and are not sent between 21:00 and 08:00.
- Every topic passes an AI safety check before a course is created. Unsafe topics are refused.
- Every Drop has a "내용이 이상해요" button to report wrong or inappropriate content. The operator reviews reports and can hide any shared course at any time. Contact: minimalReading@gmail.com

External services
- Anthropic Claude API: writes course outlines and Drops (with web search to check facts).
- OpenAI Image API: draws one illustration per Drop from the Drop's title and key points. No account information is sent.
- Supabase (database and image storage, Seoul region), Vercel (hosting), Firebase Cloud Messaging (opt-in reminders and like notifications), Sign in with Apple / Google / Kakao, Apple In-App Purchase.

Thank you.
```
