import { notFound } from 'next/navigation';

import { CourseScreen } from '@/components/screens/CourseScreen';
import { activeCourses, completedToday, openAllStatus, pickedCourseId } from '@/lib/service';
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
  const picked = pickedCourseId(user, await activeCourses(user.id));
  const openAll = openAllStatus(user);
  // 다음 달 1일 (전체 열기 확인 시트 문구)
  const nextMonth = (new Date(Date.now() + 9 * 3600_000).getUTCMonth() + 1) % 12 + 1;
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
      openAllNext={`${nextMonth}월 1일`}
    />
  );
}
