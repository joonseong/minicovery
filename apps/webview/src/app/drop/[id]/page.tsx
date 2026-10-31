import { notFound, redirect } from 'next/navigation';

import { DropScreen } from '@/components/screens/DropScreen';
import { recallFor } from '@/lib/learning';
import { canOpenDrop } from '@/lib/service';
import { currentUser } from '@/lib/session';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function DropPage({ params }: { params: { id: string } }) {
  const user = await currentUser();
  const store = getStore();
  const drop = await store.getDrop(params.id);
  if (!drop || drop.userId !== user.id) notFound();
  // 하루 한 편: 오늘 열 수 없는 Drop은 오늘 화면으로 (건너뛴 Drop은 안내만 보여 준다)
  if (drop.status !== 'skipped' && !(await canOpenDrop(user, drop))) redirect('/today');
  const course = (await store.getCourse(drop.courseId))!;
  // 건너뜀 안내의 '다음 Drop 읽기': 이 Drop 다음의, 아직 안 읽고 건너뛰지 않은 Drop
  const next = (await store.listDrops(course.id)).find(d => d.index > drop.index && !d.completedAt && d.status !== 'skipped');
  return (
    <DropScreen
      initialDrop={drop}
      courseTitle={course.title}
      total={course.outline.length}
      recall={await recallFor(user, drop)}
      nextDropId={next?.id}
      openedAll={Boolean(course.openedAllAt)}
    />
  );
}
