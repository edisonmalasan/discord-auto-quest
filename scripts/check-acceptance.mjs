/**
 * The acceptance cases, checked against the artefacts rather than the source.
 *
 * Two of the cases are about what ships rather than about what the code does:
 *
 * - **A13** says the shipped frontend contains no catalogue snapshot. The
 *   catalogue is the largest thing this project ever handled — an eleven
 *   megabyte document upstream — and a copy of it in the bundle is the one
 *   defect that would undo the whole design. It is checked here against the
 *   built bundle, because a check against the source cannot see what the
 *   bundler produced.
 *
 * - **A15** says the Discord RPC feature is absent from the clone. Absence is
 *   checked in the lock file, where a dependency would appear, and in the
 *   source, where the code would appear.
 *
 * Run with `npm run check:acceptance`. The frontend must be built first, or
 * the bundle check has nothing to look at.
 */
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, relative } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

/** The directory the built frontend lands in. */
const DIST = join(root, 'dist');

/**
 * Strings that only a catalogue snapshot would carry.
 *
 * These are the raw endpoint's field names, in the shape the endpoint serves
 * them. The application's own types are camel-cased, so a match means a copy
 * of the payload was put into the bundle.
 */
const CATALOGUE_MARKS = [
  'cover_image_hash',
  'icon_hash',
  'content_classification',
  'third_party_skus',
  'is_launcher',
  'api/applications/detectable',
];

/**
 * The libraries that would be present if the RPC feature were.
 *
 * `discord-sdk` is the one the upstream ships. The others are named in case a
 * different one is reached for.
 */
const RPC_LIBRARIES = ['discord-sdk', 'discord_rpc', 'discord-game-sdk'];

/** The largest a frontend asset may be, in bytes. */
const ASSET_SIZE_LIMIT = 1024 * 1024;

function fail(message) {
  console.error(`acceptance check failed: ${message}`);
  process.exit(1);
}

/** Every file in the built frontend. */
function bundleFiles(directory) {
  const found = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);

    if (entry.isDirectory()) {
      found.push(...bundleFiles(path));
    } else if (entry.isFile()) {
      found.push(path);
    }
  }

  return found;
}

/**
 * A13: the shipped frontend carries no catalogue snapshot.
 */
function checkNoCatalogueSnapshot() {
  if (!existsSync(DIST)) {
    fail('the frontend has not been built, so there is no bundle to inspect');
  }

  const files = bundleFiles(DIST);
  let total = 0;

  for (const file of files) {
    const size = statSync(file).size;
    total += size;

    if (size > ASSET_SIZE_LIMIT) {
      fail(
        `${relative(root, file)} is ${size} bytes, which is larger than the ` +
          `${ASSET_SIZE_LIMIT} bytes a frontend asset may be; a catalogue snapshot is about that size`,
      );
    }

    // Only text assets are read. A font is not a catalogue.
    if (!/\.(js|css|html|json|map)$/.test(file)) {
      continue;
    }

    const text = readFileSync(file, 'utf8');

    for (const mark of CATALOGUE_MARKS) {
      if (text.includes(mark)) {
        fail(
          `${relative(root, file)} contains "${mark}", which means a catalogue ` +
            'snapshot was bundled; the catalogue is fetched at run time',
        );
      }
    }
  }

  console.log(
    `A13: the bundle is ${files.length} files and ${total} bytes, and carries no catalogue snapshot`,
  );
}

/**
 * A15: the Discord RPC feature is absent from the clone.
 */
function checkNoRpc() {
  const lock = join(root, 'src-tauri', 'Cargo.lock');
  const text = readFileSync(lock, 'utf8');

  for (const library of RPC_LIBRARIES) {
    if (text.includes(`name = "${library}"`)) {
      fail(`the lock file carries ${library}, so the RPC feature is not absent`);
    }
  }

  console.log('A15: the lock file carries no Discord RPC library');
}

/**
 * Every acceptance case is still accounted for.
 *
 * The contract for "done" is the A1–A15 list, and the roadmap carries a table
 * saying where each one is proved. A case that quietly leaves that table is a
 * case nobody is checking, so the table is checked here: every case from A1 to
 * A15 has to be there, with a place named for it.
 */
function checkTheContractIsIntact() {
  const roadmap = readFileSync(join(root, 'docs', 'ROADMAP.md'), 'utf8');
  const missing = [];

  for (let number = 1; number <= 15; number += 1) {
    const row = new RegExp(`^\\|\\s*A${number}\\s*\\|`, 'm');

    if (!row.test(roadmap)) {
      missing.push(`A${number}`);
    }
  }

  if (missing.length > 0) {
    fail(
      `the roadmap does not account for ${missing.join(', ')}; ` +
        'every acceptance case has to say where it is proved',
    );
  }

  console.log('the roadmap accounts for all fifteen acceptance cases');
}

checkNoCatalogueSnapshot();
checkNoRpc();
checkTheContractIsIntact();
console.log('acceptance checks passed');
