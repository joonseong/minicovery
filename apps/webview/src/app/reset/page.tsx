import { ResetScreen } from '@/components/screens/ResetScreen';

/** 메일 링크 /reset?token= 으로 들어와 새 비밀번호를 정한다 */
export default function ResetPage({ searchParams }: { searchParams: { token?: string } }) {
  return <ResetScreen token={searchParams.token ?? ''} />;
}
