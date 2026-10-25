import { CATEGORIES } from './constants';
import { activeCourses, completedToday, courseQuota, isPlus, pickedCourseId, stageOf, weekDone } from './service';
import { getStore } from './store';
import type { Course, User } from './types';
import { kstDate } from './util';

/** 화면이 그리는 데 필요한 값만 모은다 (서버 컴포넌트에서 호출) */

export interface CourseCard {
  id: string;
  title: string;
  topic: string;
  category: string;
  total: number;
  done: number;
  nextDropId?: string;
  nextTitle?: string;
  /** 다음 Drop이 이미 만들어져 있음 (야간 생성) */
  ready: boolean;
}

function card(course: Course, drops: { id: string; title: string; completedAt?: string; status: string }[]): CourseCard {
  const next = drops.find(d => !d.completedAt);
  return {
    id: course.id,
    title: course.title,
    topic: course.topic,
    category: course.category,
    total: course.outline.length,
    done: drops.filter(d => d.completedAt).length,
    nextDropId: next?.id,
    nextTitle: next?.title,
    ready: next?.status === 'ready',
  };
}

export async function todayData(user: User) {
  const store = getStore();
  const items = await activeCourses(user.id);
  const cards: CourseCard[] = [];
  for (const i of items) if (!i.course.openedAllAt) cards.push(card(i.course, await store.listDrops(i.course.id)));
  const doneDrop = await completedToday(user.id);
  const week = await weekDone(user.id);
  const tomorrowId = user.tomorrowCourseId && cards.some(c => c.id === user.tomorrowCourseId) ? user.tomorrowCourseId : cards[0]?.id;
  const now = new Date(Date.now() + 9 * 3600_000);
  const dateLabel = `${now.getUTCMonth() + 1}월 ${now.getUTCDate()}일 ${'일월화수목금토'[now.getUTCDay()]}요일`;
  return {
    dateLabel,
    cards,
    pickedId: pickedCourseId(user, items),
    doneToday: doneDrop ? { dropId: doneDrop.id, title: doneDrop.title, courseId: doneDrop.courseId } : null,
    tomorrow: cards.find(c => c.id === tomorrowId) ?? null,
    weekDays: week.filter(Boolean).length,
    stage: stageOf(user),
    showNotifyBanner:
      user.notifyPermission === 'denied' &&
      (!user.notifyBannerDismissedAt || Date.now() - Date.parse(user.notifyBannerDismissedAt) > 7 * 86_400_000),
  };
}

export async function libraryData(user: User) {
  const store = getStore();
  const courses = (await store.listCourses(user.id)).filter(c => c.status === 'active' || c.status === 'completed');
  const active: CourseCard[] = [];
  const done: CourseCard[] = [];
  for (const c of courses.sort((a, b) => b.createdAt.localeCompare(a.createdAt))) {
    const k = card(c, await store.listDrops(c.id));
    (c.status === 'completed' ? done : active).push(k);
  }
  return { active, done, stage: stageOf(user), plus: isPlus(user), email: user.email, anon: user.anon, quota: await courseQuota(user) };
}

export type MapPlace = { name: string; state: 'done' | 'going' | 'here' | 'fog'; status: string; href: string };
export type MapRegion = { name: string; places: MapPlace[]; done: number };

/** 내 학습: 분야별로 다 배움 / 배우는 중 / 다음 추천 */
export async function mapData(user: User) {
  const store = getStore();
  const courses = (await store.listCourses(user.id)).filter(c => c.status === 'active' || c.status === 'completed');
  const items = await activeCourses(user.id);
  const picked = pickedCourseId(user, items);
  const learned = user.learned ?? [];
  const regions = new Map<string, MapPlace[]>();
  const add = (category: string, place: MapPlace) => {
    const key = (CATEGORIES as readonly string[]).includes(category) ? category : '기타';
    const list = regions.get(key) ?? [];
    if (!list.some(p => p.name === place.name)) list.push(place);
    regions.set(key, list);
  };

  for (const l of learned) add(l.category, { name: l.topic, state: 'done', status: '다 배움', href: '/library' });
  let going = 0;
  let closest: { course: Course; done: number; total: number } | null = null;
  for (const c of courses.filter(c => c.status === 'active')) {
    const drops = await store.listDrops(c.id);
    const done = drops.filter(d => d.completedAt).length;
    going++;
    add(c.category, {
      name: c.topic,
      state: c.id === picked ? 'here' : 'going',
      status: `배우는 중 · Drop ${Math.min(done + 1, c.outline.length)} / ${c.outline.length}`,
      href: `/course/${c.id}`,
    });
    const left = c.outline.length - done;
    if (!closest || left < closest.total - closest.done) closest = { course: c, done, total: c.outline.length };
  }
  let fog = 0;
  for (const c of courses) {
    for (const r of c.related) {
      const before = regions.get(c.category)?.length ?? 0;
      add(c.category, { name: r, state: 'fog', status: '다음 추천 · 눌러서 코스 만들기', href: `/start?topic=${encodeURIComponent(r)}` });
      if ((regions.get(c.category)?.length ?? 0) > before) fog++;
    }
  }
  const order = { done: 0, here: 1, going: 2, fog: 3 } as const;
  const list: MapRegion[] = [...regions.entries()].map(([name, places]) => ({
    name,
    places: places.sort((a, b) => order[a.state] - order[b.state]),
    done: places.filter(p => p.state === 'done').length,
  }));
  return {
    stage: stageOf(user),
    learnedCount: learned.length,
    going,
    fog,
    closest: closest
      ? { id: closest.course.id, topic: closest.course.topic, category: closest.course.category, done: closest.done, total: closest.total }
      : null,
    regions: list.sort((a, b) => b.done - a.done || b.places.length - a.places.length),
  };
}

export const todayKst = () => kstDate();
