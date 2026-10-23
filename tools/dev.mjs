/**
 * Run the application in development, on a port nobody else is using.
 *
 * The problem this solves: the dev server had one fixed port, and the Tauri
 * shell had to be told which port it was on. So a second copy of the
 * application — or anything else on the machine — already holding that port
 * meant the whole thing refused to start.
 *
 * The fix is to choose the port once, here, and hand it to both sides:
 *
 * - to the dev server, through `DEV_PORT`, which `vite.config.ts` reads;
 * - to the Tauri shell, through a configuration override that points its
 *   `devUrl` at the same port.
 *
 * Every other Tauri command is passed straight through, so `tauri build` and
 * the rest behave exactly as they always did.
 *
 *   node tools/dev.mjs            the application, in development
 *   node tools/dev.mjs --help     what the Tauri command line can do
 */
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { findPort } from './port.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

/** The port the dev server would like. */
const FIRST_PORT = 1420;

/** How many ports to try before giving up. */
const PORT_ATTEMPTS = 40;

/** Where the configuration override is written. It is not in version control. */
const OVERRIDE = join(root, 'src-tauri', 'tauri.dev.json');

/** The Tauri command line, from the installed package. */
const CLI = join(root, 'node_modules', '@tauri-apps', 'cli', 'tauri.js');

/**
 * Write the configuration override.
 *
 * Tauri merges this with `tauri.conf.json`, so only the one value that has
 * to change is here.
 */
function writeOverride(port) {
  mkdirSync(dirname(OVERRIDE), { recursive: true });

  writeFileSync(
    OVERRIDE,
    `${JSON.stringify({ build: { devUrl: `http://localhost:${port}` } }, null, 2)}\n`,
  );
}

/** Run the Tauri command line, and hand back its exit code. */
function runTauri(args, port) {
  if (!existsSync(CLI)) {
    throw new Error(
      `the Tauri command line is not installed at ${CLI}; run "npm install" first`,
    );
  }

  const child = spawn(process.execPath, [CLI, ...args], {
    stdio: 'inherit',
    env: port === undefined ? process.env : { ...process.env, DEV_PORT: String(port) },
  });

  // The application is killed with the terminal, not left behind.
  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => child.kill(signal));
  }

  return new Promise((resolve) => {
    child.on('close', (code) => resolve(code ?? 0));
  });
}

const args = process.argv.slice(2);

// Every command but `dev` is the Tauri command line's own business.
if (args[0] !== 'dev') {
  process.exit(await runTauri(args, undefined));
}

const port = await findPort(FIRST_PORT, PORT_ATTEMPTS);
writeOverride(port);

console.log(`the dev server will take port ${port}`);
process.exit(await runTauri(['dev', '--config', OVERRIDE, ...args.slice(1)], port));
