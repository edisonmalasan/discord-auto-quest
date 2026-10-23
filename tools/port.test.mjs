import { createServer } from 'node:net';
import { describe, expect, it } from 'vitest';

import { answered, findPort, isFree } from './port.mjs';

/**
 * A server on one address.
 *
 * It is closed when the promise it returns is awaited, so a test never leaves
 * a listener behind.
 */
function listening(host, port) {
  const server = createServer();

  return new Promise((resolve) => {
    server.once('error', () => resolve(null));
    server.listen(port, host, () => resolve(server));
  });
}

describe('finding a free port', () => {
  it('says a port nothing is listening on is free', async () => {
    // A port in the ephemeral range, which nothing is holding.
    expect(await isFree(41_000 + (process.pid % 1000))).toBe(true);
  });

  it('says a port something is listening on is not free', async () => {
    const server = createServer();
    const port = await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve(server.address().port));
    });

    try {
      expect(await isFree(port)).toBe(false);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('notices a server on the other loopback address', async () => {
    // This is the case that broke the first version of the check.
    //
    // A server on `::1` and a server on `127.0.0.1` are different sockets
    // that happen to share a port number. Windows lets the dev server bind
    // `127.0.0.1` on a port that `::1` is already holding, so a check that
    // only asked one of them said the port was free, and two servers ended
    // up listening on it.
    const server = await listening('::1', 0);
    expect(server).not.toBeNull();

    const port = server.address().port;

    try {
      expect(await answered('127.0.0.1', port)).toBe(true);
      expect(await answered('::1', port)).toBe(false);
      expect(await isFree(port)).toBe(false);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('takes a free port after the one that is taken', async () => {
    const server = createServer();
    const port = await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve(server.address().port));
    });

    try {
      const chosen = await findPort(port, 5);
      // The adjacent port may also belong to another process on this machine.
      expect(chosen).toBeGreaterThan(port);
      expect(chosen).toBeLessThan(port + 5);
      expect(await isFree(chosen)).toBe(true);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  it('gives up rather than take a port that is in use', async () => {
    const server = createServer();
    const port = await new Promise((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve(server.address().port));
    });

    try {
      await expect(findPort(port, 1)).rejects.toThrow(/no free port/);
    } finally {
      await new Promise((resolve) => server.close(resolve));
    }
  });
});
