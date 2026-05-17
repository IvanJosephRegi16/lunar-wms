import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken } from './lib/auth';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  const isLoginPage = request.nextUrl.pathname.startsWith('/login');
  const isAuthApi = request.nextUrl.pathname.startsWith('/api/auth');

  // Verify token if it exists
  const user = token ? await verifyToken(token) : null;

  if (!user && !isLoginPage && !isAuthApi) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  if (user && isLoginPage) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
