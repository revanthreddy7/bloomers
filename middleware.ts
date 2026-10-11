import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getPublicEnv } from '@/lib/env';

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = getPublicEnv();
  const client = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (values) => {
          values.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          values.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );
  const claims = await client.auth.getClaims();
  if (
    request.method === 'GET' &&
    !request.nextUrl.pathname.startsWith('/auth') &&
    !claims.data?.claims
  ) {
    const target = request.nextUrl.clone();
    target.pathname = '/auth/sign-in';
    target.search = '';
    const protectedResponse = NextResponse.redirect(target);
    response.cookies
      .getAll()
      .forEach((cookie) => protectedResponse.cookies.set(cookie));
    protectedResponse.headers.set('Cache-Control', 'private, no-store');
    protectedResponse.headers.set('Referrer-Policy', 'no-referrer');
    return protectedResponse;
  }
  if (
    request.method === 'GET' &&
    !request.nextUrl.pathname.startsWith('/preview')
  ) {
    const preview = await client.rpc('active_preview_student');
    if (preview.data) {
      const target = request.nextUrl.clone();
      target.pathname = `/preview/${preview.data}`;
      target.search = '';
      const restricted = NextResponse.redirect(target);
      response.cookies
        .getAll()
        .forEach((cookie) => restricted.cookies.set(cookie));
      restricted.headers.set('Cache-Control', 'private, no-store');
      restricted.headers.set('Referrer-Policy', 'no-referrer');
      return restricted;
    }
  }
  response.headers.set('Cache-Control', 'private, no-store');
  response.headers.set('Referrer-Policy', 'no-referrer');
  return response;
}
export const config = {
  matcher: [
    '/parent/:path*',
    '/auth/:path*',
    '/curriculum/:path*',
    '/preview/:path*',
  ],
};
