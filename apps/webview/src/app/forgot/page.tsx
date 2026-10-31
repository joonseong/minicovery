import { ForgotScreen } from '@/components/screens/ForgotScreen';

/** 비밀번호 재설정 메일 요청 (로그인 화면의 '비밀번호를 잊으셨나요?') */
export default function ForgotPage({ searchParams }: { searchParams: { email?: string } }) {
  return <ForgotScreen initialEmail={searchParams.email ?? ''} />;
}
