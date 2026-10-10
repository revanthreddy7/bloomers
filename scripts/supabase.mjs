import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { delimiter, resolve } from 'node:path';

// Docker Desktop may be freshly installed without its helpers on shell PATH.
// Include its known installation path without changing the user's Docker config.
const env = { ...process.env };
const dockerBin = '/Applications/Docker.app/Contents/Resources/bin';
if (process.platform === 'darwin' && existsSync(dockerBin)) {
  env.PATH = `${env.PATH ?? ''}${delimiter}${dockerBin}`;
}
const child = spawn(
  resolve('node_modules/.bin/supabase'),
  process.argv.slice(2),
  {
    env,
    stdio: 'inherit',
  },
);
child.on('error', () => {
  console.error('Could not run the project Supabase CLI. Run npm ci first.');
  process.exitCode = 1;
});
child.on('exit', (code) => {
  process.exitCode = code ?? 1;
});
