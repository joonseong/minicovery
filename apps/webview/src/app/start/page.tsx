import { StartScreen } from '@/components/screens/StartScreen';
import { SUGGESTED_TOPICS } from '@/lib/constants';
import { recommendedCourses } from '@/lib/learning';
import { courseQuota, plusUsage } from '@/lib/service';
import { currentUser } from '@/lib/session';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function StartPage({
  searchParams,
}: {
  searchParams: { topic?: string; replace?: string; go?: string; deleted?: string; logout?: string };
}) {
  const user = await currentUser();
  const quota = await courseQuota(user);
  const current = (await getStore().listCourses(user.id)).find(c => c.status === 'active');
  // 계정 삭제·로그아웃 직후 한 번 보여 주는 안내
  const notice = searchParams.deleted === '1' ? '계정과 학습 기록을 지웠어요' : searchParams.logout === '1' ? '로그아웃했어요. 기록은 계정에 남아 있어요' : undefined;
  return (
    <StartScreen
      initialTopic={searchParams.topic ?? ''}
      suggestions={SUGGESTED_TOPICS}
      quota={quota.ok ? 'ok' : quota.reason}
      currentTopic={current?.topic}
      resetLabel={(await plusUsage(user))?.resetLabel}
      recommended={await recommendedCourses(user)}
      replace={searchParams.replace === '1'}
      autoGo={searchParams.go === '1'}
      notice={notice}
    />
  );
}
