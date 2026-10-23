# Release process

## Target and version

The first public prerelease is v0.2.0-beta.1 for Windows 10/11 x64 and stable Discord. Linux/macOS CI checks compilation only; do not attach their development binaries to this release.

package.json is authoritative. Run npm run version:sync after changing it, then npm run version:check. Versions must be complete SemVer values. A release tag must equal v followed by the app version. Published tags and assets are never overwritten. Subsequent beta corrections use beta.2, beta.3, and so on.

## Candidate artifacts

Build with npm run release on Windows x64. The candidate consists of a current-user setup EXE, a portable ZIP, and SHA256SUMS. Both distributions include LICENSE, NOTICE, THIRD_PARTY_NOTICES.txt, and installation guidance. The setup provisions WebView2 when needed; the portable distribution requires it already installed. Builds are unsigned. No automatic updater is included.

## Gates

All test, lint, format, version, terminology, acceptance, artifact-content, archive, and checksum checks must pass. Use a standard-user Windows test environment to verify installation, launch, upgrade, uninstall, and portable execution, including WebView2 provisioning. Verify live views, recovery, handoffs, and the documented accepted-quest workflow. Do not perform account-affecting checks without explicit authorization. Record unavailable checks honestly; a missing required result blocks publication.

## Publication

CI creates verified candidate artifacts once. Publication promotes those exact artifacts to a draft GitHub prerelease using curated notes and explicit prerelease metadata. Review the draft's filenames, version, checksums, notices, and acceptance evidence. Publish only after all required gates pass. Never mark a beta as the latest stable release. If a version already exists, stop and choose a new version; never use replacement uploads.

Release evidence must identify the tested commit, Windows/Discord versions, artifact hashes, and pass/fail/unavailable results. Do not publish sensitive diagnostics or private maintenance references.
