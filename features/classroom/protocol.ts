import { z } from 'zod';
const id = z.uuid();
const coordinate = z.number().min(0).max(1);
export const pointSchema = z.strictObject({ x: coordinate, y: coordinate });
const color = z.enum(['#263b36', '#246bce', '#c34e35']);
const stroke = z.strictObject({
  points: z.array(pointSchema).min(2).max(256),
  color,
  width: z.number().min(1).max(12),
});
const target = z.strictObject({ targetId: id });
export const studentCommandSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('stroke'), payload: stroke }),
  ...(['erase', 'undo', 'redo'] as const).map((kind) =>
    z.strictObject({ kind: z.literal(kind), payload: target }),
  ),
  z.strictObject({
    kind: z.literal('clear_board'),
    payload: z.strictObject({ confirmed: z.literal(true) }),
  }),
  ...(['connection_interrupted', 'connection_recovered'] as const).map((kind) =>
    z.strictObject({ kind: z.literal(kind), payload: z.strictObject({}) }),
  ),
]);
export const appendSchema = z.strictObject({
  commandId: id,
  expectedEpoch: z.number().int().nonnegative(),
  command: studentCommandSchema,
});
export const lifecycleSchema = z.strictObject({
  commandId: id,
  action: z.enum(['start', 'pause', 'resume', 'end', 'heartbeat']),
});
export const stateSchema = z.enum([
  'ready',
  'active',
  'paused',
  'ended',
  'abandoned',
]);
export const eventSchema = z.strictObject({
  id,
  lessonId: id,
  sequence: z.number().int().positive(),
  epoch: z.number().int().nonnegative(),
  protocolVersion: z.literal(1),
  source: z.enum(['student_preview', 'system_preview', 'maya_mock']),
  kind: z.string().max(64),
  payload: z.record(z.string(), z.unknown()),
  createdAt: z.iso.datetime({ offset: true }),
});
export type ClassroomEvent = z.infer<typeof eventSchema>;
export type StudentCommand = z.infer<typeof studentCommandSchema>;
export type Point = z.infer<typeof pointSchema>;
export type Stroke = z.infer<typeof stroke> & {
  id: string;
  source: 'student_preview' | 'maya';
};
export function normalizePoint(
  x: number,
  y: number,
  rect: { left: number; top: number; width: number; height: number },
): Point {
  if (rect.width <= 0 || rect.height <= 0)
    throw new Error('Whiteboard has no drawing area');
  return {
    x:
      Math.round(
        Math.min(1, Math.max(0, (x - rect.left) / rect.width)) * 10000,
      ) / 10000,
    y:
      Math.round(
        Math.min(1, Math.max(0, (y - rect.top) / rect.height)) * 10000,
      ) / 10000,
  };
}
export function orderedEvents(events: ClassroomEvent[]) {
  const bySequence = new Map<number, ClassroomEvent>();
  for (const event of events) {
    const prior = bySequence.get(event.sequence);
    if (prior && JSON.stringify(prior) !== JSON.stringify(event))
      throw new Error('Conflicting event delivery');
    if (events[0] && event.lessonId !== events[0].lessonId)
      throw new Error('Mixed lesson replay');
    bySequence.set(event.sequence, event);
  }
  const sorted = [...bySequence.values()].sort(
    (a, b) => a.sequence - b.sequence,
  );
  sorted.forEach((e, i) => {
    if (e.sequence !== i + 1) throw new Error('Replay gap');
  });
  return sorted;
}
export function replayBoard(events: ClassroomEvent[]) {
  const strokes = new Map<string, Stroke>(),
    hidden = new Set<string>();
  for (const event of orderedEvents(events)) {
    if (event.kind === 'stroke') {
      const payload = stroke.parse(event.payload);
      strokes.set(event.id, {
        ...payload,
        id: event.id,
        source: 'student_preview',
      });
    } else if (['erase', 'undo'].includes(event.kind))
      hidden.add(target.parse(event.payload).targetId);
    else if (event.kind === 'redo')
      hidden.delete(target.parse(event.payload).targetId);
    else if (event.kind === 'clear_board') {
      strokes.clear();
      hidden.clear();
    }
  }
  return {
    visible: [...strokes.values()].filter((s) => !hidden.has(s.id)),
    hidden: [...strokes.values()].filter((s) => hidden.has(s.id)),
  };
}
// Future Maya proposals are a distinct validated contract. No Phase 5 RPC accepts them.
const box = z.strictObject({
  x: coordinate,
  y: coordinate,
  width: coordinate,
  height: coordinate,
});
export const mayaCommandSchema = z.strictObject({
  protocolVersion: z.literal(1),
  commandId: id,
  lessonId: id,
  sequence: z.number().int().positive(),
  actor: z.literal('maya'),
  epoch: z.number().int().nonnegative(),
  synchronization: z
    .strictObject({
      speechId: id,
      anchor: z.enum(['speech_start', 'playback_offset', 'speech_end']),
      offsetMs: z.number().int().min(0).max(300000),
    })
    .optional(),
  action: z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('write_text'),
      at: pointSchema,
      text: z.string().min(1).max(500),
    }),
    z.strictObject({
      kind: z.literal('write_math'),
      at: pointSchema,
      text: z.string().min(1).max(500),
    }),
    z.strictObject({
      kind: z.literal('draw_line'),
      from: pointSchema,
      to: pointSchema,
    }),
    z.strictObject({
      kind: z.literal('draw_shape'),
      shape: z.enum(['rectangle', 'ellipse']),
      box,
    }),
    z.strictObject({
      kind: z.literal('draw_graph'),
      points: z.array(pointSchema).min(2).max(256),
    }),
    z.strictObject({ kind: z.literal('highlight'), box }),
    z.strictObject({ kind: z.literal('point_to'), at: pointSchema }),
    z.strictObject({ kind: z.literal('erase'), targetId: id }),
    z.strictObject({ kind: z.literal('clear_board') }),
  ]),
});
export type MayaCommand = z.infer<typeof mayaCommandSchema>;
export type MayaScene = Map<string, MayaCommand['action']>;
export function applyMayaCommand(
  scene: MayaScene,
  seen: Set<string>,
  command: MayaCommand,
  context: { lessonId: string; epoch: number; lastSequence: number },
) {
  mayaCommandSchema.parse(command);
  if (command.lessonId !== context.lessonId || command.epoch !== context.epoch)
    throw new Error('Stale instruction');
  if (seen.has(command.commandId)) return;
  if (command.sequence !== context.lastSequence + 1)
    throw new Error('Instruction out of order');
  if (command.action.kind === 'clear_board') scene.clear();
  else if (command.action.kind === 'erase')
    scene.delete(command.action.targetId);
  else scene.set(command.commandId, command.action);
  seen.add(command.commandId);
  context.lastSequence = command.sequence;
}
export const mediaCapabilities = Object.freeze({
  microphone: 'disabled',
  camera: 'disabled',
  uploads: 'disabled',
  ai: 'disabled',
} as const);

const roomSchema = z.strictObject({
  id: z.uuid(),
  status: stateSchema,
  epoch: z.number().int().nonnegative(),
  sequence: z.number().int().nonnegative(),
  startedAt: z.string().nullable(),
  endedAt: z.string().nullable(),
  lastSeenAt: z.string().nullable(),
});
export const replaySchema = z.strictObject({
  lesson: roomSchema.nullable(),
  events: z.array(eventSchema).max(250),
});
export type ClassroomSnapshot = z.infer<typeof replaySchema>;

// Schema-only proposals for reviewed future producers; never accepted by the
// student append RPC and never emitted as if tutoring/permission prompts occurred.
export const futureEventProposalSchema = z.strictObject({
  protocolVersion: z.literal(1),
  lessonId: id,
  eventId: id,
  epoch: z.number().int().nonnegative(),
  proposal: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('maya_speaking'), speechId: id }),
    z.strictObject({ kind: z.literal('maya_listening'), turnId: id }),
    z.strictObject({ kind: z.literal('question_asked'), questionId: id }),
    z.strictObject({
      kind: z.literal('student_answer_received'),
      questionId: id,
      answerReference: id,
    }),
    z.strictObject({
      kind: z.literal('hint_given'),
      questionId: id,
      hintPosition: z.number().int().min(1).max(10),
    }),
    z.strictObject({
      kind: z.literal('misconception_observed'),
      proposalReference: id,
    }),
    z.strictObject({
      kind: z.literal('assessment_evidence_generated'),
      reviewedEvidenceReference: id,
    }),
    z.strictObject({
      kind: z.enum([
        'microphone_permission_requested',
        'microphone_permission_denied',
        'camera_permission_requested',
        'camera_permission_denied',
        'upload_requested',
      ]),
      capabilityGateReference: id,
    }),
    z.strictObject({
      kind: z.literal('student_action'),
      action: z.enum(['interrupt', 'raise_hand']),
      turnId: id,
    }),
  ]),
});
