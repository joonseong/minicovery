import { WeekReviewScreen } from '@/components/screens/WeekReviewScreen';
import { weekReview } from '@/lib/learning';
import { currentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** 이번 주 복습: 이번 주에 읽은 Drop의 '한 문장으로' */
export default async function ReviewPage() {
  const user = await currentUser();
  return <WeekReviewScreen {...await weekReview(user)} />;
}
