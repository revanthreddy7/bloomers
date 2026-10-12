import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { authorizeDeveloper } from '@/server/maya/developer-auth';
import {
  developerOperation,
  ownedDevelopmentSession,
} from '@/server/maya/development-service';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
const headers = {
  'Cache-Control': 'private, no-store',
  'Referrer-Policy': 'no-referrer',
};
function safeOrigin(request: NextRequest) {
  if (
    request.headers.has('x-forwarded-host') &&
    request.headers.get('x-forwarded-host') !== request.headers.get('host')
  )
    throw new Error('Unexpected forwarding.');
  if (
    request.headers.get('host') !==
    new URL(process.env.MAYA_DEV_ORIGIN ?? 'http://localhost:3000').host
  )
    throw new Error('Local host required.');
  return request.nextUrl.origin;
}
export async function GET(request: NextRequest) {
  try {
    const identity = await authorizeDeveloper(safeOrigin(request));
    const id = z.uuid().parse(request.nextUrl.searchParams.get('id'));
    return NextResponse.json(ownedDevelopmentSession(id, identity).snapshot(), {
      headers,
    });
  } catch {
    return NextResponse.json(
      { error: 'Developer session unavailable.' },
      { status: 403, headers },
    );
  }
}
export async function POST(request: NextRequest) {
  try {
    const origin = safeOrigin(request);
    if (
      request.headers.get('origin') !== origin ||
      !request.headers.get('content-type')?.startsWith('application/json')
    )
      throw new Error('Origin or format rejected.');
    if (process.env.NODE_ENV !== 'development')
      throw new Error('Development only.');
    // Authenticate before reading SDP/commands. Cap the streamed body, not just Content-Length.
    await authorizeDeveloper(origin);
    const reader = request.body?.getReader();
    let bytes = 0,
      raw = '';
    const decoder = new TextDecoder();
    if (reader) {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > 25000) {
          await reader.cancel();
          return NextResponse.json(
            { error: 'Request too large.' },
            { status: 413, headers },
          );
        }
        raw += decoder.decode(value, { stream: true });
      }
      raw += decoder.decode();
    }
    return NextResponse.json(
      await developerOperation(origin, JSON.parse(raw)),
      { headers },
    );
  } catch {
    return NextResponse.json(
      {
        error:
          'Developer action denied or unavailable. Check local approval and termination status.',
      },
      { status: 403, headers },
    );
  }
}
