import { createDecipheriv, createHash, createCipheriv } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const validationMarker = 'DAQ-CONTENT-VALIDATION-v1';
export const contentFiles = { work: 'auto-quest.bin', enrollment: 'enrollment.bin' };
export const hash = bytes => createHash('sha256').update(bytes).digest('hex');
export function productionMarker(version, digest) {
  return `DAQ-CONTENT-PRODUCTION-v1:${version}:${digest}`;
}

export function contentKey(env) {
  if (env.DAQ_CONTENT_KEY && env.DAQ_CONTENT_KEY_FILE) throw new Error('Provide one content key input');
  let text = env.DAQ_CONTENT_KEY?.trim();
  if (env.DAQ_CONTENT_KEY_FILE) text = readFileSync(env.DAQ_CONTENT_KEY_FILE, 'utf8').trim();
  if (typeof text !== 'string' || !/^[a-f0-9]{64}$/i.test(text)) throw new Error('Missing or invalid production content key');
  return Buffer.from(text, 'hex');
}

export function decryptContent(bytes, key) {
  if (bytes.length < 29) throw new Error('Invalid protected content');
  try {
    const cipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
    cipher.setAuthTag(bytes.subarray(-16));
    return Buffer.concat([cipher.update(bytes.subarray(12, -16)), cipher.final()]);
  } catch {
    throw new Error('Production content authentication failed');
  }
}

export function validateProduction(root, env) {
  const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
  const bytes = readFileSync(join(root, 'src-tauri/payload/manifest.json'));
  const manifest = JSON.parse(bytes);
  if (manifest.schema !== 1 || manifest.version !== version || manifest.algorithm !== 'AES-256-GCM' ||
      manifest.format !== 'nonce12-ciphertext-tag16' || manifest.transformation !== 'obfuscated-v1' ||
      JSON.stringify(Object.keys(manifest.assets ?? {}).sort()) !== '["enrollment","work"]') {
    throw new Error('Protected content manifest does not match the app');
  }
  const key = contentKey(env), assets = {};
  const nonces = new Set();
  for (const [kind, file] of Object.entries(contentFiles)) {
    const entry = manifest.assets[kind];
    if (entry.file !== file) throw new Error('Unexpected protected asset');
    const encrypted = readFileSync(join(root, 'src-tauri/payload', file));
    const nonce = encrypted.subarray(0, 12).toString('hex');
    if (hash(encrypted) !== entry.sha256 || nonces.has(nonce)) throw new Error('Protected asset integrity mismatch');
    nonces.add(nonce);
    const plaintext = decryptContent(encrypted, key);
    if (hash(plaintext) !== entry.contentSha256 || plaintext.length === 0) throw new Error('Protected content digest mismatch');
    plaintext.fill(0);
    assets[kind] = encrypted;
  }
  return { key, assets, marker: productionMarker(version, hash(bytes)) };
}

export function prepareContent(root, output, env = process.env) {
  const mode = env.DAQ_CONTENT_MODE ?? 'validation';
  if (!['validation', 'production'].includes(mode)) throw new Error('Unknown content build mode');
  if (mode === 'validation' && (env.DAQ_CONTENT_KEY || env.DAQ_CONTENT_KEY_FILE)) throw new Error('Validation builds must not receive production content keys');
  let prepared;
  if (mode === 'production') {
    prepared = validateProduction(root, env);
  } else {
    // Inert fixture: no client access, account mutation, timers, or network.
    const fixture = 'function () { return { status: "unsupported", quests: [], message: "Validation build: protected operations are disabled." }; }';
    const key = Buffer.alloc(32, 7), assets = {};
    for (const [index, kind] of Object.keys(contentFiles).entries()) {
      const nonce = Buffer.alloc(12, index + 1);
      const cipher = createCipheriv('aes-256-gcm', key, nonce);
      assets[kind] = Buffer.concat([nonce, cipher.update(fixture), cipher.final(), cipher.getAuthTag()]);
    }
    prepared = { key, assets, marker: validationMarker };
  }
  mkdirSync(output, { recursive: true });
  for (const [kind, bytes] of Object.entries(prepared.assets)) writeFileSync(join(output, contentFiles[kind]), bytes);
  const generated = `pub const PRODUCTION: bool = ${mode === 'production'};\n` +
    `pub const BUILD_MARKER: &str = ${JSON.stringify(prepared.marker)};\n` +
    `const KEY: [u8; 32] = [${[...prepared.key].join(',')}];\n`;
  writeFileSync(join(output, 'protected.rs'), generated, { mode: 0o600 });
  prepared.key.fill(0);
}

export function checkContentRepository(root) {
  if (existsSync(join(root, 'src-tauri/payload/secret.key'))) throw new Error('Remove the legacy public content key');
  const manifest = JSON.parse(readFileSync(join(root, 'src-tauri/payload/manifest.json'), 'utf8'));
  const version = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version;
  if (manifest.version !== version) throw new Error('Protected assets need regeneration for this version');
  for (const [kind, file] of Object.entries(contentFiles)) {
    if (manifest.assets?.[kind]?.file !== file || hash(readFileSync(join(root, 'src-tauri/payload', file))) !== manifest.assets[kind].sha256) throw new Error('Protected asset mismatch');
  }
}

export function verifyPrivateVerification(root, env) {
  const expected = hash(readFileSync(join(root, 'src-tauri/payload/manifest.json')));
  if (env.DAQ_CONTENT_VERIFIED_MANIFEST?.trim() !== expected) throw new Error('Private behavioral verification does not match the production content');
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const root = resolve(import.meta.dirname, '..');
    if (process.argv[2] === 'check') checkContentRepository(root);
    else prepareContent(root, process.argv[2] ?? (() => { throw new Error('Missing generated output directory'); })());
  } catch {
    // Never print inputs, decrypted bytes, or runtime/parser diagnostics here.
    console.error('Protected content preparation failed. Check build mode, version, asset integrity, and private key configuration.');
    process.exitCode = 1;
  }
}
