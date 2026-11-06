import type { Metadata, Viewport } from 'next';

import { FlashToast } from '@/components/FlashToast';

import './globals.css';
import './doodle.css';

export const metadata: Metadata = {
  title: '미니커버리',
  description: '궁금한 것을 하루 한 편씩',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
  themeColor: '#FFFFFF',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <body className="font-sans antialiased">
        <div className="relative mx-auto flex h-dvh w-full max-w-[480px] flex-col overflow-hidden bg-shape-white">
          {children}
          <FlashToast />
        </div>
      </body>
    </html>
  );
}
