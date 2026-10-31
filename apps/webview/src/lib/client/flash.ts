'use client';

/**
 * 페이지를 옮긴 뒤 한 번만 보여 줄 짧은 안내 (가입 성공 등).
 * 떠나기 전에 setFlash, 도착한 화면(FlashToast)이 takeFlash로 꺼내 보여 주고 지운다
 */
const KEY = 'mc_flash';

export function setFlash(message: string) {
  try {
    sessionStorage.setItem(KEY, message);
  } catch {
    // 저장소를 못 쓰는 환경이면 안내를 건너뛴다
  }
}

export function takeFlash(): string {
  try {
    const m = sessionStorage.getItem(KEY) ?? '';
    if (m) sessionStorage.removeItem(KEY);
    return m;
  } catch {
    return '';
  }
}
