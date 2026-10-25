# Changelog

This project follows Semantic Versioning. Versions below 1.0 are provisional; prereleases are intended for testing.

## 1.2.1 — Unreleased

- Strengthen content protection and release verification while preserving existing quest workflows.
- Separate public validation builds from production credentials and require approved, version-matched production inputs.
- Keep existing releases unchanged. Packaged verification remains required before publication.

## 1.2.0 — 2026-10-25

- Review and accept supported Desktop/console OR offers with Desktop intent; verify native Desktop selection before Work queue eligibility.
- Recover selection for eligible accepted quests with Use Desktop, preserving 0% and confirmed acceptance if selection fails. Console-selected quests continue in Discord.
- Show only confirmed positive Orbs rewards in Available, including arbitrary amounts and mixed-reward offers. Keep every reward type in Ongoing and Completed.
- Serialize acceptance and selection with Work reconciliation; uncertain results are never automatically retried.
- Exact packaged live acceptance, platform selection, installation, and existing updater/notification checks remain release gates.

## 1.1.1 — 2026-10-24

- Announce completion only from backend-confirmed session events. Loading historical completed quests or observing an unrelated completion no longer produces a second announcement.
- Preserve the 1.1.0 tag and draft; exact 1.1.1 packaged acceptance remains required before publication.

## 1.1.0 — Unreleased

- Keep explicitly started Work active while waiting for accepted quests, process supported quests sequentially, and pick up new acceptances until Stop.
- Confirm cleanup before another session, closing the app, or installing an update; pause uncertain work for deliberate recovery.
- Show valid 0% immediately after acceptance and use the same task for progress and execution.
- Show new completion notices, with optional Windows notifications for installed copies.
- Add confirmed, signed in-app updates for installed copies and manual ZIP links for portable copies. Existing 1.0.1 users install this version manually once.
- Rename the About heading, remove the card preview overlay, and use the app icon for setup and uninstall.
- Require Rust 1.90 and refresh dependency notices. Linux remains excluded and macOS remains paused.

Packaged installation, live account checks, and signed update acceptance remain release gates. See docs/RELEASE_CHECKS.md.

## 1.0.1 — 2026-10-24

- Include Discord's live video playback progress in the quest percentage refresh, while keeping completion dependent on Discord's confirmation.
- Refresh video and activity Work progress from Discord's acknowledgments without extra requests or estimated progress.

## 1.0.0 — 2026-10-24

- Prepare the first stable Windows x64 release and its GitHub draft workflow.
- Include the quest workspace, connection recovery, and deliberate in-app acceptance for supported offers.
- Start the documented major/minor/patch compatibility commitment.
- Keep unsigned distribution, Windows-only support, and all packaged acceptance gates. Earlier beta checks do not establish acceptance of the 1.0.0 downloads.

## 0.2.0-beta.2 — Unreleased

- Review and confirm supported quest offers inside the app, with a Discord fallback.
- Separate acceptance from Work and show uncertain results without automatic retries.
- Verified acceptance of one desktop-play offer in the packaged Windows app. Broader acceptance coverage and the full beta.2 installation/release gates remain unverified.

## 0.2.0-beta.1 — Unreleased

- Windows x64 public beta packaging and release preparation.
- Ongoing, Available, and Completed quest workspace with search and explicit Discord handoffs.
- Clear stale-data, connection-recovery, and uncertain-operation handling.
- Current-user installation and portable distribution, with unsigned-build information.

Known limits: a fresh accept-to-completion cycle and broader quest coverage are unverified. Linux/macOS are unsupported. See README.md for task limitations.
