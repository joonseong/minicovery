import { redirect } from 'next/navigation';

import { TodayScreen } from '@/components/screens/TodayScreen';
import { recommendedCourses } from '@/lib/learning';
import { currentUser } from '@/lib/session';
import { todayData } from '@/lib/views';

export const dynamic = 'force-dynamic';

export default async function TodayPage() {
  const user = await currentUser();
  const data = await todayData(user);
  if (data.cards.length === 0 && !data.doneToday && (user.learned?.length ?? 0) === 0) redirect('/start');
  const recommended = await recommendedCourses(user);
  return <TodayScreen {...data} recommended={recommended.items} recommendedMore={recommended.hasMore} />;
}
