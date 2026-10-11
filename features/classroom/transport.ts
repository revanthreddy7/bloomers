import {
  replaySchema,
  mayaCommandSchema,
  type ClassroomEvent,
  type MayaCommand,
} from './protocol';
export interface ClassroomTransport {
  replay(afterSequence: number): Promise<ClassroomEvent[]>;
  close(): void;
}
// A playback acknowledgment, not model emission time, supplies the future clock.
export interface VoiceTransport {
  connect(authorizedCredential: string): Promise<void>;
  interrupt(speechId: string): Promise<void>;
  disconnect(): void;
}
export class InstructionTimeline {
  epoch = 0;
  private pending: MayaCommand[] = [];
  enqueue(command: MayaCommand) {
    mayaCommandSchema.parse(command);
    if (this.pending.length >= 256) throw new Error('Instruction queue full');
    if (command.epoch !== this.epoch) throw new Error('Cancelled instruction');
    this.pending.push(command);
    this.pending.sort((a, b) => a.sequence - b.sequence);
  }
  interrupt() {
    this.epoch++;
    this.pending = [];
  }
  due(
    speechId: string,
    offsetMs: number,
    anchor: 'speech_start' | 'playback_offset' | 'speech_end',
  ) {
    const due = this.pending.filter(
      (c) =>
        c.synchronization?.speechId === speechId &&
        c.synchronization.anchor === anchor &&
        c.synchronization.offsetMs <= offsetMs,
    );
    this.pending = this.pending.filter((c) => !due.includes(c));
    return due;
  }
}
export class LocalReplayTransport implements ClassroomTransport {
  private closed = false;
  constructor(private events: ClassroomEvent[]) {}
  async replay(afterSequence: number) {
    if (this.closed) throw new Error('Transport closed');
    return this.events
      .filter((e) => e.sequence > afterSequence)
      .sort((a, b) => a.sequence - b.sequence);
  }
  close() {
    this.closed = true;
  }
}

export class HttpClassroomTransport implements ClassroomTransport {
  private closed = false;
  constructor(private endpoint: string) {}
  async snapshot(afterSequence: number) {
    if (this.closed) throw new Error('Transport closed');
    const response = await fetch(`${this.endpoint}?after=${afterSequence}`, {
      cache: 'no-store',
      redirect: 'error',
    });
    if (!response.ok) throw new Error('Classroom connection unavailable.');
    return replaySchema.parse(await response.json());
  }
  async replay(afterSequence: number) {
    return (await this.snapshot(afterSequence)).events;
  }
  close() {
    this.closed = true;
  }
}
