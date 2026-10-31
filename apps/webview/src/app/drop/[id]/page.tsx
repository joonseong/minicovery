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
  // 하루 한 편: 오늘 열 수 없는 Drop은 오늘 화면으로
  if (!(await canOpenDrop(user, drop))) redirect('/today');
  const course = (await store.getCourse(drop.courseId))!;
  return <DropScreen initialDrop={drop} courseTitle={course.title} total={course.outline.length} recall={await recallFor(user, drop)} />;
}
