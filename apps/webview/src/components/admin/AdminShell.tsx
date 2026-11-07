import type { ReactNode } from 'react';

/**
 * 어드민은 PC에서 넓게 본다 (2026-11-08 대표). 앱 화면 틀(가운데 480px, 바깥 스크롤 없음)을 벗어나
 * 브라우저 화면 전체를 덮고 그 안에서 스크롤한다
 */
export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-shape-white">
      <main className="mx-auto max-w-[1440px] px-5 py-6 text-sm text-fuse-ink lg:px-10 lg:py-8">{children}</main>
    </div>
  );
}
