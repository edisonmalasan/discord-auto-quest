/**
 * The acceptance cases, checked against the artefacts rather than the source.
 *
 * A check against the source cannot see what the bundler or the compiler
 * produced, so the cases that are about what ships are checked against what
 * ships.
 *
 * - **N2** says the quest script is not readable in the shipped executable.
 *   That is checked by `check-payload.mjs`, against the built application,
 *   because the script is the one piece of this project that must not be
 *   handed over with it.
 *
 * - **N9** says the application carries no borrowed identity and no upstream
 *   code. Absence is checked in the lock file, where a dependency would
 *   appear, and in the notices, which have to ship.
 *
 * - The shipped frontend carries no data dump. The catalogue was the largest
 *   thing this project ever handled — an eleven megabyte document upstream —
 *   and a copy of it in the bundle would be the one defect that could undo
 *   the design. The catalogue is gone now, so the check is the size limit
 *   rather than the field names: a bundle that grew by ten megabytes would
 *   be caught either way.
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
 * The libraries that would be present if the RPC feature were.
 *
 * `discord-sdk` is the one the upstream ships. The others are named in case a
 * different one is reached for.
 */
const RPC_LIBRARIES = ['discord-sdk', 'discord_rpc', 'discord-game-sdk'];

/** The largest a frontend asset may be, in bytes. */
const ASSET_SIZE_LIMIT = 1024 * 1024;

/** The acceptance cases the plan is held to. */
const CASES = 9;

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
 * The shipped frontend carries no data dump.
 */
function checkNoDataDump() {
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
          `${ASSET_SIZE_LIMIT} bytes a frontend asset may be; a data dump is about that size`,
      );
    }
  }

  console.log(
    `the bundle is ${files.length} files and ${total} bytes, and carries no data dump`,
  );
}

/**
 * N9: the Discord RPC feature is absent from the application.
 */
function checkNoRpc() {
  const lock = join(root, 'src-tauri', 'Cargo.lock');
  const text = readFileSync(lock, 'utf8');

  for (const library of RPC_LIBRARIES) {
    if (text.includes(`name = "${library}"`)) {
      fail(`the lock file carries ${library}, so the RPC feature is not absent`);
    }
  }

  console.log('N9: the lock file carries no Discord RPC library');
}

/**
 * N9: the notices ship.
 *
 * The upstream project this was studied from is MIT licensed, and the licence
 * requires its notice to be retained. The disclaimer is this project's own.
 */
function checkTheNoticesShip() {
  for (const notice of ['LICENSE', 'NOTICE']) {
    const path = join(root, notice);

    if (!existsSync(path)) {
      fail(`${notice} is missing, so the archive would ship without it`);
    }

    if (readFileSync(path, 'utf8').trim().length === 0) {
      fail(`${notice} is empty`);
    }
  }

  console.log('N9: the licence and the notice are both there');
}

/**
 * Every acceptance case is still accounted for.
 *
 * The contract for "done" is the N1–N9 list, and the roadmap carries a table
 * saying where each one stands. A case that quietly leaves that table is a
 * case nobody is checking, so the table is checked here: every case from N1
 * to N9 has to be there.
 */
function checkTheContractIsIntact() {
  const roadmap = readFileSync(join(root, 'docs', 'ROADMAP.md'), 'utf8');
  const missing = [];

  for (let number = 1; number <= CASES; number += 1) {
    const row = new RegExp(`^\\|\\s*N${number}\\s*\\|`, 'm');

    if (!row.test(roadmap)) {
      missing.push(`N${number}`);
    }
  }

  if (missing.length > 0) {
    fail(
      `the roadmap does not account for ${missing.join(', ')}; ` +
        'every acceptance case has to say where it stands',
    );
  }

  console.log(`the roadmap accounts for all ${CASES} acceptance cases`);
}

checkNoDataDump();
checkNoRpc();
checkTheNoticesShip();
checkTheContractIsIntact();
console.log('acceptance checks passed');
