import { readFileSync, readdirSync } from 'node:fs';
import { join, extname } from 'node:path';
import { execFileSync } from 'node:child_process';
import { hash, productionMarker, validationMarker, checkContentRepository } from './content-build.mjs';
import { findPayloadMarks } from './check-payload.mjs';

export function expectedProductionMarker(root, version) {
  return productionMarker(version, hash(readFileSync(join(root, 'src-tauri/payload/manifest.json'))));
}

export function verifyContentIdentity(bytes, root, version, production = true) {
  const marker = production ? expectedProductionMarker(root, version) : validationMarker;
  if (!bytes || bytes.subarray(0, 2).toString() !== 'MZ' || !bytes.includes(Buffer.from(marker)) || (production && bytes.includes(Buffer.from(validationMarker)))) {
    throw new Error('Executable content identity is missing, mismatched, or validation-only');
  }
}

export function auditFile(path, { privateInputs = [], privateContents = [] } = {}) {
  const bytes = readFileSync(path);
  if (findPayloadMarks(path).length) throw new Error('Protected plaintext markers found in distribution');
  if (bytes.includes(Buffer.from('sourceMappingURL='))) throw new Error('Source map reference found in distribution');
  for (const content of [...privateContents, ...privateInputs.map(input => readFileSync(input))]) {
    if (content.length > 32 && (bytes.includes(content) || bytes.includes(Buffer.from(content.toString('utf8'), 'utf16le')))) {
      throw new Error('Readable private content found in distribution');
    }
  }
}

export function auditDistribution(directory, options = {}) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink() || /(?:^(?:re|fixtures|tests?|graphify-out|node_modules|\.agents|\.git)$|^\.env(?:\.|$)|\.(?:map|pdb|key|pem|pfx|p12|rs|mjs|cjs|js|jsx|ts|tsx)$)/i.test(entry.name)) throw new Error('Private or debug file found in distribution');
    const path = join(directory, entry.name);
    if (entry.isDirectory()) auditDistribution(path, options);
    else if (entry.isFile()) auditFile(path, options);
  }
}

export function auditTrackedInputs(root, env = process.env) {
  const paths = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' }).split('\0').filter(Boolean);
  if (paths.some(path => /\.(?:key|pem|pfx|p12)$/i.test(path) || /(?:^|\/)\.env(?:\.|$)/i.test(path) || path.startsWith('re/') || path.endsWith('/protected.rs'))) {
    throw new Error('Private build input is tracked');
  }
  // Audited dependency metadata is permitted; generated maps are not.
  if (paths.some(path => extname(path) === '.map')) throw new Error('Generated source map is tracked');
  if (env.DAQ_CONTENT_KEY) {
    for (const path of paths) {
      if (readFileSync(join(root, path)).includes(Buffer.from(env.DAQ_CONTENT_KEY.trim()))) throw new Error('Production content key found in tracked input');
    }
  }
}

if (process.argv[1]?.endsWith('content-audit.mjs')) {
  const root = join(import.meta.dirname, '..');
  checkContentRepository(root);
  auditTrackedInputs(root);
  console.log('Public content metadata and tracked-input checks passed');
}
