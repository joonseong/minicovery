import { redirect } from 'next/navigation';

import { TodayScreen } from '@/components/screens/TodayScreen';
import { recommendedCourses } from '@/lib/learning';
import { currentUser } from '@/lib/session';
import { todayData } from '@/lib/views';

export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const user = await currentUser();
  // 둘은 서로 기다릴 필요가 없어 함께 읽는다 (탭 이동 시간 줄이기)
  const [data, recommended] = await Promise.all([todayData(user), recommendedCourses(user)]);
  if (data.cards.length === 0 && !data.doneToday && (user.learned?.length ?? 0) === 0) redirect('/start');
  return <TodayScreen {...data} recommended={recommended.items} recommendedMore={recommended.hasMore} />;
}
