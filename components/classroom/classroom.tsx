'use client';
import Link from 'next/link';
import { HttpClassroomTransport } from '@/features/classroom/transport';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  normalizePoint,
  replayBoard,
  orderedEvents,
  type ClassroomEvent,
  type ClassroomSnapshot,
  type Point,
  type StudentCommand,
} from '@/features/classroom/protocol';
import type { ClassroomContext } from '@/server/classroom/service';
import { formatInstant } from '@/features/application/models';
function path(points: Point[]) {
  return points
    .map((p, i) => `${i ? 'L' : 'M'}${p.x * 1000},${p.y * 650}`)
    .join(' ');
}
export function Classroom({
  context,
  initial,
}: {
  context: ClassroomContext;
  initial: ClassroomSnapshot;
}) {
  const endpoint = `/preview/${context.studentId}/classroom/${context.scheduleId}/events`;
  const transport = useRef<HttpClassroomTransport | null>(null);
  const [snapshot, setSnapshot] = useState(initial),
    [events, setEvents] = useState<ClassroomEvent[]>(initial.events),
    [tool, setTool] = useState<'pen' | 'eraser'>('pen'),
    [draft, setDraft] = useState<Point[]>([]),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [online, setOnline] = useState(true),
    [seconds, setSeconds] = useState(0);
  const points = useRef<Point[]>([]),
    cursor = useRef(initial.events.at(-1)?.sequence ?? 0),
    all = useRef(initial.events),
    polling = useRef(false),
    pointer = useRef<number | null>(null),
    mounted = useRef(true),
    disconnected = useRef(false);
  const [retry, setRetry] = useState<{
    kind: 'lifecycle' | 'append';
    input: unknown;
  } | null>(null);
  const room = snapshot.lesson,
    active = room?.status === 'active';
  const roomId = room?.id,
    roomStatus = room?.status;
  const board = replayBoard(events);
  const refresh = useCallback(async () => {
    if (polling.current) return;
    polling.current = true;
    try {
      for (let page = 0; page < 13; page++) {
        if (!transport.current)
          transport.current = new HttpClassroomTransport(endpoint);
        const next = await transport.current.snapshot(cursor.current);
        if (!mounted.current) return;
        const merged = orderedEvents([...all.current, ...next.events]);
        all.current = merged;
        cursor.current = merged.at(-1)?.sequence ?? 0;
        setEvents(merged);
        setSnapshot(next);
        setOnline(true);
        if (cursor.current >= (next.lesson?.sequence ?? 0)) break;
      }
    } catch {
      if (mounted.current) {
        setOnline(false);
        setError(
          'Connection interrupted. Drawing is disabled until recovery. Your saved work remains available.',
        );
      }
    } finally {
      polling.current = false;
    }
  }, [endpoint]);
  const send = useCallback(
    async (kind: 'lifecycle' | 'append', input: unknown) => {
      setBusy(true);
      setError('');
      let responseReceived = false;
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ kind, input }),
          redirect: 'error',
        });
        const result = await response.json();
        responseReceived = true;
        if (!response.ok) {
          setRetry(null);
          throw new Error(result.error ?? 'Classroom action failed.');
        }
        setRetry(null);
        await refresh();
      } catch (reason) {
        if (!responseReceived) setRetry({ kind, input });
        setError(
          reason instanceof Error ? reason.message : 'Classroom action failed.',
        );
      } finally {
        setBusy(false);
      }
    },
    [endpoint, refresh],
  );
  const epoch = room?.epoch;
  useEffect(() => {
    if (!online) {
      disconnected.current = true;
      return;
    }
    if (
      disconnected.current &&
      active &&
      !busy &&
      !retry &&
      epoch !== undefined
    ) {
      disconnected.current = false;
      void send('append', {
        commandId: crypto.randomUUID(),
        expectedEpoch: epoch,
        command: { kind: 'connection_recovered', payload: {} },
      });
    }
  }, [online, active, busy, retry, epoch, send]);
  function lifecycle(action: 'start' | 'pause' | 'resume' | 'end') {
    if (busy) return;
    if (
      action === 'end' &&
      !window.confirm(
        'End this classroom preview? Saved work will remain, and the preview cannot be restarted.',
      )
    )
      return;
    void send('lifecycle', { commandId: crypto.randomUUID(), action });
  }
  function command(command: StudentCommand) {
    if (!room || busy || !active || !online) return;
    void send('append', {
      commandId: crypto.randomUUID(),
      expectedEpoch: room.epoch,
      command,
    });
  }
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const interval = setInterval(() => {
      void refresh();
    }, 2000);
    const recover = () => {
      void refresh();
    };
    window.addEventListener('online', recover);
    return () => {
      mounted.current = false;
      transport.current?.close();
      transport.current = null;
      clearInterval(interval);
      window.removeEventListener('online', recover);
    };
  }, [refresh]);
  useEffect(() => {
    if (!roomId || !['active', 'paused'].includes(roomStatus!)) return;
    const heartbeat = setInterval(() => {
      if (document.visibilityState === 'visible')
        void fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            kind: 'lifecycle',
            input: { commandId: crypto.randomUUID(), action: 'heartbeat' },
          }),
        })
          .then(() => refresh())
          .catch(() => setOnline(false));
    }, 30000);
    return () => clearInterval(heartbeat);
  }, [roomId, roomStatus, endpoint, refresh]);
  useEffect(() => {
    const timer = setInterval(
      () =>
        setSeconds(
          room?.startedAt
            ? Math.max(
                0,
                Math.floor(
                  (Date.parse(room.endedAt ?? new Date().toISOString()) -
                    Date.parse(room.startedAt)) /
                    1000,
                ),
              )
            : 0,
        ),
      1000,
    );
    return () => clearInterval(timer);
  }, [room?.startedAt, room?.endedAt]);
  useEffect(() => {
    points.current = [];
    pointer.current = null;
    setDraft([]);
  }, [room?.epoch]);
  const enabled = active && online && !busy && !retry;
  const eligible =
    context.reservation.status === 'scheduled' &&
    Date.parse(context.reservation.ends_at) > Date.now();
  return (
    <div className="classroom-shell">
      <header className="classroom-heading">
        <div>
          <div className="eyebrow">SUPERVISED LOCAL CLASSROOM PREVIEW</div>
          <h1>Maya’s classroom</h1>
          <p>
            Maya AI is inactive. Keep your parent present; this is a rehearsal,
            with no attendance or assessment credit.
          </p>
        </div>
        <div>
          <strong aria-live="polite" data-testid="lesson-state">
            {room?.status ?? 'scheduled'}
          </strong>
          <p>
            {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}{' '}
            elapsed wall time
          </p>
          <span role="status">{online ? 'Connected' : 'Reconnecting'}</span>
        </div>
      </header>
      <section className="panel classroom-context">
        <h2>
          Lesson {context.reservation.lesson_position} · {context.course}
        </h2>
        <p>
          {context.topics.join(' · ')} · Curriculum version{' '}
          {context.curriculumVersion} · Plan version {context.planVersion}
        </p>
        <ul>
          {context.objectives.map((o) => (
            <li key={o}>{o}</li>
          ))}
        </ul>
        <p className="small">
          {formatInstant(
            context.reservation.starts_at,
            context.reservation.timezone ?? 'UTC',
          )}{' '}
          ·{' '}
          {Math.round(
            (Date.parse(context.reservation.ends_at) -
              Date.parse(context.reservation.starts_at)) /
              60000,
          )}{' '}
          scheduled minutes
        </p>
      </section>
      {error && (
        <p role="alert" className="feedback">
          {error}
        </p>
      )}
      {retry && (
        <button
          disabled={busy}
          onClick={() => void send(retry.kind, retry.input)}
        >
          Retry saved request
        </button>
      )}
      <div className="classroom-grid">
        <section
          className="panel whiteboard-panel"
          aria-label="Shared whiteboard"
        >
          <div
            className="board-toolbar"
            role="group"
            aria-label="Whiteboard tools"
          >
            <button
              disabled={!enabled}
              aria-pressed={tool === 'pen'}
              onClick={() => setTool('pen')}
            >
              Pen
            </button>
            <button
              disabled={!enabled}
              aria-pressed={tool === 'eraser'}
              onClick={() => setTool('eraser')}
            >
              Eraser
            </button>
            <button
              disabled={!enabled || !board.visible.length}
              onClick={() =>
                command({
                  kind: 'undo',
                  payload: { targetId: board.visible.at(-1)!.id },
                })
              }
            >
              Undo
            </button>
            <button
              disabled={!enabled || !board.hidden.length}
              onClick={() =>
                command({
                  kind: 'redo',
                  payload: { targetId: board.hidden.at(-1)!.id },
                })
              }
            >
              Redo
            </button>
            <button
              disabled={!enabled || !board.visible.length}
              onClick={() => {
                if (
                  window.confirm(
                    'Clear the shared whiteboard? This clears the current board for this preview.',
                  )
                )
                  command({
                    kind: 'clear_board',
                    payload: { confirmed: true },
                  });
              }}
            >
              Clear board
            </button>
          </div>
          <svg
            viewBox="0 0 1000 650"
            className="shared-whiteboard"
            role="img"
            aria-label="Interactive lesson whiteboard"
            data-testid="whiteboard"
            tabIndex={0}
            onPointerDown={(e) => {
              if (!enabled || pointer.current !== null) return;
              if (tool === 'eraser') {
                const target = (e.target as Element)
                  .closest('[data-stroke-id]')
                  ?.getAttribute('data-stroke-id');
                if (target)
                  command({ kind: 'erase', payload: { targetId: target } });
                return;
              }
              pointer.current = e.pointerId;
              e.currentTarget.setPointerCapture(e.pointerId);
              points.current = [
                normalizePoint(
                  e.clientX,
                  e.clientY,
                  e.currentTarget.getBoundingClientRect(),
                ),
              ];
              setDraft(points.current);
            }}
            onPointerMove={(e) => {
              if (pointer.current !== e.pointerId || !enabled) return;
              if (points.current.length < 256) {
                points.current = [
                  ...points.current,
                  normalizePoint(
                    e.clientX,
                    e.clientY,
                    e.currentTarget.getBoundingClientRect(),
                  ),
                ];
                setDraft(points.current);
              }
            }}
            onPointerUp={(e) => {
              if (pointer.current !== e.pointerId) return;
              pointer.current = null;
              e.currentTarget.releasePointerCapture(e.pointerId);
              if (points.current.length >= 2)
                command({
                  kind: 'stroke',
                  payload: {
                    points: points.current,
                    color: '#263b36',
                    width: 4,
                  },
                });
              points.current = [];
              setDraft([]);
            }}
            onPointerCancel={() => {
              pointer.current = null;
              points.current = [];
              setDraft([]);
            }}
          >
            <title>
              Shared whiteboard: use pen to draw, eraser to select a saved
              stroke.
            </title>
            {board.visible.map((s) => (
              <path
                key={s.id}
                data-stroke-id={s.id}
                d={path(s.points)}
                fill="none"
                stroke={s.color}
                strokeWidth={s.width}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            ))}
            {draft.length > 1 && (
              <path
                d={path(draft)}
                fill="none"
                stroke="#263b36"
                strokeWidth="4"
              />
            )}
          </svg>
          <p className="small">
            Student preview drawings · Saved after each stroke. Eraser removes a
            whole stroke. Drawing pauses during saving or reconnection.
          </p>
        </section>
        <aside className="panel conversation-panel">
          <h2>Maya</h2>
          <span className="status-badge">Tutor offline</span>
          <p>
            Voice and conversation will become available in a later phase. Your
            lesson objectives and shared whiteboard are ready for a supervised
            rehearsal.
          </p>
          <h3>Lesson timeline</h3>
          <ol className="simple-list">
            {events
              .filter(
                (e) =>
                  e.kind.startsWith('lesson_') ||
                  e.kind.startsWith('connection_'),
              )
              .slice(-10)
              .map((e) => (
                <li key={e.id}>{e.kind.replaceAll('_', ' ')} · preview</li>
              ))}
          </ol>
        </aside>
      </div>
      <section
        className="panel classroom-controls"
        aria-label="Lesson controls"
      >
        <button disabled aria-label="Microphone off — disabled">
          Microphone OFF
        </button>
        <button disabled aria-label="Camera off — disabled">
          Camera OFF
        </button>
        <button disabled>Show Maya my work · Coming soon</button>
        {!room && (
          <button
            disabled={busy || !eligible}
            onClick={() => lifecycle('start')}
          >
            Start classroom preview
          </button>
        )}
        {room?.status === 'active' && (
          <button disabled={busy || !online} onClick={() => lifecycle('pause')}>
            Pause lesson
          </button>
        )}
        {room?.status === 'paused' && (
          <button
            disabled={busy || !online}
            onClick={() => lifecycle('resume')}
          >
            Resume lesson
          </button>
        )}
        {room && ['active', 'paused', 'ready'].includes(room.status) && (
          <button disabled={busy || !online} onClick={() => lifecycle('end')}>
            End lesson preview
          </button>
        )}
        <Link href={`/preview/${context.studentId}`}>Leave classroom</Link>
        <p className="small">
          Microphone, camera and uploads await approved consent and access
          safeguards. Leaving preserves the session for 15 minutes; use End to
          finish or Return to parent mode to abandon it explicitly.
        </p>
        {!eligible && !room && (
          <p>This reservation has expired or is no longer scheduled.</p>
        )}
        {room && ['ended', 'abandoned'].includes(room.status) && (
          <p>
            This rehearsal is {room.status}. Saved work is read-only. No
            learning outcomes or attendance were created.
          </p>
        )}
      </section>
    </div>
  );
}
