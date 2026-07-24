// Deploy test: verify the package as a consumer would receive it.

import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repo = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(fs.readFileSync(path.join(repo, 'package.json'), 'utf8'));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'rjson-pack-test-'));
const npmCache = path.join(tmp, '.npm-cache');
const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, {
    stdio: ['ignore', 'pipe', 'inherit'],
    encoding: 'utf8',
    ...opts,
    env: { ...process.env, npm_config_cache: npmCache, ...opts.env },
  });

let failures = 0;
const check = (label, fn) => {
  try {
    fn();
    console.log(`ok   ${label}`);
  } catch (e) {
    failures++;
    console.error(`FAIL ${label}: ${e.message}`);
  }
};

try {
  const packOut = run('npm', ['pack', '--pack-destination', tmp], { cwd: repo });
  const tarball = path.join(tmp, packOut.trim().split('\n').pop());

  check('tarball contents are src/ + metadata only', () => {
    const listing = run('tar', ['-tzf', tarball]);
    const entries = listing.trim().split('\n').map(l => l.replace(/^package\//, ''));
    if (!entries.includes('src/rjson.js')) throw new Error('src/rjson.js missing');
    if (!entries.includes('src/rjson.d.ts')) throw new Error('src/rjson.d.ts missing');
    const stray = entries.filter(
      e => !e.startsWith('src/') && !['package.json', 'README.md', 'LICENSE.md'].includes(e),
    );
    if (stray.length) throw new Error(`unexpected files in tarball: ${stray.join(', ')}`);
  });

  const consumer = path.join(tmp, 'consumer');
  fs.mkdirSync(consumer);
  fs.writeFileSync(
    path.join(consumer, 'package.json'),
    JSON.stringify({ name: 'consumer', private: true, type: 'module' }),
  );
  run('npm', ['install', '--no-audit', '--no-fund', tarball], { cwd: consumer });

  fs.writeFileSync(
    path.join(consumer, 'smoke.mjs'),
    `
import { parse, toJson } from ${JSON.stringify(pkg.name)};
const source = '{ "items": [1, 2,], /* ok */ "name": "demo", }';
const parsed = parse(source);
if (parsed.name !== 'demo') throw new Error('bad name');
if (parsed.items.length !== 2) throw new Error('bad items');

const json = toJson(source);
if (/[ \\t]+$/m.test(json)) throw new Error('default output should not have trailing whitespace');
if (JSON.stringify(JSON.parse(json)) !== JSON.stringify(parsed)) throw new Error('bad clean output');

const padded = toJson(source, { preserveOffsets: true });
if (padded.length !== source.length) throw new Error('preserveOffsets should keep source length');

const multiline = '{\\n  // comment only\\n  "a": 1,\\n}';
if (toJson(multiline) !== '{\\n  "a": 1\\n}') throw new Error('bad multiline output');

let rejected = false;
try { parse('[,]'); } catch { rejected = true; }
if (!rejected) throw new Error('[,] should be rejected');

console.log('smoke: parse/toJson ok');
`,
  );
  check('installed package works via node ESM import', () => {
    run('node', ['smoke.mjs'], { cwd: consumer });
  });

  fs.writeFileSync(
    path.join(consumer, 'consumer.ts'),
    `
import {
  RELAXED_JSON_VERSION,
  parse,
  stripComments,
  stripTrailingCommas,
  toJson,
  type JsonReviver,
  type RewriteOptions,
} from ${JSON.stringify(pkg.name)};

interface Config {
  name: string;
  values: number[];
}

const reviver: JsonReviver = (_key, value) => value;
const config: Config = parse<Config>('{ "name": "x", "values": [1,], }', reviver);
const options: RewriteOptions = { preserveOffsets: true };
const strict: string = toJson('{ "ok": true, }');
const padded: string = toJson('{ "ok": true, }', options);
const noComments: string = stripComments('/* note */ { "ok": true }', { preserveOffsets: false });
const noCommas: string = stripTrailingCommas('{ "ok": true, }', options);
const version: string = RELAXED_JSON_VERSION;
void config; void strict; void padded; void noComments; void noCommas; void version;
`,
  );
  fs.writeFileSync(
    path.join(consumer, 'tsconfig.json'),
    JSON.stringify({
      compilerOptions: {
        module: 'nodenext',
        moduleResolution: 'nodenext',
        strict: true,
        noEmit: true,
        skipLibCheck: false,
      },
      include: ['consumer.ts'],
    }),
  );
  check('type declarations pass strict tsc', () => {
    run(path.join(repo, 'node_modules', '.bin', 'tsc'), ['-p', '.'], { cwd: consumer });
  });
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

if (failures) {
  console.error(`\n${failures} deploy-test failure(s)`);
  process.exit(1);
}
console.log('\ndeploy test: package is publishable');
