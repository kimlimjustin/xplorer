import { withAuth } from 'next-auth/middleware';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// CRIT-W01: CSRF protection for state-changing API routes.
// For POST/PUT/PATCH/DELETE requests to API routes, verify that the Origin header
// matches the expected origin, or that a custom X-Requested-With header is present
// (browsers won't send custom headers in cross-origin requests without CORS preflight).
// Stripe webhooks are excluded since they use their own signature verification.
const STATE_CHANGING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function csrfCheck(req: NextRequest): NextResponse | null {
  const path = req.nextUrl.pathname;

  // Only check state-changing methods on API routes
  if (!path.startsWith('/api/') || !STATE_CHANGING_METHODS.has(req.method)) {
    return null;
  }

  // Exclude webhook endpoints — they use their own signature verification
  if (path.startsWith('/api/webhooks/')) {
    return null;
  }

  // Exclude NextAuth endpoints — they handle their own CSRF via the csrfToken
  if (path.startsWith('/api/auth/')) {
    return null;
  }

  // Check 1: Custom header present (browsers block custom headers in simple cross-origin requests)
  if (req.headers.get('x-requested-with') === 'XMLHttpRequest') {
    return null;
  }

  // Check 2: Origin header matches our host
  const origin = req.headers.get('origin');
  if (origin) {
    try {
      const originUrl = new URL(origin);
      const expectedHost = req.nextUrl.host;
      if (originUrl.host === expectedHost) {
        return null;
      }
    } catch {
      // Invalid origin header — fall through to reject
    }
  }

  // If neither check passed, reject the request
  return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
}

// Paths that require authentication checks (handled by withAuth)
const AUTH_PATHS = [
  '/dashboard',
  '/billing',
  '/publish',
  '/admin',
  '/api/admin',
  '/api/user',
  '/api/billing',
];

function needsAuthCheck(path: string): boolean {
  return AUTH_PATHS.some((prefix) => path.startsWith(prefix));
}

// The withAuth middleware handles auth-protected routes
const authMiddleware = withAuth({
  callbacks: {
    authorized: ({ token, req }) => {
      const path = req.nextUrl.pathname;

      // Admin routes (pages and API) require admin role
      if (path.startsWith('/admin') || path.startsWith('/api/admin')) {
        return token?.role === 'ADMIN';
      }

      // Dashboard and billing routes require auth
      if (
        path.startsWith('/dashboard') ||
        path.startsWith('/billing') ||
        path.startsWith('/publish')
      ) {
        return !!token;
      }

      // LOW-18: Protected API routes require authentication
      if (path.startsWith('/api/user') || path.startsWith('/api/billing')) {
        return !!token;
      }

      // All other routes are public
      return true;
    },
  },
});

const CORS_ORIGINS = [
  'tauri://localhost',
  'https://tauri.localhost',
  ...(process.env.NODE_ENV === 'development'
    ? [
        'http://localhost:1420',
        'http://localhost:3000',
        'http://localhost:5173',
        'http://localhost:5174',
      ]
    : []),
  ...(process.env.NEXT_PUBLIC_APP_URL ? [process.env.NEXT_PUBLIC_APP_URL] : []),
];

export default async function middleware(req: NextRequest) {
  // Handle CORS preflight (OPTIONS) at the middleware level so it doesn't
  // get blocked by CSRF checks or auth middleware.
  if (req.method === 'OPTIONS' && req.nextUrl.pathname.startsWith('/api/')) {
    const origin = req.headers.get('origin');
    const headers: Record<string, string> = {
      'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
    };
    if (origin && CORS_ORIGINS.includes(origin)) {
      headers['Access-Control-Allow-Origin'] = origin;
    }
    return new NextResponse(null, { status: 200, headers });
  }

  // CRIT-W01: CSRF check runs first for all matched API routes
  const csrfResult = csrfCheck(req);
  if (csrfResult) {
    return csrfResult;
  }

  // Skip auth middleware for NextAuth's own endpoints
  if (req.nextUrl.pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  // Only run auth middleware on paths that need it
  if (needsAuthCheck(req.nextUrl.pathname)) {
    return (authMiddleware as any)(req);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Auth-protected routes
    '/dashboard/:path*',
    '/billing/:path*',
    '/publish',
    '/admin/:path*',
    '/api/admin/:path*',
    '/api/user/:path*',
    '/api/billing/:path*',
    // CRIT-W01: All API routes for CSRF protection
    '/api/:path*',
  ],
};
