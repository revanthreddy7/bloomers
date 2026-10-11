import { NextResponse, type NextRequest } from 'next/server';
import { createSessionClient } from '@/server/supabase-session';
export async function GET(request: NextRequest) {
  const hash = request.nextUrl.searchParams.get('token_hash');
  const type = request.nextUrl.searchParams.get('type');
  const destination = type === 'recovery' ? '/auth/reset-password' : '/parent';
  if (hash && ['email', 'signup', 'recovery'].includes(type ?? '')) {
    const client = await createSessionClient();
    const { error } = await client.auth.verifyOtp({
      token_hash: hash,
      type: type as 'email' | 'signup' | 'recovery',
    });
    if (!error)
      return NextResponse.redirect(new URL(destination, request.url), {
        headers: {
          'Cache-Control': 'private, no-store',
          'Referrer-Policy': 'no-referrer',
        },
      });
  }
  return NextResponse.redirect(new URL('/auth/link-expired', request.url), {
    headers: {
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
