// @vitest-environment node
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCipheriv, randomBytes } from 'node:crypto';
import { expect, it } from 'vitest';
import { prepareContent, validateProduction, hash, contentFiles, validationMarker, verifyPrivateVerification } from './content-build.mjs';

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'daq-content-'));
  mkdirSync(join(root, 'src-tauri/payload'), { recursive: true });
  writeFileSync(join(root, 'package.json'), '{"version":"1.2.1"}');
  const key = randomBytes(32), manifest = { schema: 1, version: '1.2.1', algorithm: 'AES-256-GCM', format: 'nonce12-ciphertext-tag16', transformation: 'obfuscated-v1', assets: {} };
  for (const [kind, file] of Object.entries(contentFiles)) {
    const nonce = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, nonce), content = Buffer.from('function(){return "harmless fixture";}');
    const bytes = Buffer.concat([nonce, cipher.update(content), cipher.final(), cipher.getAuthTag()]);
    writeFileSync(join(root, 'src-tauri/payload', file), bytes);
    manifest.assets[kind] = { file, sha256: hash(bytes), contentSha256: hash(content) };
  }
  const manifestPath = join(root, 'src-tauri/payload/manifest.json');
  const save = () => writeFileSync(manifestPath, JSON.stringify(manifest));
  save();
  return { root, manifest, save, env: { DAQ_CONTENT_MODE: 'production', DAQ_CONTENT_KEY: key.toString('hex') } };
}

it('public builds use inert fixtures and explicitly refuse production credentials', () => {
  const root = mkdtempSync(join(tmpdir(), 'daq-validation-')), output = join(root, 'out');
  prepareContent(root, output, {});
  const generated = readFileSync(join(output, 'protected.rs'), 'utf8');
  expect(generated).toContain('PRODUCTION: bool = false');
  expect(generated).toContain(validationMarker);
  expect(() => prepareContent(root, output, { DAQ_CONTENT_KEY: 'secret' })).toThrow(/must not receive/);
  expect(() => prepareContent(root, output, { DAQ_CONTENT_MODE: 'unknown' })).toThrow(/mode/);
});

it('production inputs authenticate, bind the version, and generate private compiler inputs', () => {
  const f = fixture(), output = join(f.root, 'out');
  prepareContent(f.root, output, f.env);
  expect(readFileSync(join(output, 'protected.rs'), 'utf8')).toContain('PRODUCTION: bool = true');
  expect(() => validateProduction(f.root, {})).toThrow(/key/);
  expect(() => validateProduction(f.root, { DAQ_CONTENT_KEY: '00'.repeat(32) })).toThrow(/authentication/);
  expect(() => validateProduction(f.root, { ...f.env, DAQ_CONTENT_KEY_FILE: 'duplicate' })).toThrow(/one/);
  f.manifest.version = '1.2.0'; f.save();
  expect(() => validateProduction(f.root, f.env)).toThrow(/manifest/);
});

it.each(['file', 'sha256', 'contentSha256'])('rejects an altered %s manifest field', field => {
  const f = fixture();
  f.manifest.assets.work[field] = 'altered'; f.save();
  expect(() => validateProduction(f.root, f.env)).toThrow();
});

it('rejects corrupted authenticated bytes even when the public digest was replaced', () => {
  const f = fixture(), path = join(f.root, 'src-tauri/payload/auto-quest.bin');
  const bytes = readFileSync(path); bytes[12] ^= 1; writeFileSync(path, bytes);
  f.manifest.assets.work.sha256 = hash(bytes); f.save();
  expect(() => validateProduction(f.root, f.env)).toThrow(/authentication/);
});

it('requires private verification of the exact content before production packaging', () => {
  const f = fixture();
  expect(() => verifyPrivateVerification(f.root, {})).toThrow(/verification/);
  expect(() => verifyPrivateVerification(f.root, { DAQ_CONTENT_VERIFIED_MANIFEST: '0'.repeat(64) })).toThrow();
  const digest = hash(readFileSync(join(f.root, 'src-tauri/payload/manifest.json')));
  expect(() => verifyPrivateVerification(f.root, { DAQ_CONTENT_VERIFIED_MANIFEST: digest + '\n' })).not.toThrow();
  f.manifest.assets.work.contentSha256 = 'changed'; f.save();
  expect(() => verifyPrivateVerification(f.root, { DAQ_CONTENT_VERIFIED_MANIFEST: digest })).toThrow();
});
