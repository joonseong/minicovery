import { SupabaseClient, createClient } from '@supabase/supabase-js';

import type { AppEvent, Course, Drop, FailureLog, Report, SocialField, UsageLog, User } from '../types';
import type { Store } from './index';

type Rows = PromiseLike<{ data: { data: unknown }[] | null; error: unknown }>;

/** PostgREST는 한 번에 최대 1,000행(max-rows)만 주므로 이 크기로 나눠 받는다 */
const PAGE = 1000;

/**
 * 운영용 저장소. 테이블 구조는 supabase/migrations 참고.
 * 문서 전체를 data(jsonb)에 두고, 조회에 쓰는 값만 별도 열로 둔다.
 * 서버에서만 service role 키로 접근한다 (RLS로 클라이언트 접근 차단).
 */
export class SupabaseStore implements Store {
  private db: SupabaseClient;

  constructor(url: string, serviceRoleKey: string) {
    this.db = createClient(url, serviceRoleKey, { auth: { persistSession: false } });
  }

  private async one<T>(table: string, id: string): Promise<T | null> {
    const { data, error } = await this.db.from(table).select('data').eq('id', id).maybeSingle();
    if (error) throw error;
    return (data?.data as T) ?? null;
  }

  /** 조건에 맞는 첫 행 (빌더에 limit(1)을 둔다) */
  private async first<T>(query: Rows): Promise<T | null> {
    const { data, error } = await query;
    if (error) throw error;
    return (data?.[0]?.data as T) ?? null;
  }

  /**
   * 조건에 맞는 행 전부. 1,000건씩 range로 끊어 받으므로 빌더는 페이지마다 새로 만든다 (빌더는 1회용).
   * 페이지가 어긋나지 않게 빌더에는 반드시 순서가 정해지는 정렬(…·id)을 둔다
   */
  private async many<T>(build: (from: number, to: number) => Rows, max = Infinity): Promise<T[]> {
    const out: T[] = [];
    for (let from = 0; out.length < max; from += PAGE) {
      const size = Math.min(PAGE, max - out.length);
      const { data, error } = await build(from, from + size - 1);
      if (error) throw error;
      const rows = data ?? [];
      out.push(...rows.map(r => r.data as T));
      if (rows.length < size) break;
    }
    return out;
  }

  private async upsert(table: string, row: Record<string, unknown>) {
    const { error } = await this.db.from(table).upsert(row);
    if (error) throw error;
  }

  private async insert(table: string, row: Record<string, unknown>) {
    const { error } = await this.db.from(table).insert(row);
    if (error) throw error;
  }

  private async remove(table: string, column: string, value: string) {
    const { error } = await this.db.from(table).delete().eq(column, value);
    if (error) throw error;
  }

  getUser(id: string) {
    return this.one<User>('users', id);
  }
  saveUser(user: User) {
    return this.upsert('users', { id: user.id, email: user.email ?? null, data: user });
  }
  findUserByEmail(email: string) {
    return this.first<User>(this.db.from('users').select('data').eq('email', email).limit(1));
  }
  findUserBySocial(field: SocialField, id: string) {
    return this.first<User>(this.db.from('users').select('data').eq(`data->>${field}`, id).limit(1));
  }
  findUserByPlusTx(originalTxId: string) {
    return this.first<User>(this.db.from('users').select('data').eq('data->>plusOriginalTxId', originalTxId).limit(1));
  }
  findUserByResetHash(hash: string) {
    return this.first<User>(this.db.from('users').select('data').eq('data->passwordReset->>hash', hash).limit(1));
  }
  async countAnonUsersByIpSince(ipHash: string, sinceIso: string) {
    const { count, error } = await this.db
      .from('users')
      .select('id', { count: 'exact', head: true })
      .eq('data->>ipHash', ipHash)
      .gte('data->>createdAt', sinceIso);
    if (error) throw error;
    return count ?? 0;
  }
  listUsers() {
    return this.many<User>((from, to) => this.db.from('users').select('data').order('id').range(from, to));
  }
  async moveUserData(fromUserId: string, toUserId: string) {
    const { error } = await this.db.rpc('move_user_data', { from_user: fromUserId, to_user: toUserId });
    if (error) throw error;
  }
  async deleteUserData(userId: string) {
    // 사용량 로그는 비용 집계용으로 남긴다. 사용자 행은 맨 마지막에 지운다
    await this.remove('drops', 'user_id', userId);
    await this.remove('courses', 'user_id', userId);
    await this.remove('events', 'user_id', userId);
    await this.remove('reports', 'data->>userId', userId);
    await this.remove('failures', 'data->>userId', userId);
    await this.remove('users', 'id', userId);
  }

  getCourse(id: string) {
    return this.one<Course>('courses', id);
  }
  listCourses(userId: string) {
    return this.many<Course>((from, to) =>
      this.db.from('courses').select('data').eq('user_id', userId).order('created_at').order('id').range(from, to),
    );
  }
  listActiveCourses() {
    return this.many<Course>((from, to) => this.db.from('courses').select('data').eq('status', 'active').order('id').range(from, to));
  }
  listSharedCourses() {
    return this.many<Course>((from, to) =>
      this.db.from('courses').select('data').eq('status', 'completed').eq('data->>shared', 'true').order('id').range(from, to),
    );
  }
  findCourseByShareId(shareId: string) {
    return this.first<Course>(this.db.from('courses').select('data').eq('data->>shareId', shareId).limit(1));
  }
  saveCourse(course: Course) {
    return this.upsert('courses', {
      id: course.id,
      user_id: course.userId,
      status: course.status,
      created_at: course.createdAt,
      data: course,
    });
  }

  getDrop(id: string) {
    return this.one<Drop>('drops', id);
  }
  listDrops(courseId: string) {
    return this.many<Drop>((from, to) =>
      this.db.from('drops').select('data').eq('course_id', courseId).order('idx').order('id').range(from, to),
    );
  }
  listDropsByUser(userId: string) {
    return this.many<Drop>((from, to) =>
      this.db.from('drops').select('data').eq('user_id', userId).order('idx').order('id').range(from, to),
    );
  }
  saveDrop(drop: Drop) {
    return this.upsert('drops', {
      id: drop.id,
      course_id: drop.courseId,
      user_id: drop.userId,
      idx: drop.index,
      data: drop,
    });
  }
  async claimDrop(id: string, from: Drop['status'][], patch: Partial<Drop>) {
    // undefined 키는 null로 보내고 함수(claim_drop)가 jsonb_strip_nulls로 지운다 (batchId 해제 등)
    const jsonPatch = JSON.parse(JSON.stringify(patch, (_, value: unknown) => (value === undefined ? null : value))) as Record<string, unknown>;
    const { data, error } = await this.db.rpc('claim_drop', { drop_id: id, from_status: from, patch: jsonPatch });
    if (error) throw error;
    return (data as Drop | null) ?? null;
  }

  addUsage(log: UsageLog) {
    return this.insert('usage_logs', { id: log.id, user_id: log.userId, at: log.at, data: log });
  }
  listUsage(sinceIso?: string) {
    return this.many<UsageLog>((from, to) => {
      const q = this.db.from('usage_logs').select('data');
      return (sinceIso ? q.gte('at', sinceIso) : q).order('at').order('id').range(from, to);
    });
  }
  addEvent(event: AppEvent) {
    return this.insert('events', { id: event.id, user_id: event.userId, name: event.name, at: event.at, data: event });
  }
  listEvents(sinceIso?: string) {
    return this.many<AppEvent>((from, to) => {
      const q = this.db.from('events').select('data');
      return (sinceIso ? q.gte('at', sinceIso) : q).order('at').order('id').range(from, to);
    });
  }
  listEventsByName(name: string, sinceIso: string) {
    return this.many<AppEvent>((from, to) =>
      this.db.from('events').select('data').eq('name', name).gte('at', sinceIso).order('at').order('id').range(from, to),
    );
  }
  addReport(report: Report) {
    return this.insert('reports', { id: report.id, at: report.at, data: report });
  }
  listReports() {
    return this.many<Report>((from, to) =>
      this.db.from('reports').select('data').order('at', { ascending: false }).order('id').range(from, to),
    );
  }
  addFailure(failure: FailureLog) {
    return this.insert('failures', { id: failure.id, at: failure.at, data: failure });
  }
  listFailures() {
    return this.many<FailureLog>(
      (from, to) => this.db.from('failures').select('data').order('at', { ascending: false }).order('id').range(from, to),
      200,
    );
  }
}
