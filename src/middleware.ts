import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { ADMIN_COOKIE, isValidSession } from '@/lib/admin-auth';

export async function middleware(request: NextRequest) {
  const hostname = request.headers.get('host') || '';

  /**
   * Admin-API:t kräver inloggning, och kontrollen ligger här istället för i
   * varje route — då går den inte att glömma i nästa endpoint någon lägger
   * till. Inloggningsrouten är undantagen, annars fanns ingen väg in.
   *
   * Sidorna under /admin är medvetet inte spärrade här: de innehåller ingen
   * data i sig utan hämtar allt härifrån, och skalet visar kodrutan när
   * anropet nedan svarar 401.
   */
  if (request.nextUrl.pathname.startsWith('/api/admin')) {
    const isLogin = request.nextUrl.pathname === '/api/admin/login';
    if (!isLogin && !(await isValidSession(request.cookies.get(ADMIN_COOKIE)?.value))) {
      return NextResponse.json({ error: 'Ej inloggad' }, { status: 401 });
    }
    return NextResponse.next();
  }

  const isApp =
    hostname === 'app.enklabokslut.se' ||
    hostname.startsWith('app.localhost') ||
    hostname === '192.168.68.112:3000' ||
    hostname === '10.5.0.2:3000';

  // Adminpanelen har ett eget skal och ska varken ha marknadsföringsnavigering,
  // sidfot eller cookieruta ovanpå sig.
  if (request.nextUrl.pathname.startsWith('/admin')) {
    const adminHeaders = new Headers(request.headers);
    adminHeaders.set('x-is-admin', 'true');
    return NextResponse.next({ request: { headers: adminHeaders } });
  }

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
