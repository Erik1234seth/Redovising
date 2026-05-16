import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';

  const isApp =
    hostname === 'app.enklabokslut.se' ||
    hostname.startsWith('app.localhost') ||
    hostname === '192.168.68.109:3000' ||
    hostname === '10.5.0.2:3000';

  if (!isApp) return NextResponse.next();

  const url = request.nextUrl.clone();

  // Låt statiska filer, API och redan omskrivna paths passera
  if (
    url.pathname.startsWith('/_next') ||
    url.pathname.startsWith('/api') ||
    url.pathname.startsWith('/app') ||
    url.pathname.startsWith('/favicon')
  ) {
    return NextResponse.next();
  }

  // Skriv om /  →  /app, /auth/login  →  /app/auth/login  osv
  url.pathname = `/app${url.pathname === '/' ? '' : url.pathname}`;

  // Sätt ett request-header så att root layout kan dölja marketing-nav
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-is-app', 'true');

  return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
};
