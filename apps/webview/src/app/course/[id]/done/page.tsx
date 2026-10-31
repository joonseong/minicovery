import { notFound } from 'next/navigation';

import { CourseDoneScreen } from '@/components/screens/CourseDoneScreen';
import { isPlus, stageOf } from '@/lib/service';
import { currentUser } from '@/lib/session';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function CourseDonePage({ params }: { params: { id: string } }) {
  const user = await currentUser();
  const course = await getStore().getCourse(params.id);
  if (!course || course.userId !== user.id) notFound();
  const stage = stageOf(user);
  return (
    <CourseDoneScreen
      courseId={course.id}
      learnedCount={stage.learned}
      stageKey={stage.key}
      next={stage.next}
      related={course.related}
      plus={isPlus(user)}
      first={stage.learned === 1}
      answer={course.explainAnswer ?? null}
      shared={Boolean(course.shared)}
      copied={Boolean(course.copiedFrom)}
    />
  );
}
