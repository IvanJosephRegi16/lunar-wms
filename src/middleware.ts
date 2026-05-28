import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyToken, hasPermission } from './lib/auth';

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('auth_token')?.value;
  const pathname = request.nextUrl.pathname;
  
  const isLoginPage = pathname.startsWith('/login');
  const isSignupPage = pathname.startsWith('/signup');
  const isAuthApi = pathname.startsWith('/api/auth');
  const isApi = pathname.startsWith('/api');

  // Verify token if it exists
  const user = token ? await verifyToken(token) : null;

  // Not authenticated
  if (!user && !isLoginPage && !isSignupPage && !isAuthApi) {
    if (isApi) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.redirect(new URL('/login?reason=expired', request.url));
  }

  // Already authenticated trying to access login/signup
  if (user && (isLoginPage || isSignupPage)) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  // Role-Based Access Control
  if (user && !isAuthApi) {
    // If we're hitting an API route, ensure they have permission
    // For now, API paths might need manual checks in their route handlers,
    // but we can also block explicitly if we map API routes to ROUTE_PERMISSIONS.
    // The main protection here is for frontend pages.
    const isAllowed = hasPermission(pathname, user.role);
    
    if (!isAllowed) {
      if (isApi) {
        return NextResponse.json({ error: 'Forbidden: Insufficient Permissions' }, { status: 403 });
      }
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
