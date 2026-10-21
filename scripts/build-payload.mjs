/**
 * Turn the quest script into the payload that ships.
 *
 * The script itself lives in `re/scripts/`, which is not in version control: it
 * is the one piece of this project that must not be readable by anyone who has
 * the application. What ships instead is this file's output — the script,
 * encrypted, with a nonce, written to `src-tauri/payload/auto-quest.bin`.
 *
 *   node scripts/build-payload.mjs
 *
 * The key is in `src-tauri/payload/secret.key` and is compiled into the
 * application, so this is *obfuscation*, not secrecy: the script is not sitting
 * in the executable as text, but the executable can decrypt it. That is the
 * line this project holds to, and it is the line the plan records.
 *
 * The encrypted payload is committed, so a fresh clone builds without the
 * plaintext — and the continuous integration never has to have it either.
 */
import { createCipheriv, randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const SOURCE = join(root, 're', 'scripts', 'auto-quest.js');
const KEY_FILE = join(root, 'src-tauri', 'payload', 'secret.key');
const OUTPUT = join(root, 'src-tauri', 'payload', 'auto-quest.bin');

const ALGORITHM = 'aes-256-gcm';
const NONCE_BYTES = 12;
const TAG_BYTES = 16;

function fail(message) {
  console.error(`build:payload failed: ${message}`);
  process.exit(1);
}

let script;
try {
  script = readFileSync(SOURCE);
} catch (error) {
  fail(`the script could not be read from ${SOURCE}\n  ${error.message}`);
}

let key;
try {
  key = Buffer.from(readFileSync(KEY_FILE, 'utf8').trim(), 'hex');
} catch (error) {
  fail(`the key could not be read from ${KEY_FILE}\n  ${error.message}`);
}

if (key.length !== 32) {
  fail(`the key must be 32 bytes, and it is ${key.length}`);
}

const nonce = randomBytes(NONCE_BYTES);
const cipher = createCipheriv(ALGORITHM, key, nonce);
const ciphertext = Buffer.concat([cipher.update(script), cipher.final()]);
const tag = cipher.getAuthTag();

mkdirSync(dirname(OUTPUT), { recursive: true });

// The layout is the nonce, the ciphertext, then the tag — which is the order
// the cipher's own decrypt expects, since it reads the tag off the end of the
// message.
writeFileSync(OUTPUT, Buffer.concat([nonce, ciphertext, tag]));

console.log(
  `wrote ${OUTPUT} (${script.length} bytes of script into ${
    NONCE_BYTES + TAG_BYTES + ciphertext.length
  } bytes)`,
);
