import { notFound } from 'next/navigation';

import { CourseScreen } from '@/components/screens/CourseScreen';
import { activeCourses, canReadCourseToday, dailyState, isPlus, openAllStatus, pickedCourseId, plusUsage } from '@/lib/service';
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
  const next = drops.find(d => !d.completedAt && d.status !== 'skipped');
  const state = await dailyState(user);
  const items = await activeCourses(user.id);
  const picked = pickedCourseId(user, items, state.readToday);
  // 오늘 이 코스를 더 못 읽으면 '내일' (무료는 하루 한 편, Plus는 코스마다 한 편씩 하루 2편)
  const doneToday = !canReadCourseToday(state, course.id);
  const plus = isPlus(user);
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
      category={course.category}
      drops={drops.map(d => ({ id: d.id, index: d.index, title: d.title, done: Boolean(d.completedAt), skipped: d.status === 'skipped' }))}
      nextId={course.status === 'active' ? next?.id : undefined}
      doneToday={doneToday}
      // Plus는 고를 필요 없이 오늘 읽을 수 있는 코스면 바로 읽는다
      isPicked={plus ? !doneToday : picked === course.id}
      isTomorrow={isTomorrow}
      multiple={items.filter(i => !i.course.openedAllAt).length > 1}
      completed={course.status === 'completed'}
      openedAll={Boolean(course.openedAllAt)}
      canOpenAll={openAll.available}
      openAllNext={usage?.resetLabel ?? ''}
      // Plus인데 이번 달 전체 열기를 이미 썼으면 비활성 줄로 남긴다
      openAllUsedUntil={plus && !openAll.available ? openAll.nextLabel ?? usage?.resetLabel : undefined}
      nextTomorrowTopic={nextTomorrow}
      shared={Boolean(course.shared)}
      copied={Boolean(course.copiedFrom)}
    />
  );
}
