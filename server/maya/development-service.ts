import 'server-only';
import { createHash } from 'node:crypto';
import { developerRequestSchema } from '@/features/maya/development';
import {
  authorizeDeveloper,
  liveApproval,
  type DeveloperIdentity,
} from './developer-auth';
import {
  DevelopmentSession,
  diskDevelopmentStore,
} from './development-session';
import { openAILiveTransport } from './live-transport';
import { LiveDevelopmentSession, openAILiveReasoner } from './live-session';
type Entry = {
  requestId: string;
  fingerprint: string;
  session: DevelopmentSession | LiveDevelopmentSession;
  starting: Promise<unknown>;
};
const registryKey = Symbol.for('bloomers.maya.developer.sessions');
const globalRegistry = globalThis as typeof globalThis & {
  [registryKey]?: Map<string, Entry>;
};
const sessions = (globalRegistry[registryKey] ??= new Map<string, Entry>());
export function ownedDevelopmentSession(
  id: string,
  identity: DeveloperIdentity,
) {
  const found = sessions.get(id)?.session;
  if (
    !found ||
    found.identity.userId !== identity.userId ||
    found.identity.authSessionId !== identity.authSessionId
  )
    throw new Error('Development session unavailable.');
  return found;
}
export async function developerOperation(origin: string, raw: unknown) {
  const identity = await authorizeDeveloper(origin);
  const request = developerRequestSchema.parse(raw);
  if (request.action === 'start') {
    const approval = liveApproval(identity);
    const fingerprint = createHash('sha256').update(request.sdp).digest('hex');
    // Exact retries cannot create another provider call; uncertain setup is not automatically retried.
    for (const entry of sessions.values())
      if (entry.requestId === request.requestId) {
        ownedDevelopmentSession(entry.session.id, identity);
        if (entry.fingerprint !== fingerprint)
          throw new Error('Retry SDP differs from the original request.');
        return entry.starting;
      }
    if (sessions.size >= 10)
      throw new Error(
        'Restart only after verified cleanup of local experiments.',
      );
    const session = new LiveDevelopmentSession(
      identity,
      approval,
      openAILiveTransport(),
      diskDevelopmentStore(),
      openAILiveReasoner(),
    );
    const starting = session.start(request.sdp);
    sessions.set(session.id, {
      requestId: request.requestId,
      fingerprint,
      session,
      starting,
    });
    return starting;
  }
  const session = ownedDevelopmentSession(request.sessionId, identity);
  return session.run(async () => {
    await session.tick();
    if (request.action === 'ink') {
      if (!(session instanceof LiveDevelopmentSession))
        throw new Error('Live drawing unavailable.');
      return session.ink(
        request.commandId,
        request.expectedEpoch,
        request.stroke,
      );
    }
    if (request.action === 'ready') return session.ready();
    else if (request.action === 'pause') return session.pause();
    else if (request.action === 'resume') return session.resume();
    else if (request.action === 'stop') await session.stop('ended');
    else if (request.action === 'interrupt') await session.interrupt();
    else if (request.action === 'heartbeat') session.heartbeat();
    else if (request.action === 'diagnostic') {
      return session.diagnostic({
        stage: request.stage,
        peerState: request.peerState,
        channelState: request.channelState,
        microphoneStopped: request.microphoneStopped,
      });
    } else if (request.action === 'ack')
      return session.acknowledge(
        request.turnId,
        request.responseId,
        request.epoch,
      );
    return session.snapshot();
  });
}
