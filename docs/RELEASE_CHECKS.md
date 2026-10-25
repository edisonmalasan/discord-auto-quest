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

Isolated browser verification at 880, 1200, and 1690 CSS pixels confirmed waiting/Stop controls, an accepted 0% ring, removal of the preview overlay, About/version/update controls, and confirmed download progress inside the modal. The wide viewport had no horizontal page overflow. This used mock IPC and sample data; no installer, notification delivery, update installation, or Discord behavior was exercised.

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

## 1.2.0 Desktop selection and Orbs-only preparation — 2026-10-25

Synthetic checks cover standard Desktop and video acceptance, Desktop/Xbox/PlayStation OR offers, arbitrary positive Orb quantities, review without mutation, duplicate/stale confirmation, unknown schemas/capabilities, native selection readback, active-job and Console guards, and accepted-but-selection-unconfirmed recovery without reenrollment. Queue tests require native Desktop confirmation even when other metadata says eligible; a controller concurrency case serializes explicit selection with reconciliation before dispatch. Structured reward tests cover non-Orb and misleading names, invalid amounts, mixed rewards, and ambiguous quantities without summing. View tests retain accepted/completed rewards and filter before Available counts, search, sorting, and empty state.

Local verification: 201 frontend/tooling tests across 23 files, 47 backend harness tests importing the actual runtime/controller modules, harness Clippy, Rust formatting, type checking, production frontend build, version/terminology/notices/bundle checks, and changed-component design detection. Dependency versions and notices are unchanged; lockfile audit hashes were renewed after proving only project-version metadata changed. Graphify was refreshed. Full Windows CI and exact executable checks remain required.

The isolated browser fixture verified Use Desktop, native-confirmed Desktop display with 0%, review/Cancel with Desktop intent and the continuous-Work warning, and Orbs-only counts. It uses synthetic IPC and makes no Discord calls. No live acceptance, platform change, Work/Stop, installation, or Discord restart was performed during this task. The user separately reported Resident Evil Sale progressing after selecting Desktop in Discord and enabling Work; this is user-reported evidence, not independent 1.2.0 verification.

Keep 1.2.0 assets in draft until exact packaged checks pass, including native Desktop selection/partial recovery, Orbs-only views, the existing installation/upgrade/uninstall/portable and clean WebView2 gates, live continuous Work, completion delivery, signed updates/failure recovery, and independent key-backup recovery. Earlier releases and historical observations do not satisfy these checks.

## 1.2.0 exact draft artifact verification

[PR 42](https://github.com/edisonmalasan/discord-auto-quest/pull/42) merged at e867a3e57367b1a20d41b8d57cecd05067ed0e96 after branch CI 40117747099 passed. The unchanged v1.2.0 tag points to that commit. [Production run 40118449668](https://github.com/edisonmalasan/discord-auto-quest/actions/runs/40118449668) passed checks, Windows packaging, and draft creation: 201 frontend/tooling tests, 53 full-crate backend tests, Clippy, formatting, version, terminology, notices, bundle acceptance, and executable-content checks. Three browser integration tests remain ignored. Linux is excluded and macOS was skipped.

All five files downloaded separately from the CI artifact and [stable 1.2.0 draft](https://github.com/edisonmalasan/discord-auto-quest/releases/tag/untagged-71862ffd2f5559a92e2f) matched byte for byte. Asset names, updater signature and signed version, manifest HTTPS URLs, checksums, and portable archive contents passed local verification. The exact portable executable passed the content scan and reports FileVersion/ProductVersion 1.2.0 and ProductName Discord Auto Quest. The downloaded setup EXE independently yielded the custom blue badge. It has an updater signature and remains unsigned for Windows publisher identity.

```text
73906e8dfaa8b8dd2ae02af40ce21dff4e1465de8b381c579120091c7840e663  Discord-Auto-Quest-1.2.0-windows-x64-portable.zip
b2e0d6b61fe471b2b7dec7a2d46dbb00e2dc3f9675332b22eed9047ee11fb1bb  Discord-Auto-Quest-1.2.0-windows-x64-setup.exe
8e55678c6b4fc05406449d3bddafca24ee0f09a0d45d5e32b0d88b9f7aa7e762  Discord-Auto-Quest-1.2.0-windows-x64-setup.exe.sig
fb37d12398a5cbef23fae4965199a8607a6b9145f75048d261142530d1dcfdb2  latest.json
998a5972f16742f656211d6f288b992796868872bd0c0ba83589d70a1c3aa3ce  SHA256SUMS
```

A separate read-only evaluation of the current source expressions through the existing Discord connection returned 13 raw Available offers and 11 confirmed Orbs offers, with 0 Ongoing and 13 Completed. The native record for Resident Evil Sale was already completed at 900/900 and selected Desktop. No acceptance, platform selection, Work/Stop, installation, or restart was performed. These observations verify read-only compatibility with the current client; they do not establish acceptance or selection performed by the exact packaged 1.2.0 app. The user's earlier report that selecting Desktop then enabling Work increased progress remains user-reported evidence.

GitHub currently lists 1.1.1 as the published Latest release. Its publication does not resolve unverified historical acceptance gates. Preserve that release and older tags/assets. The 1.2.0 release remains a draft: exact native acceptance/selection and partial recovery, Orbs-only UI views, installation/upgrade/uninstall/portable operation, clean WebView2 provisioning, continuous Work, completion notifications, signed installed updates and recovery, and independent signing-key backup remain unverified.

## 1.2.0 installed upgrade and read-only verification — 2026-10-25

The user separately authorized installation/read-only checks and Stop of the existing waiting Work session. In the installed 1.1.1 app, Stop settled to Work my quests before the app was closed. The exact previously hashed 1.2.0 draft setup was launched through ordinary Windows Explorer. Setup recognized the older version; Do not uninstall and the existing D:/Apps/Discord Auto Quest destination were retained. Installation completed successfully and the upgraded desktop app launched. User input also advanced the installer; automation refreshed its observations before continuing. This verifies that upgrade path with WebView2 already installed, not a clean installation or fresh WebView2 provisioning.

Environment: Windows x64 build 26200 / 25H2, stable Discord desktop 1.0.9265, and an existing client connection. Installed file metadata and About showed 1.2.0. The application window, setup, and Start-menu shortcut used the custom blue badge; the shortcut targeted the upgraded executable. Installed license and notices matched the exact portable distribution. The executable passed the content scan and differed from the portable executable only in the three package-type marker bytes. The installed Windows notification control was available and unchecked.

All three views loaded without restarting Discord: 0 Ongoing, 11 Available, and 13 Completed. Before the upgrade, Available showed 13 offers including two non-Orb rewards. Afterward, searching Call of Duty showed only its 700-Orb offer; the count remained 11. Completed retained its 13 records. No historical completion was announced on launch, and Work stayed stopped. Read-only review of that offer displayed Desktop intent, 700 Orbs, desktop play for 15 minutes, and expiry. Cancel left counts unchanged. No acceptance, native platform change, new Work, reward claim, or Discord restart was performed in these checks.

The exact-asset ledger records upgrade, launch, live views, and the current Orbs-only membership/search scenario as passed. Clean installation, uninstall, portable execution, clean WebView2 provisioning, native acceptance/selection and partial recovery, live continuous Work and task cancellation, completion notification delivery, signed installed updates/recovery, and independent signing-key backup remain unverified. Keep the release draft.

## 1.2.0 authorized Desktop acceptance — 2026-10-25

After separate execution-time authorization, the exact installed 1.2.0 draft accepted the 700-Orb Call of Duty: Modern Warfare 4 offer once. Work was confirmed stopped before review. The dialog showed Desktop intent, the 700-Orb reward, desktop play for 15 minutes, and expiry. Confirm acceptance was clicked once; Discord confirmed acceptance without an uncertain or partial-selection response. Available changed from 11 to 10, Ongoing from 0 to 1, and Completed stayed 13. The Ongoing card showed Quest accepted, Desktop, and a valid 0% ring.

An independent read-only client read corroborated the enrolled record, native Desktop selection, desktop task, 0 of 900 seconds, and Work eligibility. The app retained Work my quests throughout the settled result; acceptance did not enable Work. No Work, playback, game download, reward claim, console action, or Discord restart was invoked. This verifies one standard Desktop/console OR acceptance and automatic Desktop readback in the exact packaged app. It does not verify a fresh acceptance-to-completion cycle, selection failure or Use Desktop recovery, console-selected handoffs, or broader quest coverage. Existing native publication gates remain open and the release stays draft.

## 1.2.1 content-protection preparation — 2026-10-25

The 1.2.1 patch preserves existing releases and Git history. Previously exposed content remains recoverable. The public tree no longer carries a production content key; a fresh key and a verification digest are scoped to the reviewed, tag-only production-content Actions environment. Updater signing identity is unchanged.

The private behavioral suite passed 56 cases against the readable maintenance source and the transformed encrypted assets separately. The pinned transformation also reproduced the exact authenticated content digests under Node's permission model without network or filesystem-write permission. The current public manifest SHA-256 is `54e3249f78ac71ae8d0f7348be040fb45cbe68a2533e574de0a30abcd7c4ef9a`.

Public CI uses inert content and tests build/authentication/interface failures. A non-test integration case verifies that validation binaries reject Work, acceptance, and Desktop selection. Production packaging requires the private verification digest, exact version-bound identity, signatures/checksums, and inspection of the executable extracted from both distributions. No source maps, key files, private compiler inputs, debug files, or known protected plaintext may ship. These checks do not prove resistance to a determined analyst.

Local production-mode backend checks passed all 52 unit cases, and Clippy passed with warnings denied. Validation-mode tests also passed the non-test operation guard; three browser-starting integration tests were not rerun. All 169 public frontend/tooling cases passed, alongside type checking, frontend build, bundle acceptance, wording, notices, and version checks. The production debug executable passed exact content identity and original/transformed plaintext scans; this alone is not exact release-asset acceptance. [PR 46](https://github.com/edisonmalasan/discord-auto-quest/pull/46) merged after final branch CI 40150528408 passed. Merged-main validation run 40151246386 also passed. Exact production artifact verification is recorded below; native checks remain separate.

## 1.2.1 exact draft artifact verification — 2026-10-25

The immutable v1.2.1 tag points to merge commit `0bdf340818376c64ad5b1a5a8d433742e134191d`. After tag checks passed, the user authorized approval of this exact production build and draft verification. The protected production-content environment was approved for that commit. [Production run 40151256908](https://github.com/edisonmalasan/discord-auto-quest/actions/runs/40151256908) passed checks, production backend tests, Clippy, Windows packaging, and draft creation. Linux remains excluded; macOS and public validation packaging were intentionally skipped for this production tag run.

All five files were downloaded independently from the CI artifact and the [1.2.1 draft](https://github.com/edisonmalasan/discord-auto-quest/releases/tag/untagged-168d806797f3191f5598). Their bytes matched exactly. Names, updater signature and signed version, manifest HTTPS URLs, checksums, portable archive bounds and contents, and exact production identity passed verification. Both distributions were unpacked and scanned for original and transformed protected plaintext, textual key encodings, private files, fixtures, source maps, and debug output; the checks passed. These scans detect known leaks and do not establish resistance to reverse engineering.

```text
4077106d82cad3a31b270c8ce1d58745adc4fbef1eb278b3d2681c6336833cb8  Discord-Auto-Quest-1.2.1-windows-x64-portable.zip
bcad84ed066dfda9d5bdc749efba09c701b3bb3909d61a1c72f4cfdcce3f0058  Discord-Auto-Quest-1.2.1-windows-x64-setup.exe
ef2b809860f3c5c383d7f5f44299533865243d1751e260f6ecb16ee322e598c0  Discord-Auto-Quest-1.2.1-windows-x64-setup.exe.sig
6e288bca4c40faa8dc82669a570282c1ad74a6dbaa3d1eabad7481fad72ce030  latest.json
0a97adb6cbca0d4f06562fb2fc6d022f379ba9a79c1321727e542e65837bdfcc  SHA256SUMS
```

Static inspection of the downloaded setup and portable executable confirmed FileVersion 1.2.1 and ProductName Discord Auto Quest. Both extracted icons were visually checked and displayed the custom blue badge. Both executables remain unsigned for Windows publisher identity; the separately verified updater signature does not replace publisher signing. Neither executable was launched during this verification.

No live acceptance, platform change, Work/Stop, reward action, installation, or Discord restart was performed for 1.2.1. Exact native installation/upgrade/uninstall, portable execution, clean WebView2 provisioning, live quest workflows and cancellation, completion notifications, signed update installation/failure recovery, and independent signing-key backup recovery remain unverified. Earlier versions' observations do not satisfy these gates. The five assets remain in an unpublished stable draft until the required exact-asset checks pass.

## 1.2.2 shared acceptance fix verification — 2026-10-25

The reported acceptance feedback had no expiry timer. Two new UI regressions failed before the fix: ordinary dismissal and a later acceptance receiving its own full lifetime. Both pass after the five-second cleanup was added. A third case verifies that uncertain acceptance errors remain visible with recovery controls. Dismissal does not move keyboard focus, and replacing feedback cancels the old timer.

The shared acceptance/selection validator rejected compatible client metadata, including end-date metadata on the reported offer. This prevented both in-app confirmation and Desktop-selection recovery. Read-only examination of the current client distinguished compatible metadata from features that change consent or task behavior. Compatibility uses semantic client values; no quest identifiers, names, or Orb amounts are matched. Unsupported features, additional consent, unknown schemas, and mixed rewards retain their existing boundary. A separate enrollment race returned early when acceptance arrived during review; confirmation now validates the unchanged review and finishes Desktop selection without reenrollment.

Eight new private cases reproduced failures before implementation. The complete private suite now passes 67 cases against readable source and separately against transformed encrypted content. Coverage includes supported video/Desktop offers, one or two console alternatives, differing metadata values, automatic Desktop selection, read-only review, already accepted selection recovery, enrollment during review, stale revisions, Console preservation, partial results, duplicate confirmations, progress, continuous Work, and cancellation. Public tests passed all 172 cases across 22 files. Production backend checks passed 52 unit cases; Clippy with warnings denied and Rust formatting passed. Three browser-starting integration tests remain ignored. The non-test validation guard must also pass in public Windows CI; a production-mode run does not exercise its rejection branch.

Type checking, frontend production build, version, terminology, notices, content-input and bundle acceptance checks passed. The changed-component design detector returned no findings. A production debug executable passed exact content identity and scans for original/transformed content and textual key encodings. The transformation reproduced the authenticated content digests with network and filesystem-write permissions denied. Dependency lockfile changes were verified to contain only project-version updates before renewing their notice-audit hashes. No dependency version changed. The derived code graph was refreshed.

Computer-use verification in an isolated browser fixture confirmed in-app review with Desktop intent, confirmation feedback appearing, its later disappearance, and an accepted Desktop card retaining valid 0%. It used synthetic responses and made no Discord calls. Separately, read-only comparison of the old and new operations against the existing live client changed one offer from unsupported to review and recovered one accepted quest's Desktop-selection capability; unknown activity flows remained unsupported. These are read-only capability observations, not independent live acceptance or selection results.

No live acceptance, platform change, Work/Stop, installation, reward action, or Discord restart was performed for 1.2.2. Exact packaged and native release checks remain pending and require execution-time authorization where specified. Preserve older tags/assets and keep any new candidate in draft until all required release gates pass.

## 1.2.2 exact draft artifact verification — 2026-10-25

[PR 48](https://github.com/edisonmalasan/discord-auto-quest/pull/48) merged at `595d5c55fd1e0a4c5ea8125f625638b57dab7de7` after final branch CI 40157640078 passed checks and Windows validation packaging. The immutable v1.2.2 tag points to that merge. The user authorized the protected production build and draft verification, excluding installation, account actions, and publication. After confirming the exact tag/commit and successful tag checks, the production-content environment was approved. [Production run 40158598227](https://github.com/edisonmalasan/discord-auto-quest/actions/runs/40158598227) passed checks, production backend tests, Clippy, packaging/signing, and draft creation. Linux remained excluded and macOS was skipped.

The five files were independently downloaded from the CI artifact and the [1.2.2 draft](https://github.com/edisonmalasan/discord-auto-quest/releases/tag/untagged-d70b44ace1cc34713958). All bytes matched. Asset names, updater signature and signed version, manifest HTTPS URLs, checksums, portable archive bounds/contents, and exact version-bound production identity passed verification. Both distributions were unpacked and scanned for original/transformed protected content, textual key encodings, private inputs, fixtures, source maps, and debug output; those leak checks passed. They do not establish resistance to reverse engineering.

```text
d81ade471a3511682123e07094627dc55d1e7f2c942511b91695c2d1f95923d6  Discord-Auto-Quest-1.2.2-windows-x64-portable.zip
68cace3a123c7e3152166b71e59b300f66c4a2326ad79f608e3fab2e4791f38a  Discord-Auto-Quest-1.2.2-windows-x64-setup.exe
7f52b2bd31ff584caff4b3d09eb5d64350e492f4a7bc494380e8324886abbfa3  Discord-Auto-Quest-1.2.2-windows-x64-setup.exe.sig
d389213c3ccaf3b2fccf1a22cb5a65a6a7c0b753305e4e2ef8a429fabab97070  latest.json
2fa5cfde4370dc49cbe369054013f5784623a49b8b0005f4595e3d789c10cae7  SHA256SUMS
```

Static inspection of the downloaded setup and portable executable confirmed FileVersion 1.2.2 and ProductName Discord Auto Quest. Both embedded icons were extracted and visually checked; each displayed the custom blue badge. Both executables remain unsigned for Windows publisher identity. The valid detached updater signature does not replace publisher signing. Neither executable was launched.

GitHub metadata confirmed a stable draft, not a prerelease, targeting the exact tag commit above. The release remains unpublished. Exact native installation/upgrade/uninstall, portable execution, clean WebView2 provisioning, live acceptance and automatic Desktop selection/recovery, continuous Work/cancellation, completion notifications, signed update installation/failure recovery, and independent signing-key backup recovery remain unverified. No live acceptance, platform change, Work/Stop, installation, reward claim, or Discord restart was performed under this approval. Earlier versions' observations and synthetic tests do not satisfy these native gates.
