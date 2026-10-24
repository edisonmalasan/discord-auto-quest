# GitHub release setup and publication

## Target and version

Discord Auto Quest 1.2.0 targets Windows 10/11 x64 and stable Discord. Linux builds are excluded; macOS compilation is paused. A stable version number does not replace packaged acceptance evidence. Keep the release draft until every required check passes.

`package.json` is authoritative. Change its version, run `npm run version:sync`, then `npm run version:check`. Use complete SemVer: patch for compatible fixes, minor for compatible features, and major for incompatible documented behavior or requirements. Prereleases use suffixes such as `1.2.0-beta.1`; increment the final beta number for another preview. Versions below 1.0 were provisional. A tag must exactly equal `v` plus the version. Preserve published versions, tags, and assets.

## One-time GitHub setup

1. Under Settings → Actions → General, enable the actions used in `.github/workflows/release.yml`. Keep the built-in token restricted: the draft job alone receives `contents: write`.
2. Generate an updater signing key with the installed Tauri CLI: `npx tauri signer generate --help` describes the available options. Store the encrypted private key and password outside the repository. Make an independent, recoverable backup before publication; a second copy on the same disk is insufficient. Never paste private material into chat, logs, issues, or source files.
3. Add repository Actions secrets `TAURI_SIGNING_PRIVATE_KEY` (the encrypted private key content) and `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (its password). Use GitHub Settings → Secrets and variables → Actions → Secrets. Embed only the matching public key in `src-tauri/tauri.conf.json`. Preserve this identity for future updates; replacing it prevents existing installations from authenticating the replacement key.
4. Ensure release maintainers can push tags and manage releases. Respect branch protections and repository rulesets. Review changes through a pull request.

Updater signatures authenticate packages to an app that already trusts the embedded public key. They are separate from Windows publisher signing. These downloads have no Authenticode publisher signature; do not instruct users to disable Windows security protections. SHA-256 checksums detect changed downloads and do not establish publisher identity.

The stable feed is `https://github.com/edisonmalasan/discord-auto-quest/releases/latest/download/latest.json`. GitHub excludes drafts and prereleases from that route. Existing 1.0.1 installations need one manual installation of the first updater-enabled release. Portable copies receive notices and ZIP download links, without in-place installation.

## Verification builds and production candidates

PR, main, and manual workflow runs build unsigned validation assets without production credentials. Local `npm run release` does the same. These live under `target/validation/<version>/`, carry a `VALIDATION-ONLY` marker, and cannot be promoted.

A trusted version-tag push in this repository, pointing to a commit on main, builds the production candidate with the signing secrets. It builds once, validates the files, and transfers those exact files into a draft. Do not replace a failed candidate with an unrelated local build or rerun a published version to replace assets.

Each production candidate has exactly five assets. For 1.2.0:

- `Discord-Auto-Quest-1.2.0-windows-x64-setup.exe`: current-user installer, including WebView2 provisioning when needed.
- `Discord-Auto-Quest-1.2.0-windows-x64-portable.zip`: extract the entire archive; WebView2 must already be installed.
- `Discord-Auto-Quest-1.2.0-windows-x64-setup.exe.sig`: updater signature for that installer and version.
- `latest.json`: HTTPS updater metadata identifying the exact installer URL and signature.
- `SHA256SUMS`: hashes of the other four assets.

Both app distributions include the MIT license, attribution, third-party notices, and installation guidance. GitHub's automatic source archives are additional source downloads, not desktop installers.

## Create a new draft

1. Complete the changes on a task branch. Update the version, changelog, and curated `tools/release-notes.md`; synchronize and check versions.
2. Run applicable frontend/backend tests, type checking, formatting, Clippy, terminology/notices checks, acceptance checks, and executable-content checks. Merge only after required CI checks and the Windows validation build pass.
3. On the verified main commit, create the new tag. Use the following only if `v1.2.0` does not already exist; subsequent releases require a new version.

```text
git switch main
git pull --ff-only origin main
npm run version:check
git tag v1.2.0
git push origin v1.2.0
```

4. Open Actions → release and select the **tag** run. A main-branch run intentionally does not create a draft. Wait for checks, Windows build, and draft release to pass. Missing signing secrets or invalid candidate files fail the production build.
5. Open [repository releases](https://github.com/edisonmalasan/discord-auto-quest/releases), then edit the existing draft. Confirm tag/title, all five assets, accurate notes, and the release channel. Stable 1.2.0 is not a prerelease. Generated release notes are a starting point; curate them for users and retain the installation and limitation information. Do not create a duplicate release.

## Test the exact draft and publish

Download the draft assets. Copy `docs/release-evidence.example.json` to a private local evidence file. Record the exact commit, Windows/Discord environment, five asset hashes, and actual results. The example deliberately contains unavailable checks and cannot authorize publication.

Required acceptance includes standard-user installation, launch, upgrade, uninstall, portable operation, WebView2 provisioning when absent, live views/recovery/handoffs, confirmed multi-platform Desktop selection and partial-selection recovery, Orbs-only Available counts/search with all accepted rewards retained, continuous Work and Stop, completion notifications, update failure recovery, portable update fallback, and confirmed installed updating using signed test candidates. Verify the setup EXE's own icon separately from installed shortcuts. Exercise interrupted downloads, invalid signatures, and unconfirmed cleanup blocking installation. Record independent signing-key backup verification too. Prior-build observations cannot substitute for exact-asset evidence.

Obtain explicit execution-time authorization before live acceptance, platform changes, Work/Stop, installation, or Discord restart checks. Never accept or claim rewards as an incidental test. Keep unsupported or unverified quest coverage explicit.

When every required result passes, authenticate GitHub CLI in your own terminal and run:

```text
gh auth status
npm run release:publish -- C:/path/to/release-evidence.json
```

This command verifies the draft channel, tag/version, tested commit, required results, asset names/contents, update signature/version, checksums, and tested hashes before publication. Stable publication becomes Latest and activates the feed; a preview remains a prerelease. The web interface's Publish release button bypasses these project checks. Do not use it to skip missing evidence.

If any required check is failed or unavailable, retain the draft and record the gap in `docs/RELEASE_CHECKS.md`. Never claim unavailable signing, installation, or live testing passed.

## Optional macOS compilation

Set the Actions variable `ENABLE_MACOS_BUILDS` to `true` to resume compilation only. Unset or `false` skips that job without allocating a Mac runner. It does not enable macOS releases/support or gate Windows draft creation. Existing tags retain their original workflow configuration.

References: [GitHub releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository), [Tauri updater](https://v2.tauri.app/plugin/updater/), [Windows notifications](https://v2.tauri.app/plugin/notification/).
