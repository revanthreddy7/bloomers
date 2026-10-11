import 'server-only';
import { z } from 'zod';
import {
  toolInputSchema,
  lessonContextSchema,
} from '@/features/maya/contracts';
import { teachingView } from '@/features/maya/events';
import { readClassroom } from '@/server/classroom/service';
import { replayBoard } from '@/features/classroom/protocol';
import { mayaContext } from './orchestrator';

// All write tools produce proposals only. The mock SQL producer independently
// derives its approved script; a future live producer needs separate approval.
export async function invokeMayaTool(
  studentId: string,
  scheduleId: string,
  input: unknown,
  callId: string = crypto.randomUUID(),
) {
  const { client, packageData, snapshot } = await mayaContext(
    studentId,
    scheduleId,
  );
  const parsed = toolInputSchema.safeParse(input);
  const { error } = await client.rpc('maya_mock_tool_audit', {
    p_schedule_id: scheduleId,
    p_request_id: z.uuid().parse(callId),
    p_name: parsed.success ? parsed.data.name : 'unapproved',
    p_outcome: parsed.success ? 'validated' : 'rejected',
  });
  if (error)
    throw new Error('Tool operation unavailable or its limit was reached.');
  if (!parsed.success)
    throw new Error('Tool schema or allowlist rejected the proposal.');
  const tool = parsed.data;
  switch (tool.name) {
    case 'get_lesson_context':
      return {
        type: 'context' as const,
        value: lessonContextSchema.parse(packageData),
      };
    case 'get_current_objective':
      return { type: 'objective' as const, value: packageData.objectives };
    case 'get_relevant_skills':
      return { type: 'skills' as const, value: packageData.skills };
    case 'get_current_board_state': {
      const events = [...snapshot.events];
      for (
        let page = 0;
        events.length < (snapshot.lesson?.sequence ?? 0) && page < 12;
        page++
      ) {
        const next = await readClassroom(
          studentId,
          scheduleId,
          events.at(-1)?.sequence ?? 0,
        );
        events.push(...next.events);
      }
      if (events.length !== snapshot.lesson?.sequence)
        throw new Error('Board recovery incomplete.');
      return {
        type: 'board' as const,
        value: {
          maya: [
            ...teachingView(events, snapshot.lesson.epoch).scene.values(),
          ].slice(-20),
          student: replayBoard(events).visible.slice(-20),
          partial:
            teachingView(events, snapshot.lesson.epoch).scene.size > 20 ||
            replayBoard(events).visible.length > 20,
        },
      };
    }
    case 'show_whiteboard_content':
      return { type: 'board_proposal' as const, value: tool.arguments.action };
    case 'write_whiteboard_math':
      return {
        type: 'board_proposal' as const,
        value: { kind: 'write_math' as const, ...tool.arguments },
      };
    case 'highlight_whiteboard_region':
      return {
        type: 'board_proposal' as const,
        value: { kind: 'highlight' as const, box: tool.arguments },
      };
    case 'ask_student_question':
    case 'request_student_explanation':
      return {
        type: 'question_proposal' as const,
        value: z.string().min(1).max(1000).parse(tool.arguments.question),
      };
  }
}
