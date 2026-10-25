import { LegalPage } from '@/components/LegalPage';
import { SUPPORT_EMAIL } from '@/lib/constants';

/** App Store 지원 URL. 로그인 없이 열린다 */
export default function SupportPage() {
  return (
    <LegalPage
      title="고객 지원"
      updated="2026년 11월 1일"
      sections={[
        { h: '문의하기', p: [`궁금한 점이나 불편한 점은 ${SUPPORT_EMAIL} 로 메일 주세요. 보통 영업일 기준 2일 안에 답장드려요.`] },
        {
          h: 'Plus 구독 해지',
          p: ['구독은 Apple이 관리해요. 아이폰 설정 > 내 이름 > 구독 > 미니커버리에서 해지할 수 있어요. 무료 체험 중에 해지하면 결제되지 않아요.'],
        },
        { h: '구매 복원', p: ['기기를 바꿨거나 앱을 다시 설치했다면 Plus 안내 화면 아래의 ‘구매 복원’을 눌러 주세요.'] },
        { h: '환불', p: ['App Store 결제의 환불은 Apple이 처리해요. reportaproblem.apple.com 에서 요청할 수 있어요.'] },
        { h: '알림이 오지 않아요', p: ['아이폰 설정 > 알림 > 미니커버리에서 알림이 켜져 있는지 확인해 주세요. 밤 9시부터 아침 8시까지는 알림을 보내지 않아요.'] },
        { h: '계정 삭제', p: ['앱의 설정 > 계정 삭제에서 코스와 학습 기록, 계정 정보를 지울 수 있어요.'] },
        { h: '운영', p: [`미니멀 · ${SUPPORT_EMAIL}`] },
      ]}
    />
  );
}
