import { NextResponse, type NextRequest } from 'next/server';
import { createSessionClient } from '@/server/supabase-session';
import { safeNext } from '@/features/identity/validation';
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get('code');
  if (code) {
    const client = await createSessionClient();
    const { error } = await client.auth.exchangeCodeForSession(code);
    if (!error)
      return NextResponse.redirect(
        new URL(
          safeNext(request.nextUrl.searchParams.get('next')),
          request.url,
        ),
        { headers: { 'Cache-Control': 'private, no-store' } },
      );
  }
  return NextResponse.redirect(new URL('/auth/link-expired', request.url));
}
