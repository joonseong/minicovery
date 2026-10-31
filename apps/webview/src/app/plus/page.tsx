import { type PaywallFrom, PaywallScreen } from '@/components/screens/PaywallScreen';
import { isPlus, plusUsage, stageOf } from '@/lib/service';
import { currentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

const FROMS: PaywallFrom[] = ['done', 'keep', 'profile'];

export default async function PlusPage({ searchParams }: { searchParams: { from?: string } }) {
  const user = await currentUser();
  const from = FROMS.find(f => f === searchParams.from) ?? 'profile';
  return (
    <PaywallScreen
      stageKey={stageOf(user).key}
      plus={isPlus(user)}
      beta={process.env.PLUS_BETA_FREE === 'true'}
      accountToken={user.id}
      from={from}
      usage={await plusUsage(user)}
    />
  );
}
