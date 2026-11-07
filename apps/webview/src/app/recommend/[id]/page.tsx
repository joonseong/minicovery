import { notFound } from 'next/navigation';

import { RecommendScreen } from '@/components/screens/RecommendScreen';
import { recommendedCourse } from '@/lib/learning';
import { LEVEL_LABEL } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** 추천 코스 미리보기 → 받지 않고 바로 열람 */
export default async function RecommendPage({ params }: { params: { id: string } }) {
  const course = await recommendedCourse(params.id);
  if (!course) notFound();
  return <RecommendScreen course={{ ...course, levelLabel: LEVEL_LABEL[course.level] }} />;
}
