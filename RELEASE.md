# GitHub release setup and publication

## Target and version

The first full release is prepared as v1.0.1 for Windows 10/11 x64 and stable Discord. Linux/macOS CI checks compilation only; do not attach their development binaries. A stable version number does not replace the required acceptance evidence: keep the release draft while any required check is unavailable.

package.json is authoritative. After changing it, run npm run version:sync and npm run version:check. Use complete SemVer: 1.0.1 for compatible fixes, 1.1.0 for compatible features, and 2.0.0 for breaking documented behavior or requirements. Preview builds use suffixes such as 1.1.0-beta.1 or 1.1.0-rc.1. The tag must exactly equal v plus the version. Never overwrite published tags or assets, and never rename an old beta binary into a stable download.

## One-time GitHub setup

1. Open the repository's Settings → Actions → General. Ensure Actions is enabled and the actions used by .github/workflows/release.yml are permitted by repository/organization policy.
2. Keep token permissions restricted. The workflow already grants contents: read generally and contents: write only to its draft-release job. It uses GitHub's built-in token; no personal access token or new repository secret is required for this configured flow. Organization policy may further restrict these permissions.
3. Ensure your account can push release tags and manage releases. Respect any repository rulesets. Do not bypass protected branches.
4. Keep release changes in a pull request. Merge only after checks and Windows/Linux/macOS build jobs pass.

Sources: [GitHub token permissions](https://docs.github.com/en/actions/tutorials/authenticate-with-github_token), [managing releases](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository).

## Candidate artifacts

Build with npm run release on Windows x64. The candidate consists of a current-user setup EXE, a portable ZIP, and SHA256SUMS. Both distributions include LICENSE, NOTICE, THIRD_PARTY_NOTICES.txt, and installation guidance. The setup provisions WebView2 when needed; the portable distribution requires it already installed. Builds are unsigned. No automatic updater is included.

## Gates

All test, lint, format, version, terminology, acceptance, artifact-content, archive, and checksum checks must pass. Use a standard-user Windows test environment to verify installation, launch, upgrade, uninstall, and portable execution, including WebView2 provisioning. Verify live views, recovery, handoffs, and the documented accepted-quest workflow. Do not perform account-affecting checks without explicit authorization. Record unavailable checks honestly; a missing required result blocks publication.

## Create the draft automatically

After the version change is merged, tag the exact verified commit on main. For 1.0.1, run the following only if v1.0.1 does not already exist; future releases need their own new version and tag.

```text
git switch main
git pull --ff-only origin main
npm run version:check
git tag v1.0.1
git push origin v1.0.1
```

Open the repository's Actions tab and select the release run for that tag. It runs checks, builds Windows assets once, verifies them, then creates a draft using those exact files. No public publication occurs automatically. If a job fails, inspect its logs; do not manually upload an unrelated local build as a substitute.

Open [repository releases](https://github.com/edisonmalasan/discord-auto-quest/releases). Edit the existing draft rather than creating another release for the same tag. Check:

- Tag: v1.0.1; title: Discord Auto Quest 1.0.1.
- This is a pre-release: unchecked for 1.0.1; checked for beta/RC versions.
- The three attached downloads: Discord-Auto-Quest-1.0.1-windows-x64-setup.exe, Discord-Auto-Quest-1.0.1-windows-x64-portable.zip, and SHA256SUMS.
- Curated notes accurately state supported Windows requirements, unsigned status, and known limitations. GitHub's automatic source archives are not the desktop downloads.

GitHub also offers Releases → Draft a new release for manual setup, with tag, target, title, notes, binaries, prerelease, and latest controls. This repository's automated draft flow already fills these fields. Do not create a duplicate manually. See [GitHub's release interface guide](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository?tool=webui).

## Verify and publish

Download the draft's exact EXE and ZIP and test them. Copy docs/release-evidence.example.json into a local evidence file, fill in the release commit, Windows and Discord versions, artifact hashes, and actual results. The example intentionally contains unavailable results and cannot authorize publication. Do not mark a check pass merely because it passed on a different build.

With GitHub CLI installed and authenticated, use the project's guarded publication command after every required result passes:

```text
gh auth status
npm run release:publish -- C:/path/to/release-evidence.json
```

The command verifies the draft channel, exact tag/version, tested commit, required results, downloaded asset contents, and tested hashes before publishing. A full release becomes Latest; a beta/RC remains a prerelease and is not marked Latest. If you need to configure GitHub CLI authentication, use gh auth login in your own terminal; never paste tokens into issues or documentation.

If a required check is unavailable, stop at the draft. In particular, the earlier beta tests did not establish clean-environment WebView2 provisioning, and they cannot serve as hash-specific evidence for 1.0.1. See docs/RELEASE_CHECKS.md. The web interface's Publish release button does not enforce this project's evidence checks; use the guarded command.

## Artifact preservation

CI creates verified candidate artifacts once. Draft creation and publication reuse those exact artifacts with explicit channel metadata. Never mark a beta as the latest stable release. If a version already exists, choose a new version; never use replacement uploads.

Release evidence must identify the tested commit, Windows/Discord versions, artifact hashes, and pass/fail/unavailable results. Do not publish sensitive diagnostics or private maintenance references.
