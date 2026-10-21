import { describe, expect, it } from 'vitest';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { findScriptMarks, SCRIPT_MARKS } from './check-payload.mjs';

describe('the payload check', () => {
  it('finds the script when the script is there', () => {
    // The check has to be able to fail. If it cannot find a file that holds
    // the script, then it will never find one that does not either, and it is
    // not a check at all.
    const directory = mkdtempSync(join(tmpdir(), 'daq-payload-'));
    const path = join(directory, 'plaintext.js');

    writeFileSync(path, SCRIPT_MARKS.join('\n'), 'utf8');

    expect(findScriptMarks(path).length).toBe(SCRIPT_MARKS.length);
  });

  it('finds the script when it is written as wide characters', () => {
    const directory = mkdtempSync(join(tmpdir(), 'daq-payload-'));
    const path = join(directory, 'wide.js');

    const wide = Buffer.from(SCRIPT_MARKS.join('\n'), 'utf16le');
    writeFileSync(path, wide);

    expect(findScriptMarks(path).length).toBe(SCRIPT_MARKS.length);
  });

  it('finds nothing in a file that does not hold the script', () => {
    const directory = mkdtempSync(join(tmpdir(), 'daq-payload-'));
    const path = join(directory, 'empty.js');

    writeFileSync(path, 'nothing to see here', 'utf8');

    expect(findScriptMarks(path)).toEqual([]);
  });

  it('does not find the script in the payload that ships', () => {
    // The payload is the encrypted script. It must not be readable, and the
    // check must be looking at the thing that is actually shipped.
    const path = join(
      import.meta.dirname,
      '..',
      'src-tauri',
      'payload',
      'auto-quest.bin',
    );

    expect(findScriptMarks(path)).toEqual([]);
  });
});
