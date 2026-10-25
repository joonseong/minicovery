import { PaywallScreen } from '@/components/screens/PaywallScreen';
import { isPlus, stageOf } from '@/lib/service';
import { currentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function PlusPage() {
  const user = await currentUser();
  return <PaywallScreen stageKey={stageOf(user).key} plus={isPlus(user)} beta={process.env.PLUS_BETA_FREE === 'true'} accountToken={user.id} />;
}
