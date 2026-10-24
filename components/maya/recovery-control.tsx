'use client';
import { useState } from 'react';
export type RecoveryView = {
  sessionId: string;
  recoverAfter: string;
  eligible: boolean;
  status: string;
  leaseReleased: boolean;
};
export function RecoveryControl({ incident }: { incident: RecoveryView }) {
  const [ack, setAck] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  async function recover() {
    setBusy(true);
    try {
      const response = await fetch('/developer/maya/recovery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: incident.sessionId,
          acknowledgeRemoteTerminationUnconfirmed: ack,
          confirmLocalResourcesClosed: ack,
        }),
      });
      if (!response.ok) throw new Error('Recovery denied.');
      setMessage(
        'Expired-session recovery recorded. Remote termination remains unconfirmed. Live testing is still disabled pending fresh founder approval.',
      );
    } catch {
      setMessage(
        'Recovery denied or busy. Keep the safety lock and inspect the recovery runbook.',
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="identity-shell" aria-label="Expired-session recovery">
      <h2>Previous failed session</h2>
      <p>
        Status: {incident.status.replaceAll('_', ' ')}. Recovery permitted after{' '}
        {incident.recoverAfter}. Provider termination is unconfirmed.
      </p>
      {incident.leaseReleased ? (
        <p>Recovery already recorded. No live approval has been issued.</p>
      ) : (
        <>
          <label>
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => setAck(e.target.checked)}
            />
            I acknowledge remote termination was not confirmed, and confirm all
            old classroom tabs, microphone capture and local connections are
            closed.
          </label>
          <button
            type="button"
            disabled={!incident.eligible || !ack || busy || !!message}
            onClick={() => void recover()}
          >
            Recover expired session
          </button>
        </>
      )}
      {message && <p role="status">{message}</p>}
    </section>
  );
}
