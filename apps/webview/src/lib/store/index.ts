import type { AppEvent, Course, Drop, FailureLog, Report, SocialField, UsageLog, User } from '../types';
import { FileStore } from './file';
import { SupabaseStore } from './supabase';

export interface Store {
  getUser(id: string): Promise<User | null>;
  saveUser(user: User): Promise<void>;
  /** 임시 계정 → 가입 계정으로 학습 기록 이전 */
  moveUserData(fromUserId: string, toUserId: string): Promise<void>;
  findUserByEmail(email: string): Promise<User | null>;
  /** 소셜 로그인 계정 찾기 (Apple sub · 카카오 회원번호 · Google sub) */
  findUserBySocial(field: SocialField, id: string): Promise<User | null>;
  listUsers(): Promise<User[]>;
  /** App Store 원거래 ID로 구독자 찾기 (data->>'plusOriginalTxId') */
  findUserByPlusTx(originalTxId: string): Promise<User | null>;
  /** 비밀번호 재설정 토큰 해시로 사용자 찾기 (data->passwordReset->>hash) */
  findUserByResetHash(hash: string): Promise<User | null>;
  /** sinceIso 이후 만들어진 같은 IP 해시의 익명 사용자 수 (IP당 하루 생성 한도) */
  countAnonUsersByIpSince(ipHash: string, sinceIso: string): Promise<number>;
  /** 계정 삭제: 사용자·코스·Drop·이벤트·신고·실패 기록을 지운다 (사용량 로그는 비용 집계용으로 남긴다) */
  deleteUserData(userId: string): Promise<void>;

  getCourse(id: string): Promise<Course | null>;
  listCourses(userId: string): Promise<Course[]>;
  listActiveCourses(): Promise<Course[]>;
  /** 추천 코스 후보: 완주한 사용자가 추천을 켠 코스 */
  listSharedCourses(): Promise<Course[]>;
  /** 완주 공유 링크로 코스 찾기 */
  findCourseByShareId(shareId: string): Promise<Course | null>;
  saveCourse(course: Course): Promise<void>;

  getDrop(id: string): Promise<Drop | null>;
  listDrops(courseId: string): Promise<Drop[]>;
  listDropsByUser(userId: string): Promise<Drop[]>;
  saveDrop(drop: Drop): Promise<void>;
  /** 상태가 from 중 하나일 때만 patch를 덮어쓴다 (동시 요청의 중복 생성 방지). 바뀐 Drop을 돌려주고, 아니면 null */
  claimDrop(id: string, from: Drop['status'][], patch: Partial<Drop>): Promise<Drop | null>;

  addUsage(log: UsageLog): Promise<void>;
  listUsage(sinceIso?: string): Promise<UsageLog[]>;
  addEvent(event: AppEvent): Promise<void>;
  listEvents(sinceIso?: string): Promise<AppEvent[]>;
  /** 이름이 같은 이벤트만 (sinceIso 이후). 오늘 push_sent 여부·Apple 알림 uuid 중복 확인 — events (name, at) 인덱스 */
  listEventsByName(name: string, sinceIso: string): Promise<AppEvent[]>;
  addReport(report: Report): Promise<void>;
  listReports(): Promise<Report[]>;
  addFailure(failure: FailureLog): Promise<void>;
  listFailures(): Promise<FailureLog[]>;
}

const globalForStore = globalThis as unknown as { __minicoveryStore?: Store };

/** SUPABASE_URL이 있으면 Supabase, 없으면 로컬 파일(.data/db.json) */
export function getStore(): Store {
  if (!globalForStore.__minicoveryStore) {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
    globalForStore.__minicoveryStore =
      SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
        ? new SupabaseStore(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        : new FileStore();
  }
  return globalForStore.__minicoveryStore;
}
