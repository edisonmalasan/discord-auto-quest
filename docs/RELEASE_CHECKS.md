# Windows beta verification

Recorded 2026-10-23 for 0.2.0-beta.1. Publication remains blocked; prepare a draft prerelease only.

## Automated verification

- Frontend: 88 tests passed across 16 files.
- Backend: 36 tests passed; three browser integration tests passed separately.
- Type checking, frontend build, Rust formatting, Clippy, version agreement, terminology audit, notices audit, acceptance checks, and executable-content checks passed.
- CI run 39927035641 passed checks and compilation on Windows, Linux, and macOS at efc25ea904815e009602fcbbd2670e3efcdfef3f. This is compilation evidence, not Linux/macOS support.

## Local packaged-app acceptance

The tested local candidate was built from 9ba6461, before subsequent documentation and CI changes. Environment: non-elevated Windows account, build 26200.9457 / 25H2; stable Discord 1.0.9265; WebView2 already installed. Windows reports an IoT Enterprise product label, so this does not establish broad Windows edition coverage.

| Check | Result |
|---|---|
| Current-user installation | Passed, exit 0; version and distributed attribution/notices verified. |
| Installed launch | Passed; About showed 0.2.0-beta.1 and live quests loaded. |
| Upgrade | Passed from a private 0.1.0 installer to the beta; both installers exited 0, version changed correctly, upgraded app launched and loaded quests. Installed and portable executables differed only in Tauri's three-byte package marker. |
| Uninstall | Passed; executable and installation registration removed without requesting app-data deletion. |
| Portable launch | Passed after extracting the full archive; version and live views verified. |
| Live recovery and handoffs | Passed deliberate authorized Discord restart, navigation, and handoff to Discord Quests. No quest was accepted by the app. |
| Existing accepted quest | Topaz video reached 9/9 seconds, completion was confirmed by Discord, and reward remained unclaimed and claimable. UI Work/Stop returned to idle. |
| WebView2 provisioning when absent | Unavailable: no clean Windows VM or Sandbox. Required before publication. |

Local candidate SHA-256 values:

```text
3382414e14bc48609433cfcbf2cc3dded5ff4a892acf8fcffd77de5b0021bea8  Discord-Auto-Quest-0.2.0-beta.1-windows-x64-setup.exe
108309f1e818199a2093cc5aceebe4932e0e2294742251408b5a48608286106c  Discord-Auto-Quest-0.2.0-beta.1-windows-x64-portable.zip
```

## Remaining publication gates

Test the exact draft assets and record their hashes, commit, environment, and every required acceptance result. Earlier local results must not be reused as hash-specific proof for rebuilt CI assets. Exercise WebView2 provisioning in a clean standard-user Windows environment. A fresh user-accepted quest cycle and additional quest types remain unverified; no general support claim follows from one video result. The no-game condition was not independently recorded.

The release tooling rejects incomplete acceptance evidence. Keep the beta draft until all required checks pass. Linux/macOS integration and signed Windows distribution remain follow-up work.

## Beta.2 acceptance feature verification

On 2026-10-23 the packaged Windows candidate passed live offer review and Cancel without enrollment. After explicit authorization for one named offer, confirmation accepted Play Nekome Demo and a separate live read confirmed enrollment. The app showed it in Ongoing at 0%, with Available decreasing from 16 to 15. Work, game download, and reward claiming were not invoked. This verifies one desktop-play acceptance flow, not every offer or the full beta.2 installation/release gates.

The tested local candidate used runtime code from 557a82d, stable Discord 1.0.9265, and the existing Windows/WebView2 environment described above. Its hashes identify that tested build; later CI builds require their own release acceptance record.

```text
a518f33cc304010953e68b03b956fa67882be1b31e4af20fc76eb0c3c96126bf  Discord-Auto-Quest-0.2.0-beta.2-windows-x64-setup.exe
5eab2ee0eec83f7f1ea9f29c35f0311bc388051a19013a6d3b6c2619442bd4ac  Discord-Auto-Quest-0.2.0-beta.2-windows-x64-portable.zip
```
