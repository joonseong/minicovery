import fs from 'node:fs';
import path from 'node:path';

import type { AppEvent, Course, Drop, FailureLog, Report, SocialField, UsageLog, User } from '../types';
import type { Store } from './index';

interface Db {
  users: Record<string, User>;
  courses: Record<string, Course>;
  drops: Record<string, Drop>;
  usage: UsageLog[];
  events: AppEvent[];
  reports: Report[];
  failures: FailureLog[];
}

const empty = (): Db => ({ users: {}, courses: {}, drops: {}, usage: [], events: [], reports: [], failures: [] });

/** 개발용 저장소. 프로세스 메모리에 두고 변경될 때마다 JSON 파일로 쓴다. */
export class FileStore implements Store {
  private file: string;
  private db: Db;

  constructor(file = process.env.FILE_STORE_PATH ?? path.join(process.cwd(), '.data', 'db.json')) {
    this.file = file;
    this.db = fs.existsSync(file) ? { ...empty(), ...JSON.parse(fs.readFileSync(file, 'utf8')) } : empty();
  }

  private persist() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = `${this.file}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(this.db));
    fs.renameSync(tmp, this.file);
  }

  async getUser(id: string) {
    return this.db.users[id] ?? null;
  }
  async saveUser(user: User) {
    this.db.users[user.id] = user;
    this.persist();
  }
  async findUserByEmail(email: string) {
    return Object.values(this.db.users).find(u => u.email === email) ?? null;
  }
  async findUserBySocial(field: SocialField, id: string) {
    return Object.values(this.db.users).find(u => u[field] === id) ?? null;
  }
  async listUsers() {
    return Object.values(this.db.users);
  }
  async moveUserData(fromUserId: string, toUserId: string) {
    for (const c of Object.values(this.db.courses)) if (c.userId === fromUserId) c.userId = toUserId;
    for (const d of Object.values(this.db.drops)) if (d.userId === fromUserId) d.userId = toUserId;
    for (const e of this.db.events) if (e.userId === fromUserId) e.userId = toUserId;
    for (const u of this.db.usage) if (u.userId === fromUserId) u.userId = toUserId;
    this.persist();
  }

  async getCourse(id: string) {
    return this.db.courses[id] ?? null;
  }
  async listCourses(userId: string) {
    return Object.values(this.db.courses)
      .filter(c => c.userId === userId)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  }
  async listActiveCourses() {
    return Object.values(this.db.courses).filter(c => c.status === 'active');
  }
  async listSharedCourses() {
    return Object.values(this.db.courses).filter(c => c.status === 'completed' && c.shared);
  }
  async findCourseByShareId(shareId: string) {
    return Object.values(this.db.courses).find(c => c.shareId === shareId) ?? null;
  }
  async saveCourse(course: Course) {
    this.db.courses[course.id] = course;
    this.persist();
  }

  async getDrop(id: string) {
    return this.db.drops[id] ?? null;
  }
  async listDrops(courseId: string) {
    return Object.values(this.db.drops)
      .filter(d => d.courseId === courseId)
      .sort((a, b) => a.index - b.index);
  }
  async listDropsByUser(userId: string) {
    return Object.values(this.db.drops).filter(d => d.userId === userId);
  }
  async saveDrop(drop: Drop) {
    this.db.drops[drop.id] = drop;
    this.persist();
  }

  async addUsage(log: UsageLog) {
    this.db.usage.push(log);
    this.persist();
  }
  async listUsage(sinceIso?: string) {
    return sinceIso ? this.db.usage.filter(u => u.at >= sinceIso) : this.db.usage;
  }
  async addEvent(event: AppEvent) {
    this.db.events.push(event);
    this.persist();
  }
  async listEvents(sinceIso?: string) {
    return sinceIso ? this.db.events.filter(e => e.at >= sinceIso) : this.db.events;
  }
  async addReport(report: Report) {
    this.db.reports.push(report);
    this.persist();
  }
  async listReports() {
    return this.db.reports;
  }
  async addFailure(failure: FailureLog) {
    this.db.failures.push(failure);
    this.persist();
  }
  async listFailures() {
    return this.db.failures;
  }
}
