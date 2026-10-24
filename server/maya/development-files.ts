import 'server-only';
import { mkdir, open, rename, unlink } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { randomUUID } from 'node:crypto';
export const developmentRoot = () =>
  process.env.MAYA_DEV_STORAGE_ROOT ?? process.cwd();

// All lease changes share this cross-process mutex. A crash leaves it fail-closed.
export async function withLeaseMutex<T>(dir: string, work: () => Promise<T>) {
  await mkdir(dir, { recursive: true, mode: 0o700 });
  const path = join(dir, 'lease-operation.lock');
  const lock = await open(path, 'wx', 0o600);
  try {
    await lock.writeFile(JSON.stringify({ processId: process.pid }));
    await lock.sync();
    return await work();
  } finally {
    await lock.close();
    await unlink(path);
  }
}
export async function atomicPrivateJson(path: string, value: unknown) {
  const tmp = `${path}.${randomUUID()}.tmp`;
  const file = await open(tmp, 'wx', 0o600);
  try {
    await file.writeFile(JSON.stringify(value, null, 2) + '\n');
    await file.sync();
  } finally {
    await file.close();
  }
  await rename(tmp, path);
  const directory = await open(dirname(path), 'r');
  try {
    await directory.sync();
  } finally {
    await directory.close();
  }
}
