/**
 * Package a release archive for the platform this machine builds.
 *
 * The archive is a portable directory: the application, the runner beside it,
 * and the notices that ship with it. It is named after the version, which comes
 * from the one place the version is defined.
 *
 * The runner is *inside* the application binary — the app embeds it so there is
 * always one to write and never a resource file to find. The copy in the archive
 * is the same bytes under the same name, so a user can see what the app will
 * run, and so the archive is complete on its own.
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
    runner: { crate: 'runner', binary: 'discord-auto-quest-runner.exe' },
    app: 'discord-auto-quest.exe',
    extension: '.zip',
  },
  macos: {
    runner: { crate: 'runner-macos', binary: 'discord-auto-quest-runner' },
    app: 'discord-auto-quest',
    extension: '.tar.gz',
  },
  linux: {
    runner: { crate: 'runner-linux', binary: 'discord-auto-quest-runner' },
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
      return fail(`this platform (${process.platform}) has no runner`);
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
 * `npm` is a shell script on Unix and a `.cmd` file on Windows, and neither is
 * a program that can be started directly. The script that is behind the `npm`
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

// The runner is built first, and its absence stops the release: an archive
// without the runner is an archive that cannot quest.
console.log('building the runner');
run('cargo', [
  'build',
  '--release',
  '--manifest-path',
  join(root, shape.runner.crate, 'Cargo.toml'),
]);

const runner = artefactPath(shape.runner.crate, shape.runner.binary);
if (!runner) {
  fail(
    `the ${platform} runner was not built, so there is nothing to package`,
  );
}

// The application. The runner is embedded in it, so the build fails rather than
// warns if the runner is missing.
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

// The archive: the application, the runner, and the notices.
const stage = join(root, 'target', 'release', `discord-auto-quest-${version}-${platform}`);
rmSync(stage, { recursive: true, force: true });
mkdirSync(stage, { recursive: true });

cpSync(app, join(stage, shape.app));
cpSync(runner, join(stage, shape.runner.binary));
cpSync(join(root, 'LICENSE'), join(stage, 'LICENSE'));
cpSync(join(root, 'NOTICE'), join(stage, 'NOTICE'));
cpSync(join(root, 'README.md'), join(stage, 'README.md'));

// A manifest, so the archive says what it is without anyone having to guess.
writeFileSync(
  join(stage, 'RELEASE.txt'),
  [
    `discord-auto-quest ${version}`,
    `platform: ${platform}`,
    `runner: ${shape.runner.binary}`,
    '',
    'The application embeds its own copy of the runner. The copy beside it is',
    'the same bytes, kept here so the archive is complete on its own.',
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
console.log(
  `wrote ${output} (${bytes} bytes) with ${shape.app} and ${shape.runner.binary}`,
);
