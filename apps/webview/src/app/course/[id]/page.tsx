import { notFound } from 'next/navigation';

import { CourseScreen } from '@/components/screens/CourseScreen';
import { activeCourses, completedToday, openAllStatus, pickedCourseId, plusUsage } from '@/lib/service';
import { currentUser } from '@/lib/session';
import { getStore } from '@/lib/store';
import { LEVEL_LABEL } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function CoursePage({ params }: { params: { id: string } }) {
  const user = await currentUser();
  const store = getStore();
  const course = await store.getCourse(params.id);
  if (!course || course.userId !== user.id || course.status === 'deleted') notFound();
  const drops = await store.listDrops(course.id);
  const next = drops.find(d => !d.completedAt);
  const doneToday = await completedToday(user.id);
  const items = await activeCourses(user.id);
  const picked = pickedCourseId(user, items);
  const openAll = openAllStatus(user);
  const usage = await plusUsage(user);
  // 내일 받을 코스를 전체 열면 다른 진행 중 코스로 넘어간다 (openAllCourse와 같은 규칙)
  const isTomorrow = (user.tomorrowCourseId ?? items.find(i => !i.course.openedAllAt)?.course.id) === course.id;
  const nextTomorrow = isTomorrow ? items.find(i => i.course.id !== course.id && !i.course.openedAllAt)?.course.topic : undefined;
  return (
    <CourseScreen
      courseId={course.id}
      title={course.title}
      meta={`${LEVEL_LABEL[course.level]} · ${course.category}`}
      drops={drops.map(d => ({ id: d.id, index: d.index, title: d.title, done: Boolean(d.completedAt) }))}
      nextId={course.status === 'active' ? next?.id : undefined}
      doneToday={Boolean(doneToday)}
      isPicked={picked === course.id}
      isTomorrow={user.tomorrowCourseId === course.id}
      completed={course.status === 'completed'}
      openedAll={Boolean(course.openedAllAt)}
      canOpenAll={openAll.available}
      openAllNext={usage?.resetLabel ?? ''}
      nextTomorrowTopic={nextTomorrow}
    />
  );
}
