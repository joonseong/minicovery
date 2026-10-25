import { Platform } from 'react-native';

/**
 * 웹뷰가 여는 주소. 개발 중에는 로컬 Next 서버(apps/webview, 포트 3100).
 * 안드로이드 에뮬레이터에서 호스트 PC는 10.0.2.2.
 * 운영은 Vercel 프로젝트 'minicovery'. 도메인을 사면 그 주소로 바꾼다.
 */
const DEV_URL = Platform.OS === 'android' ? 'http://10.0.2.2:3100' : 'http://localhost:3100';
const PROD_URL = 'https://minicovery.vercel.app';

export const WEB_URL = __DEV__ ? DEV_URL : PROD_URL;

/**
 * 소셜 로그인. 값이 비어 있으면 그 버튼을 웹에 알리지 않는다 (웹은 버튼을 숨긴다).
 * - 카카오: ios/Minicovery/Info.plist의 KAKAO_APP_KEY와 URL 스킴 kakao{네이티브 앱 키}도 함께 넣는다
 * - Google: GoogleService-Info.plist의 CLIENT_ID. Info.plist URL 스킴에 REVERSED_CLIENT_ID도 넣는다
 */
export const KAKAO_LOGIN = true;
export const GOOGLE_IOS_CLIENT_ID = '578253666147-i5kof2k35nb9ucvsjohskp4bcnnij45u.apps.googleusercontent.com';
