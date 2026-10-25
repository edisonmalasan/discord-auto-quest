# Roadmap

## Current product acceptance

These outcomes refer to the current desktop product. Earlier retired implementations do not establish platform support.

| Case | Outcome | Evidence / status |
|---|---|---|
| N1 | An accepted quest reaches completion and becomes claimable | Previously verified on a real Windows client; a fresh acceptance-to-completion cycle remains unverified. |
| N2 | Protected runtime content is absent as readable text in the executable | Artifact inspection runs locally and in CI. |
| N3 | Video completion without a game | Partially verified: on 2026-10-23 Topaz reached 9/9 seconds, completedAt was set, and its reward remained unclaimed and claimable. Whether a game was running was not independently recorded; other video quest types remain unverified. |
| N4 | Streaming requirements are shown honestly | Interface names required voice-channel participation. |
| N5 | Failed startup of quest work is reported | Covered by backend and controller failure tests. |
| N6 | Completion is shown only when confirmed by Discord | Runtime observation and view-model tests. |
| N7 | Sensitive runtime content is never written to disk | Existing implementation operates in memory; no change to this boundary. |
| N8 | Available quests exclude expired offers | Runtime reads and view-model tests; latest read-only verification showed 16 offers. |
| N9 | Independent identity and distributed notices | Original brand, MIT notices, and acceptance checks. |

## Interface

The merged workspace provides Ongoing, Available, and Completed views; per-view search; native-style cards; explicit Discord handoffs; and restrained, reduced-motion-aware interaction. Failed reads retain marked stale data. Uncertain Work retains Stop and blocks duplicate dispatch. Timeouts release stalled connections without asserting that renderer activity was cancelled.

The README uses a centered brand header with a tagline, release/build/license/platform badges, and navigation. It leads with public Windows downloads, distinguishes setup, portable, and checksum assets, and provides installation, update, usage, troubleshooting, and documentation links. It retains platform limits and unverified acceptance coverage; the latest-release link follows GitHub's published release rather than a hard-coded version.

## In-app acceptance candidate

First implemented in 0.2.0-beta.2, deliberate acceptance adds deliberate review and confirmation for supported standard Orbs offers. Acceptance is separate from Work and playback; special features and unfamiliar configurations retain a Discord handoff. Fresh offers are checked again at confirmation and unknown outcomes are never retried automatically.

Verified: 116 frontend/tooling tests and 39 backend tests, including schema/identity guards, synthetic acceptance, timeout recovery, controller serialization, and dialog focus. Read-only offer preparation recognized eight of 16 offers. The packaged Windows app passed live review/cancel, then accepted Play Nekome Demo once with explicit authorization: Discord confirmed enrollment, the card moved to Ongoing at 0%, and Available decreased from 16 to 15. Work, game download, and reward claiming were not invoked. Broader acceptance coverage and the full beta.2 installation/release gates remain unverified. The beta.1 tag and draft assets are preserved.

## Windows release gates

Implementation and initial checks completed for 0.2.0-beta.1: current-user installer, portable archive, notices, strict version validation, terminology audit, and prerelease publication controls. Release gates must record actual pass/fail/unavailable evidence before publication.

Required packaged-app checks: standard-user installation, launch, portable launch, upgrade, uninstall, WebView2 provisioning, live views/recovery/handoffs, and the documented accepted-quest workflow. Account-affecting checks require explicit authorization.

## Deferred

- macOS client discovery, launch, recovery, packaging, and real-client acceptance, deferred until a Mac tester or hardware is available. macOS CI compilation is paused by default; Linux build jobs and releases are excluded. See [release configuration](../RELEASE.md) for the optional macOS setting.
- Windows publisher signing. Confirmed in-app updating is being prepared for 1.1.0; unattended installation remains out of scope.

Local candidate acceptance: non-admin installation, launch, upgrade from 0.1.0, uninstall, and portable launch passed. Installed version and license resources matched; deliberate Discord restart recovered live data; existing accepted video completion and Work/Stop UI passed; navigation and Discord handoff passed. Clean-environment WebView2 provisioning remains unavailable and blocks publication. These results apply to the recorded local candidate, not automatically to later CI artifacts. See [release checks](RELEASE_CHECKS.md) for provenance and remaining gates.

## Stable release preparation

Version 1.0.0 starts the documented compatibility commitment. The release workflow supports stable drafts and preserves preview channels, exact tag/version matching, and acceptance/hash/commit gates. Windows remains the only supported target. The first stable download must remain a draft until its exact assets pass every required check, including clean-environment WebView2 provisioning. Historical beta observations above are retained as historical evidence only.

Windows is the current priority. Non-mutating 1.0.0 UI verification confirmed About/version, live views, navigation, search, card-menu dismissal, and acceptance review/Cancel on the exact draft build. The exact portable ZIP also passed byte comparison, launch, live loading, and About/version checks with WebView2 already installed. A normal desktop maintenance reinstall then passed; the Start-menu shortcut displayed the custom badge and launched 1.0.0. The user confirmed the Windows Search badge was fixed. No account actions were performed. Clean first installation, normal cross-version upgrade, uninstall, recovery/Work/Stop, and clean-environment WebView2 provisioning remain unverified. See [the version-specific record](RELEASE_CHECKS.md#100-non-mutating-ui-verification) for provenance and remaining checks.

## Progress synchronization

The 1.0.1 fix includes Discord's live video playback values and acknowledged video/activity Work progress in the existing four-second refresh. Only Discord's valid completion timestamp moves a quest to Completed. Synthetic operation-to-reader tests cover returned values, invalid and unrelated acknowledgments, and preservation of enrollment/reward metadata; the UI test covers percentage updates during Work. All 137 frontend/tooling tests and 39 backend tests passed; Rust formatting and Clippy also passed. A new live account-affecting Work check and acceptance of the new packaged assets remain unverified; earlier draft results do not establish those outcomes.

## Continuous Work and confirmed updates — 1.1.0 preparation

The implementation adds a backend-owned continuous queue, explicit waiting and paused states, confirmed cancellation, task-consistent progress/copy/actions including 0%, completion notices, installed-copy notification preferences, and confirmed signed updater delivery. Expired or ineligible active work is cleaned up before advancing. About and card controls are simplified; setup/uninstall use the application icon. PR/main builds remain unsigned validation builds; trusted tag candidates require five version-matched assets and updater signatures.

Verified locally: 176 frontend/tooling tests and 44 backend harness tests, including actual runtime modules, cleanup uncertainty, queue refill/deduplication, task alternatives, completion deduplication, selected-task card behavior, and stalled-download recovery. Disposable-key fixtures verify Tauri signing compatibility and signed-version binding. PR 39 merged after final branch CI run 40092228452 passed. Production tag run 40092834693 at f297ac1 passed checks and Windows packaging, including all 50 backend tests, Clippy, bundle acceptance, and executable-content validation, then created the signed five-asset draft.

The exact five draft assets match CI bytes and pass signature, manifest, checksum, archive, and executable-content checks. The setup EXE has the custom badge. Authorized desktop verification confirmed installed launch, About 1.1.0, navigation, and live counts after a separately authorized Discord restart. No acceptance, Work, or reward actions were performed. The readout exposed a legacy historical-completion announcement; the 1.1.1 correction removes feed-derived announcements in favor of backend session events, with regression cases reproduced before the fix and passing afterward. Preserve the 1.1.0 draft and tag without publication; exact 1.1.1 packaging and native checks remain required.

Ordinary cross-version upgrade and clean installation remain unverified, alongside installed updates, native completion notifications, live continuous Work, independent signing-key recovery, and clean-environment WebView2 provisioning. Earlier beta/stable observations are not substitutes for those checks. GitHub lists 1.0.0/1.0.1 as already published; their historical missing checks remain open observations. See [the exact draft acceptance record](RELEASE_CHECKS.md#110-exact-draft-read-only-verification).

## Desktop selection and Orbs-only Available — 1.2.0 preparation

Implemented guarded Desktop selection after supported multi-platform OR acceptance and a separate Use Desktop recovery action for eligible accepted offers. Native platform and progress task remain separate. Console-selected entries retain a Discord handoff; selection does not enroll, start Work, or execute console activity. The operation lock serializes selection with reconciliation, and multi-platform queue eligibility requires native Desktop confirmation. Partial selection failure preserves acceptance without reenrollment.

Available membership now uses a confirmed positive structured Orbs reward before counts, search, ordering, and rendering. Mixed rewards use the matching Orbs reward without summing ambiguous quantities. All accepted and completed rewards remain visible. Synthetic verification and exact release evidence are recorded in [release checks](RELEASE_CHECKS.md); live 1.2.0 account changes and packaged acceptance remain unverified.

PR 42 merged at e867a3e after branch CI 40117747099 passed. Production tag run 40118449678 passed all Windows checks, including 201 frontend/tooling tests and 53 backend tests, then created the signed five-file 1.2.0 draft. Independent downloads matched CI bytes and passed signature, manifest, checksum, archive, executable-content, version metadata, and setup-icon checks. Read-only source evaluation also confirmed live Orbs filtering and native Desktop metadata. Exact packaged live acceptance/selection and the existing native release gates remain unverified; keep the new assets in draft. See [the immutable asset record](RELEASE_CHECKS.md#120-exact-draft-artifact-verification).

Authorized exact-asset 1.1.1-to-1.2.0 upgrade and read-only verification passed in the existing desktop installation with WebView2 present. About/version, native live views, Orbs-only membership/search, custom setup/window/shortcut icons, notice integrity, and stopped launch were verified. Review/Cancel displayed Desktop intent without enrolling. No new acceptance, platform change, Work, reward claim, or Discord restart was performed. The remaining native release gates stay open; see [installed verification](RELEASE_CHECKS.md#120-installed-upgrade-and-read-only-verification--2026-10-25).

A later, separately authorized live test in exact installed 1.2.0 accepted the 700-Orb Call of Duty offer once and confirmed native Desktop selection and 0/900-second progress. Ongoing increased to 1, Available decreased to 10, and Completed stayed 13. Work remained stopped. Independent read-only metadata corroborated the result. This is a scoped acceptance/selection pass; full completion and selection-recovery coverage remain unverified. See [the live record](RELEASE_CHECKS.md#120-authorized-desktop-acceptance--2026-10-25).

## Content protection — 1.2.1 preparation

The public repository previously carried the encrypted content and its decryption key. Existing releases and history remain recoverable. This patch separates private production inputs from inert public validation builds, transforms protected content before encryption, and binds production identity to the version and manifest digest. Missing inputs fail closed. Production jobs require environment review and never share Rust output caches; validation artifacts cannot be promoted.

Verified locally: all 56 private behavioral cases passed against both the readable source and transformed encrypted content. The transformation also reproduced the authenticated asset digests with network and write permissions denied. The public suite passed all 169 cases. Backend suites passed 52 unit cases in validation and production modes; the additional integration test exercised the non-test validation guard. Production Clippy, type checking, frontend build, and bundle acceptance passed. [PR 46](https://github.com/edisonmalasan/discord-auto-quest/pull/46) merged after passing CI.

After the user's authorization and passing tag checks, the reviewed production build at immutable tag commit 0bdf340 passed [run 40151256908](https://github.com/edisonmalasan/discord-auto-quest/actions/runs/40151256908) and created the five-asset 1.2.1 draft. Independent CI and draft downloads matched byte for byte. Signatures, manifest, checksums, archive contents, production identity, and scans of both unpacked distributions passed. Static inspection confirmed version 1.2.1 and the custom setup/application icons. Native installation and live 1.2.1 acceptance remain pending; no live account changes were made for this patch. Keep the release draft until its required native gates pass. Leak checks are regression checks, not proof against reverse engineering. See [the exact asset record](RELEASE_CHECKS.md#121-exact-draft-artifact-verification--2026-10-25).

GitHub now lists 1.2.0 as published. Its previously recorded unavailable acceptance gates remain unavailable; publication does not establish their success. Future releases retain those gates. Detailed 1.2.1 evidence belongs in the release verification record.

## Shared acceptance fixes — 1.2.2 preparation

Regression tests reproduced persistent acceptance feedback and compatible metadata being rejected by the shared acceptance/Desktop-selection boundary. Feedback now expires after five seconds, with timer replacement and keyboard-focus coverage; unresolved errors remain visible. Compatible metadata is recognized through the client's semantic feature values, independently of quest names, identifiers, or Orb amounts. Explicit review/confirmation remains required. Supported Desktop/console OR acceptance selects Desktop and verifies native readback; enrollment arriving during review completes selection without enrolling again. Stale reviews, unknown requirements, active jobs, uncertain selection, and Console-selected quests retain their existing guards and recovery.

All 172 public cases passed. All 67 private behavioral cases passed against both readable and transformed encrypted content, including new acceptance/selection regressions. Production backend tests passed all 52 unit cases; Clippy and Rust formatting passed. Type checking, frontend build, version, content, notices, wording, bundle acceptance, and the changed-component design detector passed. The production debug executable passed version-bound content identity and original/transformed/textual-key leak checks. Read-only transformation verification reproduced the authenticated content digests. Graphify's code graph was refreshed.

An isolated browser fixture confirmed review, acceptance feedback appearance/disappearance, Desktop display, and valid 0% without Discord calls. A separate read-only comparison against the live client recovered one Available review and one accepted quest's Desktop-selection capability. These observations are not a live acceptance or platform-change test. Windows CI is tracked on [PR 48](https://github.com/edisonmalasan/discord-auto-quest/pull/48). Exact packaged and live account checks remain pending. Existing versions and assets are preserved. See [the verification record](RELEASE_CHECKS.md#122-shared-acceptance-fix-verification--2026-10-25).
