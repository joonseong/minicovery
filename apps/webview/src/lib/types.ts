export type Level = 'beginner' | 'some' | 'advanced';
export type TaskType = 'work' | 'hobby';
export type UnderstandingSignal = 'understood' | 'confused';
export type ExplainAnswer = 'yes' | 'some' | 'not_yet';
export type GenerationMode = 'realtime' | 'prefetch' | 'batch';
export type ModelTier = 'opus' | 'sonnet' | 'haiku';

export const LEVEL_LABEL: Record<Level, string> = {
  beginner: '처음이에요',
  some: '조금 알아요',
  advanced: '꽤 알아요',
};

export interface User {
  id: string;
  anon: boolean;
  email?: string;
  nickname?: string;
  /** scrypt 'salt:hash' (Supabase Auth로 옮기기 전 MVP용) */
  passwordHash?: string;
  createdAt: string;
  /** 'HH:mm' KST. 비어 있으면 첫 Drop을 읽은 시각 */
  notifyTime?: string;
  notifyPermission: 'unknown' | 'granted' | 'denied';
  /** Drop 완료 뒤 알림 권한을 마지막으로 물어본 시각 (3일에 한 번까지) */
  notifyAskedAt?: string;
  /** 거절 후 재안내 배너를 닫은 시각 (7일간 숨김) */
  notifyBannerDismissedAt?: string;
  pushToken?: string;
  /** 사전 구독 신청 (Gate 1 지불 의향 측정) */
  presubscribedAt?: string;
  /** Apple 로그인 sub */
  appleSub?: string;
  /** 카카오 회원번호 */
  kakaoId?: string;
  /** Google 로그인 sub */
  googleSub?: string;
  /** Plus 구독 시작 시각. 비어 있으면 무료 */
  plusSince?: string;
  /** App Store 구독 만료 시각. 갱신·해지 알림과 앱 실행 시 동기화로 바뀐다 */
  plusExpiresAt?: string;
  /** App Store 구독 원거래 ID (갱신해도 같다). 구매 복원·알림에서 사용자를 찾는 데 쓴다 */
  plusOriginalTxId?: string;
  /** 오늘 Drop을 받을 코스 (KST 날짜별). 하루 한 편 정책 */
  todayPick?: { date: string; courseId: string };
  /** 내일 받을 코스. 야간 Batch가 이 코스의 다음 Drop을 미리 만든다 */
  tomorrowCourseId?: string;
  /** Plus '전체 열기'를 마지막으로 쓴 시각 (한 달에 한 코스) */
  openAllAt?: string;
  /** 다 배운 주제 기록. 코스를 지워도 남는다 (캐릭터 단계 기준) */
  learned?: LearnedTopic[];
  /** 알림 재질문: '나중에'·거절 횟수. 1회 뒤 7일, 2회부터 30일 간격으로 다시 묻는다 */
  notifyDeclines?: number;
  /** '다시 묻지 않기' — 완료 뒤 알림 시트와 홈 배너를 더 보여 주지 않는다 */
  notifyNever?: boolean;
  /** 단계가 올랐는데 아직 /levelup 화면을 보지 않았을 때의 단계 key (한 번 보여 주고 지운다) */
  pendingLevelUp?: string;
  /** 로그인 때 기기 임시 계정의 진행 중 코스를 계정에 합쳤음을 홈에서 한 번 알린다 */
  mergeNotice?: { topics: string[]; at: string };
  /** App Store 거래 환경. Sandbox(TestFlight·심사)는 어드민에서 구분한다 */
  plusEnv?: 'Sandbox' | 'Production';
  /** 자동 갱신 켜짐 여부 (renewalInfo.autoRenewStatus) */
  plusAutoRenew?: boolean;
  /** 결제 실패 유예 기간 끝 (renewalInfo.gracePeriodExpiresDate). 이 시각까지는 Plus로 본다 */
  plusGraceUntil?: string;
  /** 비밀번호 재설정 토큰의 sha256 해시(base64url)와 만료 시각 */
  passwordReset?: { hash: string; expiresAt: string };
  /** Sign in with Apple refresh token (계정 삭제 때 revoke용, Apple 키 환경 변수가 있을 때만 저장) */
  appleRefreshToken?: string;
  /** /api/topic/check를 통과한 주제 (24시간, 최근 10개). 코스 만들기는 이 목록에 있는 주제만 받는다 */
  approvedTopics?: { topic: string; category: string; taskType: TaskType; at: string }[];
  /** 익명 사용자가 코스를 만들 때의 IP 해시 (IP당 하루 생성 한도) */
  ipHash?: string;
}

export interface LearnedTopic {
  topic: string;
  category: string;
  courseId: string;
  at: string;
}

/** 쉽게 다시 설명 ('조금 헷갈려요') */
export interface EasyBody {
  lead: string;
  daily: string;
  so: string;
  takeaway: string;
}

export interface CourseOutlineItem {
  title: string;
}

export interface Course {
  id: string;
  userId: string;
  topic: string;
  title: string;
  level: Level;
  category: string;
  taskType: TaskType;
  /** deleted: 무료 사용자가 새 주제로 바꾸며 지운 코스 (학습 기록은 user.learned에 남음) */
  status: 'generating' | 'active' | 'completed' | 'failed' | 'deleted';
  outline: CourseOutlineItem[];
  /** 코스를 만들 때 함께 생성한 연결 주제 2개 → Map의 Discovered 노드 */
  related: string[];
  regenUsed: boolean;
  createdAt: string;
  completedAt?: string;
  explainAnswer?: ExplainAnswer;
  /** 마지막으로 Drop을 완료한 시각 (알림 대상 코스 고르기) */
  lastReadAt?: string;
  /** Plus '전체 열기'를 쓴 시각. 이 코스는 하루 한 편 제한 없이 읽는다 */
  openedAllAt?: string;
  /** 무료 사용자가 새 주제로 바꾸며 지운 시각 (바꾸기는 하루 1번) */
  deletedAt?: string;
  /** 완주한 사용자가 추천 코스로 내놓기를 켬 (이름 없이, 기본 꺼짐) */
  shared?: boolean;
  /** 운영자가 추천 코스로 고름 (shared일 때만 노출) */
  featured?: boolean;
  /** 이 코스를 받아 간 횟수 (추천 코스 카드의 'N명이 받았어요') */
  copies?: number;
  /** 추천 코스를 받아 만든 코스면 원본 코스 id */
  copiedFrom?: string;
  /** 완주 공유 링크 /c/{shareId} */
  shareId?: string;
}

export interface DropBody {
  hook: string;
  concept: string;
  example: string;
  connection?: string;
  takeaway: string;
  /** 주요 내용 개조식, 줄마다 "- " (이 필드가 생기기 전 Drop에는 없다) */
  points?: string;
}

export interface Source {
  url: string;
  title: string;
}

export interface Drop {
  id: string;
  courseId: string;
  userId: string;
  index: number;
  title: string;
  /** skipped: 모델이 거절한 Drop. 하루 한 편·완주 계산에서 빠지고 다음 Drop으로 넘어간다 */
  status: 'pending' | 'generating' | 'ready' | 'failed' | 'skipped';
  /** generating으로 바꾼 시각. 실시간 6분·배치 20시간이 지나면 멈춘 것으로 보고 다시 만든다 */
  generatingAt?: string;
  skipReason?: 'refused';
  body?: DropBody;
  sources: Source[];
  /** 병렬 검증에서 고친 경우 */
  corrected?: boolean;
  verify?: 'pending' | 'ok' | 'fixed' | 'conflict';
  mode?: GenerationMode;
  model?: ModelTier;
  generatedAt?: string;
  completedAt?: string;
  signal?: UnderstandingSignal;
  readAt?: string;
  reportedAt?: string;
  /** 야간 Batch로 생성 중일 때의 batch id */
  batchId?: string;
  /** 사실 검증에 쓰는 근거 문장 (웹 검색 인용) */
  evidence?: string[];
  /** '조금 헷갈려요'로 만든 쉬운 설명 (한 번만 만든다) */
  easy?: EasyBody;
}

export interface UsageLog {
  id: string;
  userId: string;
  at: string;
  purpose: 'check' | 'curriculum' | 'drop' | 'verify' | 'easy';
  model: ModelTier;
  mode: GenerationMode;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  searches: number;
  costUsd: number;
}

export interface AppEvent {
  id: string;
  userId: string;
  name: string;
  props?: Record<string, unknown>;
  at: string;
}

export interface Report {
  id: string;
  userId: string;
  dropId: string;
  at: string;
  /** 신고 사유 (틀린 사실 / 이해 안 됨 / 부적절) */
  reason?: 'wrong' | 'unclear' | 'inappropriate';
}

export interface FailureLog {
  id: string;
  userId: string;
  at: string;
  stage: string;
  message: string;
}

export type SocialField = 'appleSub' | 'kakaoId' | 'googleSub';
