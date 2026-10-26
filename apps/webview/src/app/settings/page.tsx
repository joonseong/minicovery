import { SettingsScreen } from '@/components/screens/SettingsScreen';
import { isPlus, kstDayLabel } from '@/lib/service';
import { currentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await currentUser();
  return (
    <SettingsScreen
      notifyOn={user.notifyPermission === 'granted'}
      notifyTime={user.notifyTime ?? '08:00'}
      account={user.anon ? null : user.appleSub ? 'Apple' : user.email ?? '이메일'}
      plus={isPlus(user)}
      renewLabel={user.plusExpiresAt ? kstDayLabel(user.plusExpiresAt) : undefined}
      version={process.env.NEXT_PUBLIC_APP_VERSION ?? '1.0.0'}
    />
  );
}
