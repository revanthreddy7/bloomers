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
  type MayaScene,
} from '@/features/classroom/protocol';
import { MayaBoard } from './teaching';
import type { DevelopmentVoiceState } from '@/features/maya/development-voice';
export function DevelopmentRoom({ ready }: { ready: boolean }) {
  const audio = useRef<HTMLAudioElement>(null),
    voice = useRef<DevelopmentVoice | null>(null);
  const [state, setState] = useState<DevelopmentVoiceState>('off'),
    [snapshot, setSnapshot] = useState<DeveloperSnapshot | null>(null),
    [optIn, setOptIn] = useState(false),
    [error, setError] = useState('');
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
      await voice.current?.start(optIn);
    } catch {
      setError(
        'Connection denied or unavailable. Check the approved local configuration.',
      );
    }
  }
  return (
    <main className="identity-shell">
      <h1>Maya developer classroom</h1>
      <p>
        Adult-operated synthetic experiment · {syntheticLesson.fixture} · OpenAI
        gpt-realtime-2.1 · No student records or learning updates
      </p>
      <h2>{syntheticLesson.objective}</h2>
      <p role="status">
        Microphone{' '}
        {state === 'off' || state === 'interrupted' || state === 'paused'
          ? 'OFF'
          : state === 'permission'
            ? 'permission requested'
            : 'active'}{' '}
        · Maya {state} · Connection{' '}
        {['listening', 'speaking', 'paused'].includes(state)
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
      <div className="maya-controls">
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
          configuration required.
        </p>
      )}
      {error && <p role="alert">{error}</p>}
      <audio ref={audio} />
      <svg
        className="whiteboard"
        viewBox="0 0 1000 650"
        role="img"
        aria-label="Synthetic shared mathematics board"
      >
        <MayaBoard scene={scene} />
      </svg>
      <h2>Evaluation prompts</h2>
      {Object.entries(teachingScenarios).map(([name, scenario]) => (
        <section key={name}>
          <h3>{name}</h3>
          <p>{scenario.utterance}</p>
          <p>{scenario.rubric.join(' · ')}</p>
        </section>
      ))}
      <p>
        <a href="/parent">Return to parent mode</a>
      </p>
      {snapshot && (
        <>
          <h2>Experiment telemetry</h2>
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
        </>
      )}
    </main>
  );
}
