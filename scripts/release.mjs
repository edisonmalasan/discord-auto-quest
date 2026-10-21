/**
 * Package a release archive for the platform this machine builds.
 *
 * The archive is a portable directory: the application, and the notices that
 * ship with it. It is named after the version, which comes from the one place
 * the version is defined.
 *
 * The quest script is *inside* the application binary, as ciphertext. The
 * build fails rather than warns if the payload is missing, and the check
 * below reads the built artefact rather than the source, because a check
 * against the source cannot see what the compiler produced.
 *
 * Run with `npm run release`. The version comes from `package.json`; nothing
 * here states one of its own.
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, basename, join } from 'node:path';

import { readVersion } from './version.mjs';
import { checkPayload } from './check-payload.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');

/** The platform the archive is for, and the name its artefacts take. */
const PLATFORMS = {
  windows: {
    app: 'discord-auto-quest.exe',
    extension: '.zip',
  },
  macos: {
    app: 'discord-auto-quest',
    extension: '.tar.gz',
  },
  linux: {
    app: 'discord-auto-quest',
    extension: '.tar.gz',
  },
};

function fail(message) {
  console.error(`release failed: ${message}`);
  process.exit(1);
}

/** The platform this machine builds for. */
function hostPlatform() {
  switch (process.platform) {
    case 'win32':
      return 'windows';
    case 'darwin':
      return 'macos';
    case 'linux':
      return 'linux';
    default:
      return fail(`this platform (${process.platform}) is not one we ship for`);
  }
}

/** Where a built artefact is, once it has been built for this machine. */
function artefactPath(crate, binary) {
  const candidates = [
    join(root, crate, 'target', 'release', binary),
    join(root, crate, 'target', process.env.TARGET ?? '', 'release', binary),
  ];

  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile()) {
      return candidate;
    }
  }

  return null;
}

function run(command, args) {
  if (command === 'npm') {
    runNpm(args);
    return;
  }

  execFileSync(command, args, { stdio: 'inherit', cwd: root });
}

/**
 * Run an npm script.
 *
 * `npm` is a shell script on Unix and a `.cmd` file on Windows, and neither
 * is a program that can be started directly. The script that is behind the `npm`
 * on the path is a JavaScript file, and Node can run that.
 */
function runNpm(args) {
  const entry = process.env.npm_execpath;

  if (entry && existsSync(entry)) {
    execFileSync(process.execPath, [entry, ...args], { stdio: 'inherit', cwd: root });
    return;
  }

  execFileSync('npm', args, { stdio: 'inherit', cwd: root, shell: true });
}

const platform = hostPlatform();
const shape = PLATFORMS[platform];
const version = readVersion();

console.log(`packaging the ${platform} release of ${version}`);

// The frontend is built first: the application embeds it, and a release
// without its interface is not a release.
console.log('building the frontend');
run('npm', ['run', 'build']);

// The application. The payload is embedded in it, so the build fails rather
// than warns if the payload is missing.
console.log('building the application');
run('cargo', [
  'build',
  '--release',
  '--features',
  'custom-protocol',
  '--manifest-path',
  join(root, 'src-tauri', 'Cargo.toml'),
]);

const app = artefactPath('src-tauri', shape.app);
if (!app) {
  fail(`the ${platform} application was not built, so there is nothing to package`);
}

// The quest script is the one thing that must not be readable in what we
// ship, so the artefact is checked rather than the source.
checkPayload(app);

// The archive: the application, and the notices.
const stage = join(root, 'target', 'release', `discord-auto-quest-${version}-${platform}`);
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });

cpSync(app, join(stage, shape.app));
cpSync(join(root, 'LICENSE'), join(stage, 'LICENSE'));
cpSync(join(root, 'NOTICE'), join(stage, 'NOTICE'));
cpSync(join(root, 'README.md'), join(stage, 'README.md'));

// A manifest, so the archive says what it is without anyone having to guess.
writeFileSync(
  join(stage, 'RELEASE.txt'),
  [
    `discord-auto-quest ${version}`,
    `platform: ${platform}`,
    '',
    'The application drives the Discord desktop client. It has to be running,',
    'and it has to be running with a debugging port; the application says so',
    'and offers to restart it.',
    '',
  ].join('\n'),
);

const output = `${stage}${shape.extension}`;
rmSync(output, { force: true });

if (shape.extension === '.zip') {
  // `tar` ships with Windows, and it writes a zip when told to.
  run('tar', ['-a', '-c', '-f', output, '-C', dirname(stage), basename(stage)]);
} else {
  run('tar', ['-czf', output, '-C', dirname(stage), basename(stage)]);
}

const bytes = statSync(output).size;
console.log(`wrote ${output} (${bytes} bytes) with ${shape.app}`);
