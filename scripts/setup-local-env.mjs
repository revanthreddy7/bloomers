import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

try {
  const result = JSON.parse(
    execFileSync(
      resolve('node_modules/.bin/supabase'),
      ['status', '--output', 'json'],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    ),
  );
  const { API_URL, ANON_KEY, SERVICE_ROLE_KEY } = result;
  if (!API_URL || !ANON_KEY || !SERVICE_ROLE_KEY)
    throw new Error('Missing local values');
  if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(API_URL).hostname))
    throw new Error('Not a local Supabase instance');
  writeFileSync(
    '.env.local',
    `NEXT_PUBLIC_SUPABASE_URL=${API_URL}\nNEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}\nSUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}\nAPP_ORIGIN=http://localhost:3000\n`,
    { flag: 'wx', mode: 0o600 },
  );
  console.info(
    'Created .env.local from the running local Supabase stack. Keys were not printed.',
  );
} catch (error) {
  if (error.code === 'EEXIST') {
    console.error('.env.local already exists; leaving it unchanged.');
  } else {
    console.error(
      'Could not read local Supabase credentials. Run npm run db:start first.',
    );
  }
  process.exitCode = 1;
}
