import { auth } from '@/lib/auth';
import { NextResponse } from 'next/server';

export default auth(req => {
  const { nextUrl } = req;
  // ต้องมี accessToken ด้วย — session ที่ไม่มี token ถือว่ายังไม่ได้ login
  const isLoggedIn = !!(req.auth as (typeof req.auth & { accessToken?: string }) | null)?.accessToken;
  const isPublic = nextUrl.pathname === '/login';
  const isRoot = nextUrl.pathname === '/';

  if (isRoot) {
    return NextResponse.redirect(new URL(isLoggedIn ? '/dashboard' : '/login', nextUrl));
  }

  if (!isLoggedIn && !isPublic) {
    return NextResponse.redirect(new URL('/login', nextUrl));
  }

  if (isLoggedIn && isPublic) {
    return NextResponse.redirect(new URL('/dashboard', nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
