/// <reference types="vitest/config" />
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The Tauri shell drives this dev server; the port is fixed and must not drift.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
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
