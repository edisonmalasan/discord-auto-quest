import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { findPayloadMarks, PAYLOAD_MARKS } from './check-payload.mjs';

describe('the payload check', () => {
  it('finds the operation when the operation is there', () => {
    // The check has to be able to fail. If it cannot find a file that holds
    // the operation, then it will never find one that does not either, and it is
    // not a check at all.
    const directory = mkdtempSync(join(tmpdir(), 'daq-payload-'));
    const path = join(directory, 'plaintext.js');

    writeFileSync(path, PAYLOAD_MARKS.join('\n'), 'utf8');

    expect(findPayloadMarks(path).length).toBe(PAYLOAD_MARKS.length);
  });

  it('finds the operation when it is written as wide characters', () => {
    const directory = mkdtempSync(join(tmpdir(), 'daq-payload-'));
    const path = join(directory, 'wide.js');

    const wide = Buffer.from(PAYLOAD_MARKS.join('\n'), 'utf16le');
    writeFileSync(path, wide);

    expect(findPayloadMarks(path).length).toBe(PAYLOAD_MARKS.length);
  });

  it('finds nothing in a file that does not hold the operation', () => {
    const directory = mkdtempSync(join(tmpdir(), 'daq-payload-'));
    const path = join(directory, 'empty.js');

    writeFileSync(path, 'nothing to see here', 'utf8');

    expect(findPayloadMarks(path)).toEqual([]);
  });

  it('does not find the operation in the payload that ships', () => {
    // The payload is the encrypted operation. It must not be readable, and the
    // check must be looking at the thing that is actually shipped.
    const path = join(
      import.meta.dirname,
      '..',
      'src-tauri',
      'payload',
      'auto-quest.bin',
    );

    expect(findPayloadMarks(path)).toEqual([]);
  });
});
