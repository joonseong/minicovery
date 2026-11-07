import { notFound } from 'next/navigation';

import { SharedDropScreen } from '@/components/screens/SharedDropScreen';
import { sharedDrop } from '@/lib/learning';
import { currentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

/** 다른 사람이 만든 추천 코스의 Drop 열람 (n은 1부터) */
export default async function SharedDropPage({ params }: { params: { id: string; n: string } }) {
  const drop = await sharedDrop(params.id, Number(params.n), await currentUser());
  if (!drop) notFound();
  return <SharedDropScreen drop={drop} />;
}
