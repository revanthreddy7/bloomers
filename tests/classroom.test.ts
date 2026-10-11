import { describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import {
  appendSchema,
  studentCommandSchema,
  normalizePoint,
  replayBoard,
  orderedEvents,
  mayaCommandSchema,
  applyMayaCommand,
  mediaCapabilities,
  futureEventProposalSchema,
  type ClassroomEvent,
  type MayaCommand,
} from '@/features/classroom/protocol';
import frozen from '@/features/classroom/student-command.schema.json';
import {
  InstructionTimeline,
  LocalReplayTransport,
} from '@/features/classroom/transport';
import { attendanceModel } from '@/features/application/models';
import { readFileSync } from 'node:fs';
const lessonId = randomUUID(),
  strokeId = randomUUID();
const payload = {
  points: [
    { x: 0, y: 0 },
    { x: 1, y: 1 },
  ],
  color: '#263b36',
  width: 4,
};
function event(
  sequence: number,
  kind: string,
  payload: Record<string, unknown> = {},
  id = randomUUID(),
): ClassroomEvent {
  return {
    id,
    lessonId,
    sequence,
    kind,
    payload,
    epoch: 0,
    protocolVersion: 1,
    source: 'student_preview',
    createdAt: '2026-10-11T10:00:00Z',
  };
}
const stroke = event(1, 'stroke', payload, strokeId);
describe('whiteboard persistence', () => {
  it('normalizes mouse/touch coordinates independent of viewport', () => {
    expect(
      normalizePoint(60, 45, { left: 10, top: 20, width: 100, height: 50 }),
    ).toEqual({ x: 0.5, y: 0.5 });
    expect(
      normalizePoint(110, 70, { left: 10, top: 20, width: 200, height: 100 }),
    ).toEqual({ x: 0.5, y: 0.5 });
  });
  it('clamps outside coordinates and rejects zero-size drawing surface', () => {
    expect(
      normalizePoint(-100, 500, { left: 0, top: 0, width: 100, height: 100 }),
    ).toEqual({ x: 0, y: 1 });
    expect(() =>
      normalizePoint(0, 0, { left: 0, top: 0, width: 0, height: 100 }),
    ).toThrow();
  });
  it('serializes compact validated strokes', () => {
    expect(
      studentCommandSchema.parse(
        JSON.parse(JSON.stringify({ kind: 'stroke', payload })),
      ),
    ).toEqual({ kind: 'stroke', payload });
  });
  it('replays out-of-order delivery and ignores duplicate deliveries', () => {
    const pause = event(2, 'lesson_paused');
    expect(orderedEvents([pause, stroke, stroke])).toEqual([stroke, pause]);
    expect(replayBoard([stroke, stroke]).visible).toHaveLength(1);
  });
  it('rejects missing sequence rather than rendering incomplete history', () => {
    expect(() => replayBoard([event(2, 'stroke', payload)])).toThrow(
      'Replay gap',
    );
  });
  it('undo/redo and eraser persist through replay', () => {
    const undo = event(2, 'undo', { targetId: strokeId }),
      redo = event(3, 'redo', { targetId: strokeId }),
      erase = event(4, 'erase', { targetId: strokeId });
    expect(replayBoard([stroke, undo]).visible).toHaveLength(0);
    expect(replayBoard([stroke, undo, redo]).visible).toHaveLength(1);
    expect(replayBoard([stroke, undo, redo, erase]).visible).toHaveLength(0);
  });
  it('clear resets visible and redo history', () => {
    expect(
      replayBoard([stroke, event(2, 'clear_board', { confirmed: true })]),
    ).toEqual({ visible: [], hidden: [] });
  });
  it('requires explicit clear confirmation', () => {
    expect(
      studentCommandSchema.safeParse({
        kind: 'clear_board',
        payload: { confirmed: false },
      }).success,
    ).toBe(false);
  });
  it.each([
    {
      points: [
        { x: -1, y: 0 },
        { x: 1, y: 1 },
      ],
    },
    {
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 1 },
      ],
    },
    { points: Array(257).fill({ x: 0, y: 0 }) },
    { width: 13 },
    { color: 'url(javascript:alert(1))' },
  ])('rejects invalid or oversized stroke %o', (invalid) => {
    expect(
      studentCommandSchema.safeParse({
        kind: 'stroke',
        payload: { ...payload, ...invalid },
      }).success,
    ).toBe(false);
  });
  it('rejects role/source/payload extensions', () => {
    expect(
      studentCommandSchema.safeParse({
        kind: 'stroke',
        payload: { ...payload, actor: 'maya' },
      }).success,
    ).toBe(false);
    expect(
      appendSchema.safeParse({
        commandId: randomUUID(),
        expectedEpoch: 0,
        command: { kind: 'write_text', payload: { text: 'spoofed' } },
      }).success,
    ).toBe(false);
  });
  it('frozen schema agrees with Zod and database validator', () => {
    expect(z.toJSONSchema(studentCommandSchema)).toEqual(frozen);
    const sql = readFileSync(
      'supabase/migrations/202610110007_classroom.sql',
      'utf8',
    );
    const matched = sql.match(
      /classroom_command_schema\(\)[\s\S]*?\$json\$(.*?)\$json\$/,
    );
    expect(JSON.parse(matched![1])).toEqual(frozen);
  });
});
describe('future synchronized orchestration', () => {
  const speechId = randomUUID();
  function instruction(sequence: number, epoch = 0): MayaCommand {
    return mayaCommandSchema.parse({
      protocolVersion: 1,
      commandId: randomUUID(),
      lessonId,
      sequence,
      actor: 'maya',
      epoch,
      synchronization: { speechId, anchor: 'playback_offset', offsetMs: 500 },
      action: { kind: 'write_math', at: { x: 0.2, y: 0.3 }, text: 'x + 2 = 5' },
    });
  }
  it('releases visual commands on acknowledged playback offsets', () => {
    const timeline = new InstructionTimeline(),
      c = instruction(1);
    timeline.enqueue(c);
    expect(timeline.due(speechId, 400, 'playback_offset')).toEqual([]);
    expect(timeline.due(randomUUID(), 600, 'playback_offset')).toEqual([]);
    expect(timeline.due(speechId, 600, 'speech_start')).toEqual([]);
    expect(timeline.due(speechId, 600, 'playback_offset')).toEqual([c]);
    expect(timeline.due(speechId, 700, 'playback_offset')).toEqual([]);
  });
  it('interruptions cancel outstanding visuals and reject stale instructions', () => {
    const timeline = new InstructionTimeline();
    timeline.enqueue(instruction(1));
    timeline.interrupt();
    expect(timeline.due(speechId, 1000, 'playback_offset')).toEqual([]);
    expect(() => timeline.enqueue(instruction(2))).toThrow();
  });
  it('applies typed Maya commands deterministically and idempotently', () => {
    const scene = new Map(),
      seen = new Set<string>(),
      context = { lessonId, epoch: 0, lastSequence: 0 },
      c = instruction(1);
    applyMayaCommand(scene, seen, c, context);
    applyMayaCommand(scene, seen, c, context);
    expect(scene.size).toBe(1);
    expect(context.lastSequence).toBe(1);
    expect(() =>
      applyMayaCommand(scene, seen, instruction(3), context),
    ).toThrow('out of order');
    expect(() =>
      applyMayaCommand(scene, seen, instruction(2, 1), context),
    ).toThrow('Stale');
  });
  it('supports all future drawing actions with bounded payloads', () => {
    for (const action of [
      { kind: 'write_text', at: { x: 0, y: 0 }, text: 'Hello' },
      { kind: 'draw_line', from: { x: 0, y: 0 }, to: { x: 1, y: 1 } },
      {
        kind: 'draw_shape',
        shape: 'ellipse',
        box: { x: 0, y: 0, width: 1, height: 1 },
      },
      { kind: 'draw_graph', points: payload.points },
      { kind: 'highlight', box: { x: 0, y: 0, width: 1, height: 1 } },
      { kind: 'point_to', at: { x: 0, y: 0 } },
      { kind: 'erase', targetId: strokeId },
      { kind: 'clear_board' },
    ])
      expect(
        mayaCommandSchema.safeParse({ ...instruction(1), action }).success,
      ).toBe(true);
  });
  it('rejects unknown protocol versions', () => {
    expect(
      mayaCommandSchema.safeParse({ ...instruction(1), protocolVersion: 2 })
        .success,
    ).toBe(false);
  });
  it('mock transport deterministically replays and closes', async () => {
    const transport = new LocalReplayTransport([
      event(2, 'lesson_paused'),
      stroke,
    ]);
    expect(await transport.replay(0)).toHaveLength(2);
    expect(await transport.replay(1)).toHaveLength(1);
    transport.close();
    await expect(transport.replay(0)).rejects.toThrow();
  });
});
it('preview rehearsals never count as attendance', () => {
  expect(
    attendanceModel([
      {
        status: 'active',
        started_at: '2026-10-11',
        ended_at: null,
        classroom_mode: 'supervised_preview',
      },
      {
        status: 'completed',
        started_at: '2026-10-11',
        ended_at: '2026-10-11',
        classroom_mode: 'supervised_preview',
      },
    ]),
  ).toEqual({ started: false, active: 0, completed: 0 });
});
it('all media and AI capability interfaces stay disabled', () => {
  expect(Object.values(mediaCapabilities)).toEqual([
    'disabled',
    'disabled',
    'disabled',
    'disabled',
  ]);
});

it('future proposal types remain validated and unavailable to student append', () => {
  const future = {
    protocolVersion: 1,
    lessonId,
    eventId: randomUUID(),
    epoch: 0,
    proposal: { kind: 'question_asked', questionId: randomUUID() },
  };
  expect(futureEventProposalSchema.safeParse(future).success).toBe(true);
  expect(
    studentCommandSchema.safeParse({
      kind: 'question_asked',
      payload: future.proposal,
    }).success,
  ).toBe(false);
  expect(
    futureEventProposalSchema.safeParse({ ...future, protocolVersion: 2 })
      .success,
  ).toBe(false);
});
it('replay rejects conflicting duplicates and mixed lesson references', () => {
  expect(() =>
    orderedEvents([stroke, { ...stroke, kind: 'clear_board' }]),
  ).toThrow('Conflicting');
  expect(() =>
    orderedEvents([
      stroke,
      { ...event(2, 'lesson_paused'), lessonId: randomUUID() },
    ]),
  ).toThrow('Mixed');
});
