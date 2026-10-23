# Roadmap

## Current product acceptance

These outcomes refer to the current desktop product. Earlier retired implementations do not establish platform support.

| Case | Outcome | Evidence / status |
|---|---|---|
| N1 | An accepted quest reaches completion and becomes claimable | Previously verified on a real Windows client; a fresh acceptance-to-completion cycle remains unverified. |
| N2 | Protected runtime content is absent as readable text in the executable | Artifact inspection runs locally and in CI. |
| N3 | Video completion without a game | Unverified; not promised by this beta. |
| N4 | Streaming requirements are shown honestly | Interface names required voice-channel participation. |
| N5 | Failed startup of quest work is reported | Covered by backend and controller failure tests. |
| N6 | Completion is shown only when confirmed by Discord | Runtime observation and view-model tests. |
| N7 | Sensitive runtime content is never written to disk | Existing implementation operates in memory; no change to this boundary. |
| N8 | Available quests exclude expired offers | Runtime reads and view-model tests; latest read-only verification showed 16 offers. |
| N9 | Independent identity and distributed notices | Original brand, MIT notices, and acceptance checks. |

## Interface

The merged workspace provides Ongoing, Available, and Completed views; per-view search; native-style cards; explicit Discord handoffs; and restrained, reduced-motion-aware interaction. Failed reads retain marked stale data. Uncertain Work retains Stop and blocks duplicate dispatch. Timeouts release stalled connections without asserting that renderer activity was cancelled.

## Windows beta release gates

Preparation in progress for 0.2.0-beta.1: current-user installer, portable archive, notices, strict version validation, terminology audit, and prerelease publication controls. Release gates must record actual pass/fail/unavailable evidence before publication.

Required packaged-app checks: standard-user installation, launch, portable launch, upgrade, uninstall, WebView2 provisioning, live views/recovery/handoffs, and the documented accepted-quest workflow. Account-affecting checks require explicit authorization.

## Deferred

- Linux/macOS client discovery, launch, recovery, packaging, and real-client acceptance.
- Signed Windows distribution and automatic updates.
- Stable 1.0 compatibility commitment after beta acceptance.
