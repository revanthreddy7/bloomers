import { NextResponse, type NextRequest } from 'next/server';
import { authorizeDeveloper } from '@/server/maya/developer-auth';
import { recoverExpiredIncident } from '@/server/maya/development-recovery';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const privacy = {
  'Cache-Control': 'private, no-store',
  'Referrer-Policy': 'no-referrer',
};
export async function POST(request: NextRequest) {
  try {
    const origin = process.env.MAYA_DEV_ORIGIN ?? 'http://localhost:3000';
    if (
      request.nextUrl.origin !== origin ||
      request.headers.get('host') !== new URL(origin).host ||
      request.headers.get('origin') !== origin ||
      (request.headers.has('x-forwarded-host') &&
        request.headers.get('x-forwarded-host') !== new URL(origin).host) ||
      !request.headers.get('content-type')?.startsWith('application/json')
    )
      throw new Error('Local origin required.');
    const identity = await authorizeDeveloper(origin);
    const reader = request.body?.getReader();
    let bytes = 0,
      raw = '';
    const decoder = new TextDecoder();
    if (!reader) throw new Error('Body required.');
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 1000) {
        await reader.cancel();
        throw new Error('Body exceeds recovery bounds.');
      }
      raw += decoder.decode(chunk.value, { stream: true });
    }
    raw += decoder.decode();
    const audit = await recoverExpiredIncident(
      origin,
      identity,
      JSON.parse(raw),
    );
    return NextResponse.json(
      {
        status: audit.status,
        leaseReleased: audit.leaseReleased,
        authorizedAt: audit.authorizedAt,
        providerTerminationConfirmed: false,
      },
      { headers: privacy },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          'Recovery denied or busy. Verify evidence, elapsed lifetime, ownership and local cleanup; keep the lock and inspect the runbook.',
      },
      { status: 403, headers: privacy },
    );
  }
}
