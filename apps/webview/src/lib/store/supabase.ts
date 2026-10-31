import { SupabaseClient, createClient } from '@supabase/supabase-js';

import type { AppEvent, Course, Drop, FailureLog, Report, SocialField, UsageLog, User } from '../types';
import type { Store } from './index';

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

  private async many<T>(query: PromiseLike<{ data: { data: unknown }[] | null; error: unknown }>): Promise<T[]> {
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map(r => r.data as T);
  }

  private async upsert(table: string, row: Record<string, unknown>) {
    const { error } = await this.db.from(table).upsert(row);
    if (error) throw error;
  }

  private async insert(table: string, row: Record<string, unknown>) {
    const { error } = await this.db.from(table).insert(row);
    if (error) throw error;
  }

  getUser(id: string) {
    return this.one<User>('users', id);
  }
  saveUser(user: User) {
    return this.upsert('users', { id: user.id, email: user.email ?? null, data: user });
  }
  async findUserByEmail(email: string) {
    const rows = await this.many<User>(this.db.from('users').select('data').eq('email', email).limit(1));
    return rows[0] ?? null;
  }
  async findUserBySocial(field: SocialField, id: string) {
    const rows = await this.many<User>(this.db.from('users').select('data').eq(`data->>${field}`, id).limit(1));
    return rows[0] ?? null;
  }
  listUsers() {
    return this.many<User>(this.db.from('users').select('data'));
  }
  async moveUserData(fromUserId: string, toUserId: string) {
    const { error } = await this.db.rpc('move_user_data', { from_user: fromUserId, to_user: toUserId });
    if (error) throw error;
  }

  getCourse(id: string) {
    return this.one<Course>('courses', id);
  }
  listCourses(userId: string) {
    return this.many<Course>(this.db.from('courses').select('data').eq('user_id', userId).order('created_at'));
  }
  listActiveCourses() {
    return this.many<Course>(this.db.from('courses').select('data').eq('status', 'active'));
  }
  listSharedCourses() {
    return this.many<Course>(this.db.from('courses').select('data').eq('status', 'completed').eq('data->>shared', 'true'));
  }
  async findCourseByShareId(shareId: string) {
    const rows = await this.many<Course>(this.db.from('courses').select('data').eq('data->>shareId', shareId).limit(1));
    return rows[0] ?? null;
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
    return this.many<Drop>(this.db.from('drops').select('data').eq('course_id', courseId).order('idx'));
  }
  listDropsByUser(userId: string) {
    return this.many<Drop>(this.db.from('drops').select('data').eq('user_id', userId));
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

  addUsage(log: UsageLog) {
    return this.insert('usage_logs', { id: log.id, user_id: log.userId, at: log.at, data: log });
  }
  listUsage(sinceIso?: string) {
    const q = this.db.from('usage_logs').select('data');
    return this.many<UsageLog>(sinceIso ? q.gte('at', sinceIso) : q);
  }
  addEvent(event: AppEvent) {
    return this.insert('events', { id: event.id, user_id: event.userId, name: event.name, at: event.at, data: event });
  }
  listEvents(sinceIso?: string) {
    const q = this.db.from('events').select('data');
    return this.many<AppEvent>(sinceIso ? q.gte('at', sinceIso) : q);
  }
  addReport(report: Report) {
    return this.insert('reports', { id: report.id, at: report.at, data: report });
  }
  listReports() {
    return this.many<Report>(this.db.from('reports').select('data').order('at', { ascending: false }));
  }
  addFailure(failure: FailureLog) {
    return this.insert('failures', { id: failure.id, at: failure.at, data: failure });
  }
  listFailures() {
    return this.many<FailureLog>(this.db.from('failures').select('data').order('at', { ascending: false }).limit(200));
  }
}
