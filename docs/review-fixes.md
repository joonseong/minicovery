# 2026-10-31 리뷰 반영 (브랜치 review-fixes)

리뷰 보고서(`~/Desktop/2026/minicovery/review-2026-10-31.md`)의 1차·2차 항목을 반영했다. 디자인 규칙·접근성(D절)과 `global-launch`는 이번에 손대지 않았다.

## 대표 결정 반영
- D1 "오늘 만든 코스의 첫 Drop은 바로 읽기" 유지 — 코스 준비 화면에 "오늘 Drop과 별도로 지금 바로 읽을 수 있어요"로 명시.
- D2 Plus 월 3개에 Plus 켜기 전 진행 중 코스도 포함 — 첫 기간에 `createdAt < plusSince`인 진행 중 코스를 함께 센다. (그 코스를 Plus 켠 날 만들었으면 그날은 '하루 1개'로 막힌다.)
- D3 알림 재질문 3일 → 7일 → 30일, '다시 묻지 않기' 추가.
- D4 이메일 비밀번호 재설정(`/forgot`, `/reset`) 추가. **메일 발송은 Resend 설정이 있어야 동작**(아래).

## 대표가 할 일 (배포 순서)
1. **Supabase SQL 편집기**에서 `supabase/migrations/0006_review_fixes.sql` 실행 — 인덱스 6개, `claim_drop` RPC, 함수 권한 정리, pg_cron `minicovery-collect`(10분마다 배치 수거). Vault `cron_secret`은 0003 때 넣은 것을 그대로 쓴다.
2. **Vercel 환경 변수**
   - 추가: `NEXT_PUBLIC_APP_URL=https://minicovery.vercel.app`, `DAILY_AI_BUDGET_USD=50`(하루 AI 비용 상한, 달러. 넘으면 새 생성을 잠시 막는다)
   - 확인: `APPLE_IAP_KEY_ID`, `APPLE_IAP_ISSUER_ID`, `APPLE_IAP_PRIVATE_KEY`(기존 결제 검증용), `CRON_SECRET`(비어 있으면 이제 cron이 401)
   - 출시 뒤: `IAP_ALLOW_SANDBOX=false` (TestFlight·샌드박스 구독이 운영 Plus를 켜지 못하게. 심사 중에는 비워 둔다)
   - 선택: `RESEND_API_KEY`, `MAIL_FROM`(예: `Minicovery <noreply@도메인>`) — Resend에서 보내는 도메인을 인증해야 한다. 없으면 비밀번호 재설정 화면이 "지금은 메일을 보낼 수 없어요"를 보여 준다.
   - 선택: `APPLE_TEAM_ID`, `APPLE_KEY_ID`, `APPLE_PRIVATE_KEY`(개발자 포털 Sign in with Apple 키 .p8) — 있으면 계정 삭제 때 Apple 토큰을 revoke한다(심사 5.1.1(v) 대비).
3. **웹 배포**: 이 브랜치를 master에 합치면 Vercel이 배포한다. 배포 뒤 `/api/cron/collect`·`/api/cron/notify` 응답의 `took_ms`와 집계를 한 번 본다. App Store Connect › 앱 › App Store Server Notifications에서 "테스트 알림 요청"을 보내 200이 오는지 확인(서명 검증이 새로 들어감).
4. **Xcode 빌드 8**: `MinicoveryIAP.swift`가 `RCTEventEmitter`를 상속하도록 바뀌었다. 첫 빌드에서 Swift 오류가 나면 `requiresMainQueueSetup`에 `override`를 붙이는 것부터 확인. 실기기 확인 포인트: 비행기 모드에서 실행 → 한국어 오류 화면 + [다시 시도]; 출처 링크가 Safari로 열림; 샌드박스 구독 갱신(5분 주기) 때 서버 `/api/iap/verify` 호출이 들어옴; Plus 화면에 ₩3,900 표기.
5. **App Store Connect**: 빌드 8 업로드 → `docs/app-review-2.1.md`의 회신·녹화와 함께 재제출. "앱 개인정보 보호" 설문을 PrivacyInfo(이메일·구매 내역·제품 상호작용·사용자 ID, 모두 연결됨, 추적 없음)와 맞춘다.

## 확인해 주실 것 (구현하며 정한 것)
- 넓은 주제(/start/broad)의 제안 주제는 다시 검사하지 않고 바로 코스로 만들 수 있게 승인 목록에 넣었다.
- 마지막 남은 Drop이 모델 거절로 건너뛰어지면 코스를 자동 완료(다 배운 주제에 추가)한다.
- 익명 사용자는 같은 IP에서 하루 5명까지만 코스를 만들 수 있다(사무실·학교 Wi-Fi면 막힐 수 있음 — `ANON_IP_DAILY_LIMIT`).
- Plus 월 창은 시작일 기준으로 고정하고 말일을 맞춘다(10/31 시작 → 11/30 → 12/31).
- 모델 배분(Opus/Sonnet)은 바꾸지 않았다. Sonnet 전환 비용 추정은 리뷰 대화 참고.

## 코드에서 바뀐 것 (요약)
- 생성 상태 머신: `generatingAt` 기록, 배치 중 Drop을 사용자가 열면 즉시 실시간 생성으로 넘겨받기, 6분 넘은 생성은 멈춘 것으로 보고 다시 생성, 모델 거절 Drop은 `skipped`로 건너뛰기, 코스 완료 = 모든 Drop 완료/건너뜀, 배치 수거 10분 주기·원자적 소비·검증 병렬.
- 비용 방어: 코스 생성 입력 검증, 주제 검사 통과한 주제만 생성, 익명 IP 한도, 하루 AI 예산, 동시 요청 중복 생성 방지(`claimDrop`), 웹 검색 Drop당 최대 2회, 가벼운 단계 effort low, 잘림 감지·재시도, 프롬프트 인젝션 경계, CRON_SECRET 미설정 차단, regenerate 상태 확인, 로그인 실패 제한, 이벤트 크기 제한, 어드민 토큰 쿠키화.
- 결제: Sandbox 거래 구분(`plusEnv`), 거래 ID만으로 남의 구독 가로채기 차단, 로그인 병합 때 기기 Plus 정리, 만료일 단조성, 구독 최신 상태(자동 갱신·유예 기간) 반영, 재구독 시 월 창 재설정, Apple 알림 서명 검증·중복 처리, 구독자 조회 인덱스.
- 계정: 삭제 시 데이터 실제 삭제·다른 기기 세션 종료, Apple 토큰 revoke(키 있을 때), 비밀번호 재설정, 가입 폼 즉시 안내.
- 데이터: 되짚기·복습에서 지운 코스 제외, 바꾸기 때 본문 삭제, 완료 API 열람 검사, 충돌(conflict) 안내.
- 저장소: Supabase 1,000행 상한 대응(페이지네이션), 인덱스, 익명 사용자 지연 생성.
- 화면: 오류·404 페이지, 완주 직후 홈, 되짚기 카드(홈), 알림 시트 개선, Plus 남은 횟수(설정·시작 화면·코스 화면), 복습 지난주 병행, 레벨업 1회·완주 화면 연결, 추천 끄기·이미 받은 코스 처리, 무료 한도 시트 취소, 시작 화면 글자 수·자동 진행, 페이월 체험 문구·현지 가격, 전체 열린 코스 문구, 신고 사유, 각종 토스트.
- 네이티브: 웹뷰 origin 검사, 오프라인·오류 화면, 구독 갱신 즉시 동기화, 가격·Apple 코드 전달, PrivacyInfo, 빌드 8.
- Next.js 14.2.6 → 14.2.35.
