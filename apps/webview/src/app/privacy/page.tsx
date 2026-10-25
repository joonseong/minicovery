import { LegalPage } from '@/components/LegalPage';
import { SUPPORT_EMAIL } from '@/lib/constants';

export default function PrivacyPage() {
  return (
    <LegalPage
      title="개인정보 처리방침"
      updated="2026년 11월 1일"
      sections={[
        {
          h: '1. 모으는 정보',
          p: [
            '가입 전: 기기를 구분하는 임의의 식별자(쿠키), 만든 코스와 읽은 Drop 기록, 알림을 켠 경우 푸시 토큰과 알림 시간.',
            '가입 후: 위 정보에 더해 이메일 주소(이메일 가입), 또는 카카오·Google·Apple이 제공하는 사용자 식별자와 이메일(소셜 로그인. 카카오는 이메일 제공에 동의한 경우에만).',
            'Plus를 구독하면: App Store 구독 거래 번호와 만료일. 결제 수단 정보는 Apple이 처리하고 우리는 받지 않아요.',
            '서비스 품질을 위해 화면 이용 기록(예: Drop 완료, 알림 열람)과 오류 기록을 모아요.',
          ],
        },
        {
          h: '2. 쓰는 곳',
          p: ['코스와 Drop을 만들고 학습 기록을 보여 주는 데 써요.', '하루 한 번 다음 Drop 알림을 보내는 데 써요.', '서비스를 고치고 개선하는 통계에 써요.'],
        },
        {
          h: '3. 맡기는 곳',
          p: [
            '코스와 Drop 글은 Anthropic의 Claude API로 만들어요. 이때 입력한 주제와 학습 수준이 전달되고, 이메일 등 계정 정보는 전달하지 않아요.',
            '데이터는 Supabase(서울 리전)에 저장하고, 서버는 Vercel에서 운영해요.',
            '알림은 Google Firebase Cloud Messaging과 Apple 푸시 알림 서비스로 보내요. 이때 푸시 토큰과 알림 내용(코스 이름, Drop 첫 문장)이 전달돼요.',
          ],
        },
        {
          h: '4. 보관과 삭제',
          p: [
            '설정 > 계정 삭제(또는 학습 기록 지우기)를 누르면 코스, Drop, 학습 기록, 계정 정보를 지워요.',
            '법령에 따라 보관해야 하는 정보는 정해진 기간 동안만 보관해요.',
          ],
        },
        { h: '5. 개인정보 보호책임자와 문의', p: [`운영자 및 개인정보 보호책임자: 미니멀`, `개인정보 관련 문의: ${SUPPORT_EMAIL}`] },
      ]}
    />
  );
}
