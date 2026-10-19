/**
 * Check the Windows runner against the constraints the product sets for it.
 *
 * The runner is the stub the app launches in place of a game. It has to be silent, and
 * silence is enforced by what the binary links, not by what it draws:
 *
 * - it must import none of `user32.dll`, `gdi32.dll`, or `shell32.dll`, so it cannot
 *   open a window, draw into one, or reach for a shell;
 * - it must be under 300 KB, because it is downloaded with every copy of the app.
 *
 * Run with `npm run check:runner`.
 */
import { readFileSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const RUNNER = join(root, 'runner', 'target', 'release', 'discord-auto-quest-runner.exe');
const SIZE_LIMIT = 300 * 1024;
const FORBIDDEN = ['user32.dll', 'gdi32.dll', 'shell32.dll'];

function fail(message) {
  console.error(`runner check failed: ${message}`);
  process.exit(1);
}

/** Parse the PE import directory of a Windows executable. */
function readImports(buffer) {
  if (buffer.readUInt16LE(0) !== 0x5a4d) {
    throw new Error('not a PE file');
  }

  const peOffset = buffer.readUInt32LE(0x3c);
  if (buffer.readUInt32LE(peOffset) !== 0x00004550) {
    throw new Error('not a PE file');
  }

  const coff = peOffset + 4;
  const sectionCount = buffer.readUInt16LE(coff + 2);
  const optionalSize = buffer.readUInt16LE(coff + 16);
  const optional = coff + 20;
  const magic = buffer.readUInt16LE(optional);
  const is64 = magic === 0x20b;

  // Data directory 1 is the import table.
  const dataDirectories = optional + (is64 ? 112 : 96);
  const importRva = buffer.readUInt32LE(dataDirectories + 8);

  const sections = [];
  const sectionTable = optional + optionalSize;
  for (let index = 0; index < sectionCount; index += 1) {
    const entry = sectionTable + 40 * index;
    sections.push({
      virtualSize: buffer.readUInt32LE(entry + 8),
      virtualAddress: buffer.readUInt32LE(entry + 12),
      rawSize: buffer.readUInt32LE(entry + 16),
      rawOffset: buffer.readUInt32LE(entry + 20),
    });
  }

  const toOffset = (rva) => {
    for (const section of sections) {
      const span = Math.max(section.virtualSize, section.rawSize);
      if (rva >= section.virtualAddress && rva < section.virtualAddress + span) {
        return section.rawOffset + (rva - section.virtualAddress);
      }
    }
    return -1;
  };

  const readCString = (offset) => {
    if (offset < 0) {
      return '';
    }
    let end = offset;
    while (end < buffer.length && buffer[end] !== 0) {
      end += 1;
    }
    return buffer.toString('latin1', offset, end);
  };

  if (importRva === 0) {
    return [];
  }

  const imports = [];
  const table = toOffset(importRva);
  for (let index = 0; ; index += 1) {
    const descriptor = table + 20 * index;
    if (descriptor + 20 > buffer.length) {
      break;
    }
    const originalThunk = buffer.readUInt32LE(descriptor);
    const nameRva = buffer.readUInt32LE(descriptor + 12);
    const firstThunk = buffer.readUInt32LE(descriptor + 16);
    if (nameRva === 0) {
      break;
    }

    const functions = [];
    const thunkRva = originalThunk || firstThunk;
    const thunk = toOffset(thunkRva);
    const step = is64 ? 8 : 4;
    for (let entry = 0; ; entry += 1) {
      const position = thunk + step * entry;
      if (position + step > buffer.length) {
        break;
      }
      const value = is64
        ? buffer.readBigUInt64LE(position)
        : BigInt(buffer.readUInt32LE(position));
      if (value === 0n) {
        break;
      }
      const ordinal = is64 ? 1n << 63n : 1n << 31n;
      if ((value & ordinal) !== 0n) {
        functions.push(`ordinal ${value & 0xffffn}`);
      } else {
        const hintName = toOffset(Number(value & 0x7fffffffn));
        functions.push(readCString(hintName + 2));
      }
    }

    imports.push({ dll: readCString(toOffset(nameRva)), functions });
  }

  return imports;
}

let size;
try {
  size = statSync(RUNNER).size;
} catch {
  fail(`${RUNNER} does not exist. Build it with \`npm run build:runner\`.`);
}

const imports = readImports(readFileSync(RUNNER));

console.log(`runner: ${RUNNER}`);
console.log(`size:   ${size} bytes (limit ${SIZE_LIMIT})`);
for (const entry of imports) {
  console.log(`  ${entry.dll} -> ${entry.functions.join(', ')}`);
}

if (size >= SIZE_LIMIT) {
  fail(`the runner must be under ${SIZE_LIMIT} bytes, it is ${size}`);
}

const imported = imports.map((entry) => entry.dll.toLowerCase());
const forbidden = FORBIDDEN.filter((dll) => imported.includes(dll));
if (forbidden.length > 0) {
  fail(`the runner must not import ${forbidden.join(', ')}`);
}

console.log('runner check passed');
