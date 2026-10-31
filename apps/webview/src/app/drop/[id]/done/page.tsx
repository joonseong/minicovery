import { notFound } from 'next/navigation';

import { DropDoneScreen } from '@/components/screens/DropDoneScreen';
import { activeCourses, isPlus, plusUsage, weekDone } from '@/lib/service';
import { currentUser } from '@/lib/session';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function DropDonePage({ params }: { params: { id: string } }) {
  const user = await currentUser();
  const store = getStore();
  const drop = await store.getDrop(params.id);
  if (!drop || drop.userId !== user.id) notFound();
  const course = (await store.getCourse(drop.courseId))!;
  const courseDrops = await store.listDrops(course.id);
  const items = await activeCourses(user.id);
  const courses = items
    .filter(i => i.next && !i.course.openedAllAt)
    .map(i => ({ id: i.course.id, topic: i.course.topic, index: i.next!.index, total: i.course.outline.length, title: i.next!.title }));
  const tomorrowId = courses.some(c => c.id === user.tomorrowCourseId) ? user.tomorrowCourseId! : courses[0]?.id;
  const week = await weekDone(user.id);
  // 전체 열린 코스면 바로 이어 읽을 다음 Drop (건너뛴 Drop은 빼고)
  const next = course.openedAllAt ? courseDrops.find(d => d.index > drop.index && !d.completedAt && d.status !== 'skipped') : undefined;
  // 이번 주 학습일 기준 진행 (7일 중)
  return (
    <DropDoneScreen
      courseId={course.id}
      courseTitle={course.title}
      dropTitle={drop.title}
      week={week}
      courses={courses}
      tomorrowId={tomorrowId}
      plus={isPlus(user)}
      usage={await plusUsage(user)}
      currentTopic={course.topic}
      courseDone={courseDrops.filter(d => d.completedAt).length}
      openedAll={Boolean(course.openedAllAt)}
      dropIndex={drop.index}
      nextDropId={next?.id}
    />
  );
}
