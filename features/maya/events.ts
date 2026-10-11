import { z } from 'zod';
import {
  mayaCommandSchema,
  orderedEvents,
  type ClassroomEvent,
  type MayaScene,
} from '@/features/classroom/protocol';
import { teachingPolicyVersion, approvedToolNames } from './contracts';
const step = z.number().int().min(0).max(9);
const speechId = z.uuid();
const text = z.string().min(1).max(1000);
export const mockEventSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('maya_tool_call'),
    payload: z.strictObject({
      callId: z.uuid(),
      name: z.enum([...approvedToolNames, 'unapproved']),
      outcome: z.enum(['proposed', 'validated', 'rejected']),
    }),
  }),
  z.strictObject({
    kind: z.literal('maya_session_started'),
    payload: z.strictObject({
      provider: z.literal('mock'),
      policyVersion: z.literal(teachingPolicyVersion),
      plannerVersion: z.literal('mock-planner-1'),
    }),
  }),
  z.strictObject({
    kind: z.literal('maya_explanation_started'),
    payload: z.strictObject({
      step,
      speechId,
      narration: text,
      durationMs: z.number().int().min(2500).max(10000),
      offsetMs: z.number().int().min(500).max(2000),
      generation: z.number().int().nonnegative(),
      boardAlreadyApplied: z.boolean(),
    }),
  }),
  z.strictObject({
    kind: z.literal('maya_whiteboard_issued'),
    payload: z.strictObject({
      step,
      speechId,
      action: mayaCommandSchema.shape.action,
    }),
  }),
  z.strictObject({
    kind: z.literal('maya_whiteboard_applied'),
    payload: z.strictObject({ step, speechId, command: mayaCommandSchema }),
  }),
  z.strictObject({
    kind: z.literal('maya_explanation_completed'),
    payload: z.strictObject({ step, speechId, question: text.nullable() }),
  }),
  z.strictObject({
    kind: z.literal('maya_tool_validated'),
    payload: z.strictObject({
      name: z.literal('show_whiteboard_content'),
      callId: z.uuid(),
    }),
  }),
  z.strictObject({
    kind: z.literal('maya_interrupted'),
    payload: z.strictObject({ speechId: speechId.nullable() }),
  }),
  z.strictObject({
    kind: z.literal('maya_hint'),
    payload: z.strictObject({ step, text }),
  }),
  z.strictObject({
    kind: z.literal('maya_response_simulated'),
    payload: z.strictObject({ step, text }),
  }),
  z.strictObject({
    kind: z.literal('maya_session_stopped'),
    payload: z.strictObject({
      reason: z.enum(['explicit', 'duration', 'lesson_closed']),
    }),
  }),
]);
export type Explanation = {
  speechId: string;
  step: number;
  narration: string;
  durationMs: number;
  offsetMs: number;
  generation: number;
  createdAt: string;
  applied: boolean;
  completed: boolean;
};
export function teachingView(
  events: ClassroomEvent[],
  epoch: number,
): {
  scene: MayaScene;
  started: boolean;
  stopped: boolean;
  explanation: Explanation | null;
  question: string | null;
  feedback: string | null;
} {
  const scene: MayaScene = new Map();
  let started = false,
    stopped = false;
  let explanation: {
    speechId: string;
    step: number;
    narration: string;
    durationMs: number;
    offsetMs: number;
    generation: number;
    createdAt: string;
    applied: boolean;
    completed: boolean;
  } | null = null;
  let question: string | null = null,
    feedback: string | null = null;
  for (const event of orderedEvents(events)) {
    if (event.kind === 'clear_board') scene.clear();
    if (event.source !== 'maya_mock') continue;
    const parsed = mockEventSchema.parse({
      kind: event.kind,
      payload: event.payload,
    });
    switch (parsed.kind) {
      case 'maya_session_started':
        started = true;
        break;
      case 'maya_explanation_started':
        explanation = {
          ...parsed.payload,
          createdAt: event.createdAt,
          applied: parsed.payload.boardAlreadyApplied,
          completed: false,
        };
        question = null;
        feedback = null;
        break;
      case 'maya_whiteboard_applied': {
        const command = parsed.payload.command;
        if (
          command.lessonId !== event.lessonId ||
          command.epoch !== event.epoch ||
          command.sequence !== event.sequence
        )
          throw new Error('Invalid board event envelope');
        const action = command.action;
        if (action.kind === 'clear_board') scene.clear();
        else if (action.kind === 'erase') scene.delete(action.targetId);
        else scene.set(command.commandId, action);
        if (explanation?.speechId === parsed.payload.speechId)
          explanation.applied = true;
        break;
      }
      case 'maya_explanation_completed':
        if (explanation?.speechId === parsed.payload.speechId) {
          explanation.completed = true;
          question = parsed.payload.question;
        }
        break;
      case 'maya_interrupted':
        explanation = null;
        question = null;
        break;
      case 'maya_hint':
      case 'maya_response_simulated':
        feedback = parsed.payload.text;
        break;
      case 'maya_session_stopped':
        stopped = true;
        explanation = null;
        break;
    }
  }
  if (explanation?.generation !== epoch) explanation = null;
  return { scene, started, stopped, explanation, question, feedback };
}
