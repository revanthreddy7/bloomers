'use client';
import { useEffect, useRef } from 'react';
import { teachingView } from '@/features/maya/events';
import type { MockOperation } from '@/features/maya/contracts';
import type {
  ClassroomEvent,
  ClassroomSnapshot,
  MayaScene,
} from '@/features/classroom/protocol';

export function MayaBoard({ scene }: { scene: MayaScene }) {
  return (
    <g data-testid="maya-board" pointerEvents="none">
      {[...scene.entries()].map(([id, action]) => {
        switch (action.kind) {
          case 'write_math':
          case 'write_text':
            return (
              <text
                key={id}
                data-maya-command={id}
                x={action.at.x * 1000}
                y={action.at.y * 650}
                fontSize="30"
                fill="#246bce"
              >
                {action.text}
              </text>
            );
          case 'highlight':
            return (
              <rect
                key={id}
                data-maya-command={id}
                x={action.box.x * 1000}
                y={action.box.y * 650}
                width={action.box.width * 1000}
                height={action.box.height * 650}
                fill="#e4bd5533"
                stroke="#947112"
                strokeWidth="3"
              />
            );
          case 'draw_line':
            return (
              <line
                key={id}
                x1={action.from.x * 1000}
                y1={action.from.y * 650}
                x2={action.to.x * 1000}
                y2={action.to.y * 650}
                stroke="#246bce"
                strokeWidth="3"
              />
            );
          case 'point_to':
            return (
              <circle
                key={id}
                cx={action.at.x * 1000}
                cy={action.at.y * 650}
                r="8"
                fill="#246bce"
              />
            );
          case 'draw_graph':
            return (
              <polyline
                key={id}
                points={action.points
                  .map((p) => `${p.x * 1000},${p.y * 650}`)
                  .join(' ')}
                fill="none"
                stroke="#246bce"
                strokeWidth="3"
              />
            );
          case 'draw_shape':
            return action.shape === 'rectangle' ? (
              <rect
                key={id}
                x={action.box.x * 1000}
                y={action.box.y * 650}
                width={action.box.width * 1000}
                height={action.box.height * 650}
                fill="none"
                stroke="#246bce"
                strokeWidth="3"
              />
            ) : (
              <ellipse
                key={id}
                cx={(action.box.x + action.box.width / 2) * 1000}
                cy={(action.box.y + action.box.height / 2) * 650}
                rx={action.box.width * 500}
                ry={action.box.height * 325}
                fill="none"
                stroke="#246bce"
                strokeWidth="3"
              />
            );
          default:
            return null;
        }
      })}
    </g>
  );
}
export function MockTeaching({
  events,
  room,
  enabled,
  canStop,
  onOperation,
}: {
  events: ClassroomEvent[];
  room: ClassroomSnapshot['lesson'];
  enabled: boolean;
  canStop: boolean;
  onOperation: (value: MockOperation) => Promise<void>;
}) {
  const view = teachingView(events, room?.epoch ?? 0);
  const clock = useRef<{ speechId: string; displayedAt: number } | null>(null);
  const issued = useRef(new Set<string>());
  const explanation = view.explanation;
  useEffect(() => {
    if (
      !explanation ||
      explanation.completed ||
      !enabled ||
      !room ||
      document.hidden
    )
      return;
    if (clock.current?.speechId !== explanation.speechId)
      clock.current = {
        speechId: explanation.speechId,
        displayedAt: Date.now(),
      };
    const tick = () => {
      if (document.hidden) return;
      const elapsed = Date.now() - clock.current!.displayedAt;
      const action =
        !explanation.applied && elapsed >= explanation.offsetMs
          ? 'apply'
          : explanation.applied && elapsed >= explanation.durationMs
            ? 'complete'
            : null;
      if (!action) return;
      const key = `${explanation.speechId}:${action}`;
      if (issued.current.has(key)) return;
      issued.current.add(key);
      void onOperation({
        commandId: crypto.randomUUID(),
        expectedEpoch: room.epoch,
        action,
        speechId: explanation.speechId,
      });
    };
    const timer = setInterval(tick, 250);
    tick();
    return () => clearInterval(timer);
  }, [explanation, enabled, onOperation, room]);
  function operate(action: MockOperation['action']) {
    if (!room || (action === 'stop' ? !canStop : !enabled)) return;
    void onOperation({
      commandId: crypto.randomUUID(),
      expectedEpoch: room.epoch,
      action,
      speechId: action === 'interrupt' ? (explanation?.speechId ?? null) : null,
    });
  }
  return (
    <section aria-label="Mock Maya teaching">
      <h3>Maya teaching simulation</h3>
      <p className="small">
        Scripted narration and conversation · No audio playback, microphone
        capture, external AI or assessment. Live OpenAI mode is blocked pending
        developer authorization and spending controls.
      </p>
      <p data-testid="maya-state">
        {view.stopped ||
        room?.status === 'ended' ||
        room?.status === 'abandoned'
          ? 'Simulation stopped'
          : explanation && !explanation.completed
            ? 'Narrating · simulated'
            : view.started
              ? 'Waiting for your next step · simulated'
              : 'Simulation ready'}
      </p>
      {explanation && (
        <p data-testid="maya-narration" aria-live="polite">
          {explanation.narration}
        </p>
      )}
      {view.question && <p data-testid="maya-question">{view.question}</p>}
      {view.feedback && <p aria-live="polite">{view.feedback}</p>}
      <div className="maya-controls">
        {!view.started && (
          <button disabled={!enabled} onClick={() => operate('start')}>
            Start Maya simulation
          </button>
        )}
        {view.started && !view.stopped && (
          <>
            <button
              disabled={
                !enabled ||
                (!!explanation && !explanation.completed) ||
                (explanation?.step ?? -1) >= 2
              }
              onClick={() => operate('advance')}
            >
              {explanation ? 'Next teaching step' : 'Continue Maya simulation'}
            </button>
            <button
              disabled={!enabled || !explanation || explanation.completed}
              onClick={() => operate('interrupt')}
            >
              Interrupt Maya
            </button>
            <button
              disabled={!enabled || !explanation}
              onClick={() => operate('hint')}
            >
              Ask for a hint · simulated
            </button>
            <button
              disabled={!enabled || !view.question}
              onClick={() => operate('respond')}
            >
              Try a simulated response
            </button>
            <button disabled={!canStop} onClick={() => operate('stop')}>
              Stop Maya simulation
            </button>
          </>
        )}
      </div>
      <p className="small">
        Five-minute maximum. Refresh recovers saved board work; an unfinished
        narration replays from its start. Interrupt preserves committed drawings
        and cancels pending actions.
      </p>
    </section>
  );
}
