import { notFound } from 'next/navigation';

import { RecommendScreen } from '@/components/screens/RecommendScreen';
import { recommendedCourse } from '@/lib/learning';
import { courseQuota, isPlus, plusUsage } from '@/lib/service';
import { currentUser } from '@/lib/session';
import { getStore } from '@/lib/store';
import { LEVEL_LABEL } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** 추천 코스 미리보기 → 받기 */
export default async function RecommendPage({ params, searchParams }: { params: { id: string }; searchParams: { replace?: string } }) {
  const user = await currentUser();
  const course = await recommendedCourse(params.id);
  if (!course) notFound();
  const quota = await courseQuota(user);
  const current = (await getStore().listCourses(user.id)).find(c => c.status === 'active' && !c.openedAllAt);
  return (
    <RecommendScreen
      course={{ ...course, levelLabel: LEVEL_LABEL[course.level] }}
      quota={quota.ok ? 'ok' : quota.reason}
      currentTopic={current?.topic}
      replace={searchParams.replace === '1'}
      plus={isPlus(user)}
      resetLabel={(await plusUsage(user))?.resetLabel}
    />
  );
}
