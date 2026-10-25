'use client';
import { useEffect, useRef, useState } from 'react';
import { DevelopmentVoice } from '@/features/maya/development-voice';
import {
  developerSnapshotSchema,
  syntheticLesson,
} from '@/features/maya/development';
import type { DeveloperSnapshot } from '@/features/maya/development';
import { teachingScenarios } from '@/features/maya/evaluation';
import {
  mayaCommandSchema,
  normalizePoint,
  studentCommandSchema,
  type Point,
  type MayaScene,
} from '@/features/classroom/protocol';
import { MayaBoard } from './teaching';
import type { DevelopmentVoiceState } from '@/features/maya/development-voice';
export function DevelopmentRoom({
  ready,
  blockedReason,
}: {
  ready: boolean;
  blockedReason?: string;
}) {
  const audio = useRef<HTMLAudioElement>(null),
    voice = useRef<DevelopmentVoice | null>(null);
  const [state, setState] = useState<DevelopmentVoiceState>('off'),
    [snapshot, setSnapshot] = useState<DeveloperSnapshot | null>(null),
    [optIn, setOptIn] = useState(false),
    [error, setError] = useState(''),
    [microphoneMuted, setMicrophoneMuted] = useState(false),
    [boardVisible, setBoardVisible] = useState(true),
    [pen, setPen] = useState(false),
    [draft, setDraft] = useState<Point[]>([]);
  const pointer = useRef<number | null>(null);
  const ink = useRef<Point[]>([]);
  useEffect(() => {
    voice.current = new DevelopmentVoice(audio.current!, setState, setSnapshot);
    const saved = sessionStorage.getItem('maya-development-session');
    if (saved)
      void fetch(`/developer/maya/session?id=${encodeURIComponent(saved)}`)
        .then(async (r) => {
          if (!r.ok) return;
          setSnapshot(developerSnapshotSchema.parse(await r.json()));
          // Refresh recovers visuals, never reconnects/captures. Stop the orphaned provider session.
          const stopped = await fetch('/developer/maya/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'stop', sessionId: saved }),
          });
          if (stopped.ok)
            setSnapshot(developerSnapshotSchema.parse(await stopped.json()));
        })
        .catch(() =>
          setError(
            'Saved experiment unavailable; inspect local termination status.',
          ),
        );
    const stop = () => {
      void voice.current?.stop();
    };
    window.addEventListener('pagehide', stop);
    return () => {
      window.removeEventListener('pagehide', stop);
      stop();
    };
  }, []);
  const scene: MayaScene = new Map();
  for (const event of snapshot?.events ?? [])
    if (event.kind === 'board_applied') {
      const command = mayaCommandSchema.parse(event.payload.command);
      if (
        command.lessonId !== snapshot!.id ||
        command.sequence !== event.sequence ||
        command.epoch !== event.epoch
      )
        throw new Error('Invalid experiment replay');
      if (command.action.kind === 'clear_board') scene.clear();
      else if (command.action.kind === 'erase')
        scene.delete(command.action.targetId);
      else scene.set(command.commandId, command.action);
    }
  async function start() {
    setError('');
    try {
      await voice.current?.start(optIn, 'live');
    } catch {
      setError(
        'Maya could not connect. Your microphone has been closed. Check cleanup before requesting another approved test; this approval cannot be reused.',
      );
    }
  }
  return (
    <main className="identity-shell maya-call-shell">
      <h1>Maya developer classroom</h1>
      <p>
        Adult-operated synthetic experiment · {syntheticLesson.fixture} · OpenAI
        gpt-live-1 · No student records or learning updates
      </p>
      <div className="maya-call-layout">
        <aside
          className="maya-participants"
          aria-label="Classroom participants"
        >
          <section className="maya-participant" aria-label="Maya teacher tile">
            <span className="maya-initial" aria-hidden="true">
              M
            </span>
            <h2>Maya · AI teacher</h2>
            <p>
              {state === 'speaking'
                ? 'Speaking'
                : state === 'thinking'
                  ? 'Thinking'
                  : state === 'listening'
                    ? 'Listening'
                    : state === 'paused'
                      ? 'Paused'
                      : state === 'permission'
                        ? 'Waiting for microphone permission'
                        : state === 'connecting'
                          ? 'Connecting'
                          : 'Not connected'}
            </p>
          </section>
          <section className="maya-participant" aria-label="Adult tester tile">
            <span className="maya-initial" aria-hidden="true">
              You
            </span>
            <h2>You · Adult tester</h2>
            <p>Camera off</p>
            <p>Camera preview awaits approved consent and access safeguards.</p>
          </section>
        </aside>
        <section
          className="maya-board-stage"
          aria-label="Shared lesson whiteboard"
        >
          <h2>Grade 8 mathematics</h2>
          <p>{syntheticLesson.objective}</p>
          <button
            aria-pressed={pen}
            disabled={snapshot?.status !== 'active'}
            onClick={() => setPen(!pen)}
          >
            {pen ? 'Put pen down' : 'Draw on board'}
          </button>
          <svg
            style={{ display: boardVisible ? undefined : 'none' }}
            className="whiteboard"
            viewBox="0 0 1000 650"
            onPointerDown={(e) => {
              if (
                !pen ||
                snapshot?.status !== 'active' ||
                pointer.current !== null
              )
                return;
              pointer.current = e.pointerId;
              e.currentTarget.setPointerCapture(e.pointerId);
              ink.current = [
                normalizePoint(
                  e.clientX,
                  e.clientY,
                  e.currentTarget.getBoundingClientRect(),
                ),
              ];
              setDraft(ink.current);
            }}
            onPointerMove={(e) => {
              if (pointer.current !== e.pointerId || ink.current.length >= 256)
                return;
              ink.current = [
                ...ink.current,
                normalizePoint(
                  e.clientX,
                  e.clientY,
                  e.currentTarget.getBoundingClientRect(),
                ),
              ];
              setDraft(ink.current);
            }}
            onPointerUp={(e) => {
              if (pointer.current !== e.pointerId) return;
              pointer.current = null;
              e.currentTarget.releasePointerCapture(e.pointerId);
              const points = ink.current;
              ink.current = [];
              setDraft([]);
              if (points.length >= 2 && snapshot)
                void voice.current
                  ?.draw(
                    {
                      kind: 'stroke',
                      payload: { points, color: '#263b36', width: 4 },
                    },
                    snapshot.epoch,
                  )
                  .catch(() =>
                    setError(
                      'Drawing was not saved. The lesson can continue; try speaking your answer.',
                    ),
                  );
            }}
            onPointerCancel={() => {
              pointer.current = null;
              ink.current = [];
              setDraft([]);
            }}
            role="img"
            aria-label="Synthetic shared mathematics board"
          >
            <MayaBoard scene={scene} />
            {(snapshot?.events ?? [])
              .filter((e) => e.kind === 'student_ink')
              .map((e) => {
                const stroke = studentCommandSchema.options[0].parse(
                  e.payload.stroke,
                ).payload;
                return (
                  <polyline
                    key={e.id}
                    points={stroke.points
                      .map((p) => `${p.x * 1000},${p.y * 650}`)
                      .join(' ')}
                    fill="none"
                    stroke={stroke.color}
                    strokeWidth={stroke.width}
                  />
                );
              })}
            <polyline
              points={draft.map((p) => `${p.x * 1000},${p.y * 650}`).join(' ')}
              fill="none"
              stroke="#263b36"
              strokeWidth={4}
            />
          </svg>
          {!boardVisible && (
            <p>
              The whiteboard is hidden on this device. Maya’s session continues.
            </p>
          )}
        </section>
      </div>
      <p role="status">
        Microphone{' '}
        {state === 'off' || state === 'interrupted' || state === 'paused'
          ? 'OFF'
          : microphoneMuted
            ? 'muted'
            : state === 'permission'
              ? 'permission requested'
              : 'active'}{' '}
        · Maya {state} · Connection{' '}
        {['listening', 'speaking', 'thinking', 'paused'].includes(state)
          ? 'connected'
          : ['permission', 'connecting'].includes(state)
            ? 'connecting'
            : 'disconnected'}
      </p>
      <p>
        Camera, uploads and recording disabled. Live teaching requires a current
        founder approval. A usage threshold is an estimate, not a guaranteed
        spending cap.
      </p>
      <label>
        <input
          type="checkbox"
          checked={optIn}
          onChange={(e) => setOptIn(e.target.checked)}
        />
        I am an adult, will use only the synthetic lesson, and explicitly enable
        my microphone for this approved test.
      </label>
      <p>
        Maya leads the conversation and board. Speak naturally; no Next or
        Continue is needed.
      </p>
      <div
        className="maya-controls maya-call-controls"
        aria-label="Call controls"
      >
        <button
          disabled={
            !['listening', 'speaking', 'thinking', 'paused'].includes(state)
          }
          aria-pressed={microphoneMuted}
          onClick={() => {
            const muted = !microphoneMuted;
            setMicrophoneMuted(muted);
            voice.current?.setMicrophoneMuted(muted);
          }}
        >
          {microphoneMuted ? 'Unmute microphone' : 'Mute microphone'}
        </button>
        <button
          disabled
          title="Camera requires approved consent and access safeguards"
        >
          Camera off
        </button>
        <button
          aria-pressed={boardVisible}
          onClick={() => setBoardVisible(!boardVisible)}
        >
          {boardVisible ? 'Hide whiteboard' : 'Show whiteboard'}
        </button>
        <button
          disabled={!ready || !optIn || state !== 'off' || !!snapshot}
          onClick={() => void start()}
        >
          Start approved voice test
        </button>
        <button
          disabled={
            !snapshot || !['active', 'paused'].includes(snapshot.status)
          }
          onClick={() =>
            void (
              state === 'paused'
                ? voice.current!.resume()
                : voice.current!.pause()
            ).catch(() => {
              setError('Pause/resume failed; ending the session.');
              void voice.current?.stop();
            })
          }
        >
          {state === 'paused' ? 'Resume lesson' : 'Pause lesson'}
        </button>
        <button
          disabled={state === 'off' || state === 'paused'}
          onClick={() =>
            void voice.current
              ?.interrupt()
              .catch(() =>
                setError('Interruption failed; stop the experiment.'),
              )
          }
        >
          Interrupt Maya
        </button>
        <button
          disabled={state === 'off'}
          onClick={() => void voice.current?.stop()}
        >
          Stop and disconnect
        </button>
      </div>
      {!ready && (
        <p>
          Live connection disabled: current scoped approval and server
          configuration required. {blockedReason}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <audio ref={audio} />
      <details>
        <summary>Adult test prompts</summary>
        {Object.entries(teachingScenarios).map(([name, scenario]) => (
          <section key={name}>
            <h3>{name}</h3>
            <p>{scenario.utterance}</p>
            <p>{scenario.rubric.join(' · ')}</p>
          </section>
        ))}
      </details>
      <p>
        <a href="/parent">Return to parent mode</a>
      </p>
      {snapshot && (
        <details open={['abandoned', 'ended'].includes(snapshot.status)}>
          <summary>Experiment telemetry</summary>

          {snapshot.status === 'abandoned' && (
            <p role="alert">
              Provider connection failed. This approval has been consumed; a new
              paid start is blocked pending cleanup and renewed approval.
            </p>
          )}
          <p>
            Session {snapshot.status}. Termination{' '}
            {snapshot.metrics.terminationConfirmed
              ? 'confirmed by provider response'
              : 'not confirmed'}
            .
          </p>
          <p>
            {snapshot.metrics.usageComplete
              ? 'Provider usage reported; cost remains an estimate.'
              : 'Provider usage incomplete. The displayed estimate does not establish actual cost.'}
          </p>
          <pre>{JSON.stringify(snapshot.metrics, null, 2)}</pre>
          <p>
            Timing values are server/browser event proxies, not measured audio
            sample alignment. Raw audio and conversations are not saved by the
            application.
          </p>
        </details>
      )}
    </main>
  );
}
