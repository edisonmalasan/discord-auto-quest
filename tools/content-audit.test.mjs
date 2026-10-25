// @vitest-environment node
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { verifyContentIdentity, expectedProductionMarker, auditDistribution, auditFile, auditTrackedInputs } from './content-audit.mjs';
import { validationMarker } from './content-build.mjs';
import { root } from './version.mjs';
import { portableFiles } from './archive.mjs';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

it('requires the exact version and content digest and rejects validation copies', () => {
  const identity = expectedProductionMarker(root, '1.2.1');
  expect(() => verifyContentIdentity(Buffer.from('MZ' + identity), root, '1.2.1')).not.toThrow();
  for (const text of ['', validationMarker, identity + validationMarker]) {
    expect(() => verifyContentIdentity(Buffer.from(text), root, '1.2.1')).toThrow(/identity/);
  }
  expect(() => verifyContentIdentity(Buffer.from(identity), root, '1.2.2')).toThrow();
  expect(() => verifyContentIdentity(Buffer.from('MZ' + validationMarker), root, '1.2.1', false)).not.toThrow();
});

it.each(['content.map', 'content.key', 'protected.rs', 'debug.pdb', 'fixtures', 'tests', '.env.local', 'operation.js', 'operation.mjs', 'source.ts'])('rejects accidentally packaged %s', name => {
  const directory = mkdtempSync(join(tmpdir(), 'daq-audit-'));
  writeFileSync(join(directory, name), 'fixture');
  expect(() => auditDistribution(directory)).toThrow(/Private or debug/);
});

it('rejects readable private content and source map references without printing either', () => {
  const directory = mkdtempSync(join(tmpdir(), 'daq-audit-')), input = join(directory, 'private.txt'), output = join(directory, 'app.exe');
  writeFileSync(input, 'harmless private test content repeated long enough to detect');
  writeFileSync(output, readFileSync(input));
  expect(() => auditFile(output, { privateInputs: [input] })).toThrow('Readable private content');
  writeFileSync(output, 'sourceMappingURL=example.map');
  expect(() => auditFile(output)).toThrow('Source map');
});

it('reads portable executable bytes before accepting its production identity', () => {
  const files = portableFiles(readFileSync(new URL('./fixtures/portable.zip', import.meta.url)));
  expect(files.has('discord-auto-quest.exe')).toBe(true);
  expect(() => verifyContentIdentity(files.get('discord-auto-quest.exe'), root, '1.2.1')).toThrow(/identity/);
});

it.each(['.env.local', 'production.key'])('rejects tracked private input %s', name => {
  const directory = mkdtempSync(join(tmpdir(), 'daq-tracked-'));
  execFileSync('git', ['init', '--quiet', directory]);
  writeFileSync(join(directory, name), 'harmless fixture');
  execFileSync('git', ['add', '--force', name], { cwd: directory });
  expect(() => auditTrackedInputs(directory, {})).toThrow('Private build input');
});

it('rejects the production key accidentally placed in an ordinary tracked file', () => {
  const directory = mkdtempSync(join(tmpdir(), 'daq-tracked-')), key = 'a'.repeat(64);
  execFileSync('git', ['init', '--quiet', directory]);
  writeFileSync(join(directory, 'settings.txt'), key);
  execFileSync('git', ['add', 'settings.txt'], { cwd: directory });
  expect(() => auditTrackedInputs(directory, { DAQ_CONTENT_KEY: key })).toThrow('Production content key');
});
