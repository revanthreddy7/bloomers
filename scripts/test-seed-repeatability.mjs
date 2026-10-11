import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
const config = readFileSync('supabase/config.toml', 'utf8');
const project = config.match(/^project_id\s*=\s*"([a-zA-Z0-9_-]+)"/m)?.[1];
if (!project) throw new Error('Missing local project ID');
const tables = [
  'curricula',
  'courses',
  'units',
  'topics',
  'skills',
  'skill_prerequisites',
  'course_skill_map',
  'questions',
  'curriculum_versions',
  'audit_logs',
];
const fingerprint =
  'select ' +
  tables
    .map(
      (table) =>
        `(select md5(coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text)::text,'[]')) from public.${table} t) as ${table}`,
    )
    .join(', ');
const comparisons = tables
  .map((table) => `a.${table} is distinct from b.${table}`)
  .join(' or ');
const seed = readFileSync('supabase/seed.sql', 'utf8');
const sql = `begin; create temp table seed_before as ${fingerprint};\n${seed}\n${seed}\ncreate temp table seed_after as ${fingerprint}; do $test$ begin if exists(select 1 from seed_before a cross join seed_after b where ${comparisons}) then raise exception 'Seed changed existing catalog or publication'; end if; end $test$; rollback;`;
const result = spawnSync(
  'docker',
  [
    'exec',
    '-i',
    `supabase_db_${project}`,
    'psql',
    '-U',
    'postgres',
    '-d',
    'postgres',
    '-v',
    'ON_ERROR_STOP=1',
    '-q',
  ],
  { input: sql, encoding: 'utf8' },
);
if (result.error) throw result.error;
if (result.status !== 0) {
  process.stderr.write(result.stderr || 'Seed verification failed\n');
  process.exit(result.status || 1);
}
console.log(
  'Seed replay passed: two executions preserved catalog, private questions, versions and audit history (rolled back).',
);
