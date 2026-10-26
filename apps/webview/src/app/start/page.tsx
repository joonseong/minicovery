import { StartScreen } from '@/components/screens/StartScreen';
import { SUGGESTED_TOPICS } from '@/lib/constants';
import { courseQuota, plusUsage } from '@/lib/service';
import { currentUser } from '@/lib/session';
import { getStore } from '@/lib/store';

export const dynamic = 'force-dynamic';

export default async function StartPage({ searchParams }: { searchParams: { topic?: string; replace?: string } }) {
  const user = await currentUser();
  const quota = await courseQuota(user);
  const current = (await getStore().listCourses(user.id)).find(c => c.status === 'active');
  return (
    <StartScreen
      initialTopic={searchParams.topic ?? ''}
      suggestions={SUGGESTED_TOPICS}
      quota={quota.ok ? 'ok' : quota.reason}
      currentTopic={current?.topic}
      resetLabel={(await plusUsage(user))?.resetLabel}
      replace={searchParams.replace === '1'}
    />
  );
}
