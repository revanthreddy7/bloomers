import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { readClassroom, mutateClassroom } from '@/server/classroom/service';
const headers = {
  'Cache-Control': 'private, no-store',
  'Referrer-Policy': 'no-referrer',
};
type Context = { params: Promise<{ id: string; scheduleId: string }> };
export async function GET(request: NextRequest, { params }: Context) {
  const { id, scheduleId } = await params;
  const cursor = z.coerce
    .number()
    .int()
    .min(0)
    .max(3000)
    .safeParse(request.nextUrl.searchParams.get('after') ?? 0);
  if (!cursor.success)
    return NextResponse.json(
      { error: 'Invalid replay cursor.' },
      { status: 400, headers },
    );
  return NextResponse.json(await readClassroom(id, scheduleId, cursor.data), {
    headers,
  });
}
export async function POST(request: NextRequest, { params }: Context) {
  if (
    request.headers.get('origin') !== request.nextUrl.origin ||
    !request.headers.get('content-type')?.startsWith('application/json')
  )
    return NextResponse.json(
      { error: 'Invalid request origin or format.' },
      { status: 403, headers },
    );
  const reader = request.body?.getReader();
  let raw = '',
    bytes = 0;
  const decoder = new TextDecoder();
  if (reader) {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > 20000) {
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
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON.' },
      { status: 400, headers },
    );
  }
  const envelope = z
    .strictObject({ kind: z.enum(['lifecycle', 'append']), input: z.unknown() })
    .safeParse(body);
  if (!envelope.success)
    return NextResponse.json(
      { error: 'Invalid request.' },
      { status: 400, headers },
    );
  const { id, scheduleId } = await params;
  const result = await mutateClassroom(
    id,
    scheduleId,
    envelope.data.input,
    envelope.data.kind,
  );
  return NextResponse.json(result, {
    status: 'error' in result ? 400 : 200,
    headers,
  });
}
