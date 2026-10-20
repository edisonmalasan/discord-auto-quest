/**
 * The version of the project, and the manifests that carry it.
 *
 * The version is defined in one place: the `version` field of the workspace
 * manifest, `package.json`. Everything else that has to state a version takes
 * it from there.
 *
 * - The Tauri configuration reads it directly. Tauri accepts a path to a
 *   `package.json` in its `version` field, so the bundle's own metadata is
 *   injected at build time and cannot drift.
 * - The Rust build script reads it and checks that the crate's own version
 *   agrees. A mismatch fails the build rather than producing an artefact that
 *   says one thing and another.
 * - The release script names the archive from it.
 * - The about panel shows it, because the backend hands it over at runtime.
 *
 * The manifests Cargo needs a literal `version` in are kept in step by
 * `npm run version:sync`, and `npm run version:check` fails when they are not.
 *
 * Run with `node scripts/version.mjs check` or `node scripts/version.mjs sync`.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));

/** The repository root. */
export const root = join(here, '..');

/** Where the version is defined. */
export const SOURCE = join(root, 'package.json');

/**
 * The manifests that carry a copy of the version, because Cargo insists on a
 * literal in `[package]`.
 */
const CARGO_MANIFESTS = [
  join(root, 'src-tauri', 'Cargo.toml'),
  join(root, 'runner', 'Cargo.toml'),
  join(root, 'runner-macos', 'Cargo.toml'),
  join(root, 'runner-linux', 'Cargo.toml'),
];

/** The version, read from the workspace manifest. */
export function readVersion() {
  const manifest = JSON.parse(readFileSync(SOURCE, 'utf8'));
  const version = manifest.version;

  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+/.test(version)) {
    throw new Error(
      `${SOURCE} must carry a semver version, it has ${JSON.stringify(version)}`,
    );
  }

  return version;
}

/**
 * The version a Cargo manifest states.
 *
 * Only the `[package]` table is read: a `version` key in any other table
 * belongs to something else entirely.
 */
function readCargoVersion(text) {
  const tables = text.split(/^\[/m);
  const packageTable = tables.find((table) => table.startsWith('package]'));

  if (!packageTable) {
    return null;
  }

  const match = packageTable.match(/^\s*version\s*=\s*"([^"]+)"/m);
  return match ? match[1] : null;
}

/**
 * Write the version into a Cargo manifest.
 *
 * The `[package]` table is located first, so a `version` key elsewhere in the
 * file is never touched. The line endings the file already had are kept: a
 * script that rewrites a manifest should change the version and nothing else.
 */
function writeCargoVersion(text, version) {
  const newline = text.includes('\r\n') ? '\r\n' : '\n';
  const lines = text.split(/\r?\n/);
  let inPackage = false;
  let written = false;

  for (let index = 0; index < lines.length; index += 1) {
    if (/^\[/.test(lines[index])) {
      inPackage = lines[index].trim() === '[package]';
    }

    if (inPackage && !written && /^\s*version\s*=/.test(lines[index])) {
      lines[index] = `version = "${version}"`;
      written = true;
    }
  }

  if (!written) {
    throw new Error('the [package] table has no version to write');
  }

  return lines.join(newline);
}

/** Every manifest that disagrees with the source. */
export function findDrift() {
  const version = readVersion();
  const drift = [];

  for (const manifest of CARGO_MANIFESTS) {
    const stated = readCargoVersion(readFileSync(manifest, 'utf8'));

    if (stated === null) {
      drift.push({ manifest, stated: null, expected: version });
    } else if (stated !== version) {
      drift.push({ manifest, stated, expected: version });
    }
  }

  return { version, drift };
}

/** Write the version into every manifest that carries a copy. */
export function syncVersion() {
  const version = readVersion();

  for (const manifest of CARGO_MANIFESTS) {
    const text = readFileSync(manifest, 'utf8');
    const updated = writeCargoVersion(text, version);

    if (updated !== text) {
      writeFileSync(manifest, updated);
      console.log(`wrote ${version} into ${manifest}`);
    }
  }

  return version;
}

/** Fail when a manifest disagrees with the source. */
export function checkVersion() {
  const { version, drift } = findDrift();

  if (drift.length > 0) {
    for (const entry of drift) {
      console.error(
        `${entry.manifest} says ${entry.stated}, the version is ${entry.expected}`,
      );
    }
    console.error('run `npm run version:sync` to bring them into step');
    process.exit(1);
  }

  console.log(`version ${version}, and every manifest agrees`);
  return version;
}

if (process.argv[1] && process.argv[1].endsWith('version.mjs')) {
  const mode = process.argv[2] ?? 'check';

  if (mode === 'sync') {
    syncVersion();
  } else if (mode === 'check') {
    checkVersion();
  } else {
    console.error(`unknown mode ${mode}: expected "check" or "sync"`);
    process.exit(1);
  }
}
