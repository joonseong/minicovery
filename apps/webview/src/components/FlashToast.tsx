'use client';

import { usePathname } from 'next/navigation';
import { useEffect } from 'react';

import { takeFlash } from '@/lib/client/flash';

import { Toast, useToast } from './ui';

/** 레이아웃에 하나만 둔다: 이전 화면이 남긴 안내(setFlash)를 도착한 화면에서 한 번 보여 준다 */
export function FlashToast() {
  const pathname = usePathname();
  const [message, show] = useToast();
  useEffect(() => {
    const m = takeFlash();
    if (m) show(m);
  }, [pathname, show]);
  return <Toast message={message} />;
}
