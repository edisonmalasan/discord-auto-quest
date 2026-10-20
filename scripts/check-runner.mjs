/**
 * Check the runners against the constraints the product sets for them.
 *
 * The runner is the stub the app launches in place of a game. Each platform's runner
 * has its own constraints, and each is enforced by what the binary links rather than
 * by what it draws:
 *
 * - Windows: it must import none of `user32.dll`, `gdi32.dll`, or `shell32.dll`, so
 *   it cannot open a window, draw into one, or reach for a shell.
 * - Linux: it must need no GUI toolkit at all, so it links neither GTK nor X11 nor
 *   Wayland. A quest should not require a graphical stack to be installed.
 * - macOS: it needs a window, so there is nothing to forbid — but it must still be
 *   small, because it is downloaded with every copy of the app.
 *
 * Each runner carries its own size bar, because the platforms are not alike: the
 * Windows and Linux runners are a process and a sleep, while the macOS one opens
 * a window and therefore carries a windowing library.
 *
 * Run with `npm run check:runner`. A runner for a platform that is not built on this
 * machine is skipped, and says so.
 */
import { readFileSync, statSync, existsSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

const FORBIDDEN = ['user32.dll', 'gdi32.dll', 'shell32.dll'];
const FORBIDDEN_LINUX = ['gtk', 'libx11', 'wayland', 'gdk', 'libgtk'];

/** The runners, and the constraint each one carries. */
const RUNNERS = [
  {
    platform: 'windows',
    crate: 'runner',
    binary: 'discord-auto-quest-runner.exe',
    build: 'npm run build:runner',
    // The product sets this bar for the Windows runner: it is downloaded with
    // every copy of the app.
    sizeLimit: 300 * 1024,
  },
  {
    platform: 'macos',
    crate: 'runner-macos',
    binary: 'discord-auto-quest-runner-macos',
    build: 'npm run build:runner:macos',
    // The macOS runner opens a window, so it carries a windowing library and
    // cannot be as small as the other two. The bar is against being fat, not
    // against the other runners: a windowed stub is still a stub, and it is
    // still a rounding error beside the application that embeds it.
    sizeLimit: 4 * 1024 * 1024,
  },
  {
    platform: 'linux',
    crate: 'runner-linux',
    binary: 'discord-auto-quest-runner-linux',
    build: 'npm run build:runner:linux',
    // A statically-linked Linux build carries the whole C library inside it, which
    // measures 370 KB. The bar is above that, because the runner still has to be
    // small next to the application, and because a dynamically-linked build — the
    // ordinary case — is smaller still.
    sizeLimit: 1024 * 1024,
  },
];

function fail(message) {
  console.error(`runner check failed: ${message}`);
  process.exit(1);
}

/**
 * Where a runner's binaries are, if it has been built.
 *
 * A runner built for the machine doing the build lands in `target/release`. A
 * runner cross-compiled for another target lands in `target/<triple>/release`,
 * because that is where `cargo` puts it. Both are found, so a cross-built
 * runner can be checked on a machine that cannot run it — and every build of it
 * is checked, not just the first one found.
 */
function findRunners(crate, binary) {
  const target = join(root, crate, 'target');
  const found = [];

  const host = join(target, 'release', binary);
  if (existsSync(host)) {
    found.push(host);
  }

  if (existsSync(target)) {
    for (const entry of readdirSync(target, { withFileTypes: true })) {
      if (!entry.isDirectory()) {
        continue;
      }
      const candidate = join(target, entry.name, 'release', binary);
      if (existsSync(candidate)) {
        found.push(candidate);
      }
    }
  }

  return found;
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

let checked = 0;

for (const runner of RUNNERS) {
  const paths = findRunners(runner.crate, runner.binary);
  if (paths.length === 0) {
    console.log(`${runner.platform}: not built here, skipped`);
    console.log(`  build it with: ${runner.build}`);
    continue;
  }

  for (const path of paths) {
    const size = statSync(path).size;
    console.log(`${runner.platform}: ${path}`);
    console.log(`  size: ${size} bytes (limit ${runner.sizeLimit})`);

    if (size >= runner.sizeLimit) {
      fail(`the ${runner.platform} runner must be under ${runner.sizeLimit} bytes, it is ${size}`);
    }

    if (runner.platform === 'windows') {
      const imports = readImports(readFileSync(path));
      for (const entry of imports) {
        console.log(`  ${entry.dll} -> ${entry.functions.join(', ')}`);
      }

      const imported = imports.map((entry) => entry.dll.toLowerCase());
      const forbidden = FORBIDDEN.filter((dll) => imported.includes(dll));
      if (forbidden.length > 0) {
        fail(`the Windows runner must not import ${forbidden.join(', ')}`);
      }
    }

    if (runner.platform === 'linux') {
      // The Linux runner is a plain executable with no toolkit. Its shared object
      // dependencies are read from the binary itself, so the check does not
      // depend on a linker being installed here.
      const linked = readLinkedLibraries(path);
      if (linked.length > 0) {
        for (const library of linked) {
          console.log(`  links ${library}`);
        }
      } else {
        console.log('  links nothing: it is statically linked');
      }

      const forbidden = FORBIDDEN_LINUX.filter((name) =>
        linked.some((library) => library.toLowerCase().includes(name)),
      );
      if (forbidden.length > 0) {
        fail(`the Linux runner must not need ${forbidden.join(', ')}`);
      }
    }

    checked += 1;
  }
}

if (checked === 0) {
  fail('no runner was found to check. Build one with `npm run build:runner`.');
}

console.log(`runner check passed (${checked} runner${checked === 1 ? '' : 's'} checked)`);

/**
 * The shared libraries a Linux executable names.
 *
 * The names are read out of the binary's own dynamic section, so the check works
 * on any machine and does not need a linker or a Linux system to run.
 */
function readLinkedLibraries(path) {
  const buffer = readFileSync(path);

  // The dynamic section is named by the `.dynamic` entry in the section table.
  const sections = readElfSections(buffer);
  const dynamic = sections.find((section) => section.name === '.dynamic');
  if (!dynamic) {
    return [];
  }

  const libraries = [];
  const strings = sections.find((section) => section.name === '.dynstr');
  if (!strings) {
    return [];
  }

  // Each entry in `.dynamic` is a tag and a value. `DT_NEEDED` names a library by
  // its offset into `.dynstr`.
  const NEEDED = 1;
  const entrySize = 8;
  for (let offset = dynamic.offset; offset + entrySize <= dynamic.offset + dynamic.size; offset += entrySize) {
    const tag = buffer.readBigUInt64LE(offset);
    const value = buffer.readBigUInt64LE(offset + 8);
    if (tag === 0n) {
      break;
    }
    if (tag === BigInt(NEEDED)) {
      const start = strings.offset + Number(value);
      let end = start;
      while (end < buffer.length && buffer[end] !== 0) {
        end += 1;
      }
      libraries.push(buffer.toString('latin1', start, end));
    }
  }

  return libraries;
}

/** The sections of an ELF executable. */
function readElfSections(buffer) {
  // The magic is `\x7fELF`. Read as a little-endian word it is 0x464C457F.
  if (buffer.readUInt32LE(0) !== 0x464c457f) {
    throw new Error('not an ELF file');
  }

  const is64 = buffer.readUInt8(4) === 2;
  const sectionHeaderOffset = is64
    ? Number(buffer.readBigUInt64LE(0x28))
    : buffer.readUInt32LE(0x20);
  const sectionHeaderEntrySize = is64
    ? buffer.readUInt16LE(0x3a)
    : buffer.readUInt16LE(0x2e);
  const sectionCount = is64
    ? buffer.readUInt16LE(0x3c)
    : buffer.readUInt16LE(0x30);
  const stringTableIndex = is64
    ? buffer.readUInt16LE(0x3e)
    : buffer.readUInt16LE(0x32);

  const headers = [];
  for (let index = 0; index < sectionCount; index += 1) {
    const entry = sectionHeaderOffset + index * sectionHeaderEntrySize;
    headers.push({
      nameOffset: buffer.readUInt32LE(entry),
      type: buffer.readUInt32LE(entry + 4),
      offset: is64 ? Number(buffer.readBigUInt64LE(entry + 24)) : buffer.readUInt32LE(entry + 16),
      size: is64 ? Number(buffer.readBigUInt64LE(entry + 32)) : buffer.readUInt32LE(entry + 20),
    });
  }

  const stringHeader = headers[stringTableIndex];
  const readName = (offset) => {
    let end = stringHeader.offset + offset;
    while (end < buffer.length && buffer[end] !== 0) {
      end += 1;
    }
    return buffer.toString('latin1', stringHeader.offset + offset, end);
  };

  return headers.map((header) => ({
    name: readName(header.nameOffset),
    offset: header.offset,
    size: header.size,
  }));
}
