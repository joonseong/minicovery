import { SettingsScreen } from '@/components/screens/SettingsScreen';
import { isPlus, kstDayLabel, plusUsage } from '@/lib/service';
import { currentUser } from '@/lib/session';

export const dynamic = 'force-dynamic';

export default async function SettingsPage() {
  const user = await currentUser();
  const plus = isPlus(user);
  return (
    <SettingsScreen
      notifyOn={user.notifyPermission === 'granted'}
      notifyTime={user.notifyTime ?? '08:00'}
      account={user.anon ? null : user.appleSub ? 'Apple' : user.kakaoId ? '카카오' : user.googleSub ? 'Google' : user.email ?? '이메일'}
      plus={plus}
      renewLabel={user.plusExpiresAt ? kstDayLabel(user.plusExpiresAt) : undefined}
      autoRenew={user.plusAutoRenew}
      usage={plus ? await plusUsage(user) : null}
      version={process.env.NEXT_PUBLIC_APP_VERSION ?? '1.0.0'}
    />
  );
}
