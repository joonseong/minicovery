import { NextRequest, NextResponse } from 'next/server';

const UID_COOKIE = 'mc_uid';

/** 첫 방문에 기기 임시 계정 id를 심는다 (서버 컴포넌트는 쿠키를 쓸 수 없어서) */
export function middleware(request: NextRequest) {
  if (request.cookies.get(UID_COOKIE)) return NextResponse.next();
  const id = crypto.randomUUID();
  request.cookies.set(UID_COOKIE, id);
  const response = NextResponse.next({ request: { headers: request.headers } });
  response.cookies.set(UID_COOKIE, id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 365 * 2,
    path: '/',
  });
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api/cron|api/iap/notify).*)'],
};
