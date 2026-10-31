# Minicovery (미니커버리)

궁금한 주제를 하루 3분짜리 코스로 만들어 매일 보내주는 한국어 지식 구독 앱. 기획: `~/Desktop/2026/minicovery/Minicovery_PRD_v0.4.md`

## 구조

| 경로 | 내용 |
|---|---|
| `apps/webview` | Next.js 14 (App Router). 화면 전체 + API(코스·Drop 생성 스트리밍, 야간 배치, 알림, 어드민) |
| `apps/app` | React Native 0.81 앱 껍데기. 웹뷰 + 푸시 권한·토큰, 알림 탭 이동, 외부 링크 |
| `packages/ui`, `packages/tailwind` | 미니멀리딩 디자인 시스템 복사본 (원본과 별개. 브랜드 토큰은 아직 미니멀리딩 그대로) |
| `supabase/migrations` | 운영 DB 스키마 |

## 웹 실행

```bash
pnpm install
cp apps/webview/.env.example apps/webview/.env.local
pnpm --filter webview dev        # http://localhost:3100
```

- `ANTHROPIC_API_KEY`가 비어 있으면 **가짜 응답**으로 생성한다. 넣으면 실제 Claude(웹 검색 포함)로 생성한다.
- `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY`가 비어 있으면 `apps/webview/.data/db.json`에 저장한다.
- 어드민: `/admin?token=<ADMIN_TOKEN>` — 지표 요약, 비용, 오류 신고, 생성 실패
- 테스트: `pnpm --filter webview test`

### 정기 작업 (cron)

`Authorization: Bearer <CRON_SECRET>`로 호출한다. 운영에서는 Supabase pg_cron이나 Vercel Cron에 건다.

| 경로 | 주기 | 하는 일 |
|---|---|---|
| `POST /api/cron/nightly` | 매일 밤 1회 (예: 02:00 KST) | 진행 중인 코스마다 다음 Drop을 Batch API로 생성 요청 |
| `POST /api/cron/collect` | 10분마다 (Supabase pg_cron, `0006_review_fixes.sql`) | 끝난 Batch 결과 저장 + 사실 검증. 겹쳐 돌아도 이미 저장한 Drop은 건너뛴다 |
| `POST /api/cron/notify` | 10분마다 | 알림 시각이 된 사용자에게 다음 Drop 푸시 (21~08시 제외) |

## 앱 껍데기 실행 (아직 빌드 전)

준비물:
1. Firebase 프로젝트를 **미니멀리딩과 별도로** 만들고 `GoogleService-Info.plist` → `apps/app/ios/Minicovery/`, `google-services.json` → `apps/app/android/app/` (git 제외)
2. 서버 푸시 발송용 서비스 계정 JSON을 `FIREBASE_SERVICE_ACCOUNT` 환경변수로
3. Xcode에서 Push Notifications capability 추가

```bash
cd apps/app/ios && bundle install && bundle exec pod install && cd ..
pnpm --filter app dev            # Metro
pnpm --filter app ios            # 또는 android
```

번들 ID는 `com.minicovery.app`(가안). 운영 웹 주소는 `apps/app/src/config.ts`의 `PROD_URL`.

## PRD와의 대응

- 생성 순서·모델 선택: `apps/webview/src/lib/service.ts`, `lib/jobs.ts` (PRD §16, §29)
- 프롬프트: `apps/webview/src/lib/ai/prompts.ts`
- 지표 이벤트: `drop_completed`(이해 신호 탭), `ttfd`, `drop_read`, `presubscribe` 등 (PRD §19)
- 가입 전 코스 1개 제한, 하루 Opus 2개 이후 Sonnet, 21~08시 알림 금지 등은 `lib/constants.ts`
