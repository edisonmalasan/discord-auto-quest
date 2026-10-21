/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';

/**
 * The port the dev server is on.
 *
 * The Tauri shell has to be told which port the dev server is on, and the dev
 * server has to take a port nobody else is using. So the port is chosen once,
 * by `scripts/dev.mjs`, and handed to the dev server through the environment.
 *
 * When the port was not chosen for us — the dev server is run on its own, with
 * `npm run dev` — the port below is a starting point rather than a promise, and
 * Vite moves on to the next free one.
 *
 * The environment is read through Vite's own loader rather than through
 * `process.env`, so that this file needs none of Node's types and the
 * application's own types stay narrow.
 */
const environment = loadEnv('', '.', '');
const port = Number(environment.DEV_PORT ?? 1420);

/** Whether the port was chosen for us, and so must not move. */
const chosen = Boolean(environment.DEV_PORT);

export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port,
    // A dev server that moves when the window is already open is a dev server
    // the window cannot find. So a chosen port is held, and a chosen-but-taken
    // port is a loud failure rather than a silent drift.
    strictPort: chosen,
    host: '127.0.0.1',
  },
  build: {
    target: 'esnext',
    // The catalogue is fetched at runtime and never bundled. Nothing in this
    // configuration may pull a catalogue snapshot in.
    chunkSizeWarningLimit: 900,
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'scripts/**/*.test.mjs'],
    // The suite is small, and a worker that is slow to start can starve its
    // own tests of wall clock. A generous timeout, and fewer workers than the
    // machine has cores, keeps a run from failing on a slow disk rather than
    // on a fault.
    testTimeout: 20000,
    hookTimeout: 20000,
    pool: 'threads',
    maxWorkers: 4,
  },
});
