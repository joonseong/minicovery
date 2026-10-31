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

  addUsage(log: UsageLog): Promise<void>;
  listUsage(sinceIso?: string): Promise<UsageLog[]>;
  addEvent(event: AppEvent): Promise<void>;
  listEvents(sinceIso?: string): Promise<AppEvent[]>;
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
