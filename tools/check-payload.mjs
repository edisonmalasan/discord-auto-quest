/**
 * N2: the quest operation is not readable in the application.
 *
 * The operation is the one piece of this project that must not be handed over
 * with the application. It is encrypted when the payload is built and
 * embedded as ciphertext, and this checks the artefact rather than the source:
 * a check against the source cannot see what the compiler produced.
 *
 *   node tools/check-payload.mjs <path to the built application>
 *
 * The markers are strings that appear in the operation and nowhere else — the
 * application never needs to know the name of Discord's module registry, or
 * the names of the events the operation listens for. If one of them turns up in
 * the binary, the payload is not encrypted.
 */
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';

/**
 * Strings that only the quest operation would carry.
 *
 * They are chosen to be *absent from the application's own code*. The reader
 * and the driver also reach into Discord's internals, and they ship in the
 * clear — they are this project's code, and the reader has to be readable to
 * work. So the marker `webpackChunkdiscord_app` is no use here: it is in the
 * reader too, and a check that flags our own code is a check that would be
 * silenced rather than fixed.
 *
 * These are the strings that only the secret operation has: the Flux events it
 * listens for, the endpoint it posts to, and the accessor it looks for.
 */
export const PAYLOAD_MARKS = [
  'DAQ enrollment boundary v1',
  'QUESTS_ENROLL_BEGIN',
  '__daqEnrollmentPending',
  'RUNNING_GAMES_CHANGE',
  'QUESTS_SEND_HEARTBEAT_SUCCESS',
  'video-progress',
  'getStreamerActiveStreamMetadata',
  'getSFWDefaultChannel',
];

/**
 * Check a built application for the operation.
 *
 * @param {string} path the built application
 * @returns {string[]} the markers that were found, empty when there were none
 */
export function findPayloadMarks(path) {
  const bytes = readFileSync(path);

  const found = [];

  for (const mark of PAYLOAD_MARKS) {
    // A binary may hold a string as narrow or as wide characters, so both
    // encodings are looked for.
    if (bytes.includes(mark, 0, 'latin1')) {
      found.push(mark);
      continue;
    }

    if (bytes.includes(Buffer.from(mark, 'utf16le'))) {
      found.push(mark);
    }
  }

  return found;
}

/**
 * Check a built application, and fail if the operation is readable in it.
 *
 * @param {string} path the built application
 */
export function checkPayload(path) {
  const found = findPayloadMarks(path);

  if (found.length > 0) {
    console.error(
      `payload check failed: ${basename(path)} contains ${found
        .map((mark) => `"${mark}"`)
        .join(', ')}, so the quest operation is readable in the application`,
    );
    process.exit(1);
  }

  console.log(
    `N2: ${basename(path)} carries none of the quest operation's strings`,
  );
}

// Run as a program, rather than imported.
if (process.argv[1] && process.argv[1].endsWith('check-payload.mjs')) {
  const path = process.argv[2];

  if (!path) {
    console.error('usage: check-payload.mjs <path to the built application>');
    process.exit(2);
  }

  checkPayload(path);
}
