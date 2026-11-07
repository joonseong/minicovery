'use client';

import { useEffect } from 'react';

/** 앱을 연 날을 하루 한 번 남긴다 (어드민 대시보드의 활동·재방문율). 화면에는 아무것도 그리지 않는다 */
export function VisitPing() {
  useEffect(() => {
    if (location.pathname.startsWith('/admin')) return;
    const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
    try {
      if (localStorage.getItem('mc_visit') === today) return;
      localStorage.setItem('mc_visit', today);
    } catch {
      // 저장소를 못 쓰면 같은 날 여러 번 보낼 수 있다. 대시보드는 사람·날짜로 세서 괜찮다
    }
    void fetch('/api/visit', { method: 'POST' });
  }, []);
  return null;
}
