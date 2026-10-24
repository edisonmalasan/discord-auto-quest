# Windows release verification

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

## 1.0.0 preparation

The first stable version is 1.0.0. Its exact installer and portable assets have not yet completed packaged acceptance. All earlier results and hashes above apply only to their named beta candidates. Clean-environment WebView2 provisioning is still unavailable. Keep the 1.0.0 release draft until the complete evidence record identifies its commit, hashes, environment, and passing results. Use [the evidence template](release-evidence.example.json) and [release instructions](../RELEASE.md).

## 1.0.0 non-mutating UI verification

On 2026-10-23 the exact draft installer upgraded the earlier beta.1 installation to 1.0.0 with exit 0 under a non-elevated account. The installed app's About panel showed 1.0.0, MIT, and the independent-project notice. Environment: Windows build 26200.9457 / 25H2, stable Discord 1.0.9265, WebView2 155.0.4283.62 already installed.

| Check | Observed result |
|---|---|
| Live quest views | Ongoing 1, Available 14, Completed 10; the user-accepted Royal Match quest appeared at 0%. |
| Navigation and search | All three views opened; filtering Available to Sensei returned one card; its filter survived switching views and was cleared after testing. |
| In-app acceptance review | Sensei Pro and Rival Pro showed the reward, requirements, expiry, and a separate confirmation button. Cancel closed it; counts remained unchanged. No offer was accepted during this check. |
| Card menu | The completed Play Nekome Demo card menu opened and dismissed on an outside click. No menu action was invoked. |
| Brand assets | The installed executable, portable executable, and Start-menu shortcut each yielded the custom brand icon. No missing icon asset was found. |
| Portable launch | On 2026-10-24 (Asia/Manila), all six extracted files were compared with the exact ZIP; the portable app launched with WebView2 already installed, loaded live counts 1/14/10, and showed version 1.0.0 and MIT in About. |

The initial upgrade was launched from a packaged test host whose app-data path resolved into private storage, so it does not establish a normal desktop cross-version upgrade. On 2026-10-24 (Asia/Manila), Windows Explorer launched the exact installer in the ordinary desktop context. Add/Reinstall components completed successfully at the default current-user destination without requesting data deletion. The installed app launched and showed 1.0.0/MIT and live counts 1/14/10. Its Start-menu shortcut visibly carried the custom blue badge and launched the app through Explorer. The user separately confirmed that Windows Search now displays the custom badge. This verifies maintenance reinstall and shortcut registration, not clean first installation or cross-version upgrade.

The observations identify these immutable draft assets at commit 7890b56a4dd205980af98b5f924b1ac0d52f1a2f:

```text
3afe6e668c22987ace564f1c3ae65dc74ae6b9b280e0344af63df3574c823520  Discord-Auto-Quest-1.0.0-windows-x64-setup.exe
38d92da84f20841cb4b329f6a6a7e428c88681be38db4cb6b1f6e10ce79b4d42  Discord-Auto-Quest-1.0.0-windows-x64-portable.zip
```

Clean first installation, normal cross-version upgrade, uninstall, live recovery/handoffs, Work/Stop, and clean-environment WebView2 provisioning remain unverified for these exact assets. No account-affecting actions were performed. Windows Sandbox is unavailable on this test host. Keep the release draft; earlier beta results are not substitutes for these missing checks.

## Historical publication status

GitHub records 1.0.0 and 1.0.1 as published on 2026-10-24 in Asia/Manila (2026-10-23 21:49:58 and 22:46:46 UTC). Their earlier unverified acceptance results remain unverified; publication does not establish that those checks passed.

## 1.1.0 preparation — 2026-10-24

Source implementation is prepared; release acceptance is pending. Local verification passed 176 frontend/tooling tests across 23 files and 44 backend harness tests importing the actual runtime/controller modules and download-deadline helper. The new card regression verifies that descriptions/actions follow the selected task alongside its percentage. Harness Clippy passed with the declared Rust 1.90 minimum. These synthetic tests perform no Discord account actions.

Final branch CI run 40092228452 passed checks and Windows validation packaging. The production tag run 40092834693 at f297ac1b308932439f7dccfd6a8c675540f2043a then passed full-crate Clippy, all 50 backend tests, 176 frontend/tooling tests, production frontend build, and version/terminology/notices/bundle acceptance checks. Three browser integration tests remained ignored. Unsigned validation builds cannot be promoted. The trusted tag build produced the signed five-file candidate, verified its contents and executable, and created a stable draft.

Isolated browser verification at 880, 1200, and 1600 CSS pixels confirmed waiting/Stop controls, an accepted 0% ring, removal of the preview overlay, About/version/update controls, and confirmed download progress inside the modal. The wide viewport had no horizontal page overflow. This used mock IPC and sample data; no installer, notification delivery, update installation, or Discord behavior was exercised.

The full local production dependency build exhausted memory while compiling Windows notification dependencies; CI supplied full-crate verification. Exact 1.1.0 production installer/portable acceptance, installed updates between signed test candidates, notification delivery/identity, normal close cleanup, and live continuous Work remain unverified. Clean-environment WebView2 provisioning remains unavailable. No earlier artifact hashes above establish acceptance for 1.1.0.

The production signing identity is stored outside the repository, and signing secrets are configured in GitHub Actions. A same-host backup exists; an independent recoverable backup remains unverified and blocks publication. Only the public key is embedded. Keep the release draft until its exact five assets and every required result in the evidence template pass.

## 1.1.0 exact draft read-only verification

On 2026-10-24 (Asia/Manila), all five downloaded draft files matched the production CI artifact byte for byte. Asset names, checksums, updater signature, signed version, manifest URL, and portable archive contents passed verification. The setup EXE independently yielded the custom blue application icon. The exact portable executable passed the executable-content check.

After explicit installation and read-only authorization, the installer completed successfully in the test host's private app-data location. This observed a 1.0.0 to 1.1.0 upgrade there, but does not establish an ordinary desktop cross-version upgrade. The same setup was then opened through ordinary Windows Explorer; user input advanced it to the completion page. The desktop app launched from the user's chosen installation folder and showed version 1.1.0, MIT, the independence notice, and the installed-only Windows notification option, disabled by default. Its executable differed from the exact portable executable only in the three package-marker bytes. Installed license and notice files were present.

Environment: non-elevated Windows 11 IoT Enterprise, build 26200 / 25H2, stable Discord 1.0.9265, with WebView2 already installed. After separate execution-time authorization, one Discord restart recovered live counts of 0 ongoing, 14 available, and 12 completed. All three views opened, card artwork loaded, and the small preview/play overlay was absent. A card menu opened and dismissed on an outside search-field click. No quest acceptance, Work, or reward claim was performed. Manual update checking displayed a recoverable error while the public latest release lacked the new update feed; successful update delivery remains unverified.

The live accessibility readout exposed a legacy frontend announcement that treated historical completions arriving after an empty read as newly completed quests. This violates the notification requirement even though the backend event path tracks only session-managed quests. The 1.1.0 draft must not be published; preserve its tag and assets as the tested candidate. The 1.1.1 correction removes the separate feed-derived announcer and uses only backend completion events. Regression cases reproduced both historical and unrelated completion announcements before the fix and passed afterward; backend-confirmed notice navigation is retained. Exact 1.1.1 packaging and native acceptance remain required.

These observations apply to commit f297ac1b308932439f7dccfd6a8c675540f2043a and the following immutable draft files:

```text
dce4a5f2068ecbf9f0015544e397daa3bb953fe50a47d5fd953d59295ff5f1a8  Discord-Auto-Quest-1.1.0-windows-x64-setup.exe
06a4dd586e4d451551f00e81ca3b4aa8c7d16c43584b3c29535d2f9dfa716865  Discord-Auto-Quest-1.1.0-windows-x64-portable.zip
4b252731cf92b8b6684d2402612e86cb26505fc331e8e9d5dcbec46b28df1e40  Discord-Auto-Quest-1.1.0-windows-x64-setup.exe.sig
8e3b68a8853e3df51f3f239ade0b074294b2ee36431dfad1e21b38097ad7539a  latest.json
99670ff88e530c934102747b4e136f4aac89d9e762d3172b9bbe1121c7b2ee29  SHA256SUMS
```

Clean installation, ordinary cross-version upgrade, uninstall, portable execution, clean WebView2 provisioning, live recovery and quest workflows, completion delivery, signed update installation and failure recovery, and independent signing-key backup remain unverified. The release remains a draft.

## 1.1.1 correction verification

The completion-announcement correction passes all 178 frontend/tooling tests across 23 files, including regression cases that failed against 1.1.0. Type checking, production frontend build, version agreement, terminology, notices, bundle acceptance, whitespace, and the changed-component design detector passed locally. Dependency versions and required notices are unchanged; only project-version lockfile metadata and its audited hashes changed. Graphify was refreshed. Full Windows CI, signed 1.1.1 packaging, and exact native acceptance remain required; the 1.1.0 observations above do not establish them.
