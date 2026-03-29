import { NextRequest, NextResponse } from 'next/server';

const ALLOWED_ORIGINS = [
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

export function corsHeaders(request: NextRequest): HeadersInit {
  const origin = request.headers.get('origin');
  const headers: HeadersInit = {
    'Access-Control-Allow-Methods': 'GET, POST, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Credentials': 'true',
  };
  if (origin && ALLOWED_ORIGINS.includes(origin)) {
    (headers as Record<string, string>)['Access-Control-Allow-Origin'] = origin;
  }
  return headers;
}

export function handleCors(request: NextRequest): NextResponse | null {
  if (request.method === 'OPTIONS') {
    return new NextResponse(null, { status: 200, headers: corsHeaders(request) });
  }
  return null;
}
