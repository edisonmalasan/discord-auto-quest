<p align="center">
  <img src="https://raw.githubusercontent.com/edisonmalasan/discord-auto-quest/main/public/quest-badge.svg" alt="Discord Auto Quest logo" width="80" height="80">
</p>

# Discord Auto Quest

A Windows desktop app for browsing, accepting, and working Discord quests from one workspace.

[Download latest release](https://github.com/edisonmalasan/discord-auto-quest/releases/latest) · [Release history](https://github.com/edisonmalasan/discord-auto-quest/releases) · [Report a problem](https://github.com/edisonmalasan/discord-auto-quest/issues/new/choose) · [Contribute](https://github.com/edisonmalasan/discord-auto-quest/blob/main/CONTRIBUTING.md)

Keep track of Ongoing, Available, and Completed quests, review supported offers before accepting them, and follow progress reported by your Discord desktop client. Reward claims stay in Discord.

## Downloads

Get the app from [GitHub Releases](https://github.com/edisonmalasan/discord-auto-quest/releases/latest). Open **Assets** and choose a Windows x64 download:

| Download | Choose this when… |
| --- | --- |
| `Discord-Auto-Quest-<version>-windows-x64-setup.exe` | You want a current-user installation and Start-menu shortcut. Setup provisions Microsoft WebView2 if needed. |
| `Discord-Auto-Quest-<version>-windows-x64-portable.zip` | You want to run the app from an extracted folder. Microsoft Edge WebView2 Runtime must already be installed. |
| `SHA256SUMS` | You want to compare a download's SHA-256 checksum with the value supplied for that release. |

GitHub's **Source code** archives contain the project source, not the ready-to-run app.

Windows builds are **unsigned**. Windows may display an unknown-publisher warning. Verify where you downloaded the app and follow your organization's security policies; do not disable security protections. Checksums detect changed or incomplete downloads but do not authenticate the publisher.

## Features

| Feature | What it does |
| --- | --- |
| Quest workspace | Switch between Ongoing, Available, and Completed quests, with search to find a quest. |
| In-app acceptance | Review and confirm one supported offer at a time. Acceptance never starts Work or video playback. |
| Work and Stop | Start Work on accepted quests and request cleanup with Stop. |
| Progress updates | Refresh percentages from Discord about every four seconds, including during Work. Completion requires Discord's confirmation. |
| Connection recovery | Show connection errors, mark retained cards as stale, and offer Retry when Discord is ready. |
| Discord handoffs | Open Discord for unsupported acceptance flows and reward claims. |

Quest availability, eligibility, and progress come from Discord. Some tasks still require your participation; support varies by quest type. See [known limitations](#known-limitations) before using Work.

## Requirements

- Windows 10 or 11, **x64**.
- The **stable Discord desktop client**, with your account already signed in there.
- Microsoft Edge WebView2 Runtime. Setup can provision it with an internet connection; the portable app requires it beforehand.

Linux is not supported and has no build job. macOS support is deferred and its optional compilation job is paused. Neither platform has a supported download. Windows ARM64, 32-bit Windows, Discord PTB/Canary, and Store-specific installation layouts are unverified.

## Installation

### Setup EXE

1. Download the `windows-x64-setup.exe` asset from the [latest release](https://github.com/edisonmalasan/discord-auto-quest/releases/latest).
2. Run setup and follow the installer. It installs for the current Windows user.
3. Allow WebView2 provisioning to finish if it is needed; this requires internet access.
4. Open **Discord Auto Quest** from the Start menu.

### Portable ZIP

1. Make sure Microsoft Edge WebView2 Runtime is installed.
2. Download the `windows-x64-portable.zip` asset.
3. Extract **all files** into a folder. Do not run the app from inside the archive.
4. Open Discord Auto Quest from the extracted folder.

### Updating

There is no automatic updater. Download the newer release and run its setup to update an installed copy. For portable use, extract the new release into a separate folder and launch that copy. Check the release notes for changes and known issues.

### Checking a download

Download `SHA256SUMS` from the **same release** as your EXE or ZIP. In PowerShell, run the following with your downloaded file's path:

```powershell
Get-FileHash "C:\path\to\downloaded-file.exe" -Algorithm SHA256
```

Compare the result with the entry for that exact filename in `SHA256SUMS`. Letter case does not matter. If the values differ, do not use that file; download it again from the release page. A matching checksum confirms the file matches the supplied checksum, not who published it.

## Usage

1. Open the stable Discord desktop client and sign in there.
2. Open Discord Auto Quest. If it requests a Discord restart, review the interruption warning and choose whether to restart.
3. Browse Available quests and choose **Accept quest**. Review the current requirements, then confirm acceptance. Unsupported offers use **Open in Discord** instead. Acceptance does not start Work or video playback.
4. Return to Ongoing and choose **Work my quests**. Percentages refresh from Discord about every four seconds, including during Work. Progress moves when Discord provides an update; completion requires Discord's confirmation.
5. Use **Stop** to request cleanup. An unconfirmed operation remains visible and may require reconnecting and retrying Stop.
6. Claim rewards yourself in Discord. Completed and reward-claimed are distinct states.

The app never accepts quests automatically, claims rewards, or restarts Discord automatically. Restarting Discord interrupts calls and other Discord activity.

## Known limitations

- Quest availability and eligibility depend on Discord and the publisher. Some tasks still require user participation, such as sharing in a voice channel.
- One accepted video quest completed in Windows beta testing. A fresh accept-to-completion cycle and broader quest coverage remain unverified; do not assume every quest type works.
- In-app acceptance initially supports standard Orbs offers for desktop play and video tasks. Special features, console/activity tasks, and unfamiliar offer configurations require Discord. One desktop-play offer was accepted successfully through the packaged Windows app; other acceptance flows remain unverified.
- If acceptance cannot be confirmed, refresh or check Discord before trying again. The app does not automatically retry.
- Claim, reward, and fallback controls open Discord's Quests page and identify the quest to select.
- Discord updates can interrupt compatibility. Stale data and operation failures are shown explicitly.
- Stop and connection timeouts do not guarantee cancellation of every activity already started in Discord.

For the verification record and outstanding release checks, see [release checks](https://github.com/edisonmalasan/discord-auto-quest/blob/main/docs/RELEASE_CHECKS.md). A stable version number does not establish that every installation path or quest type has been tested.

## Troubleshooting

| Problem | What to try |
| --- | --- |
| No quests appear | Confirm the Discord desktop client is open and has finished loading, then choose Retry. Check Discord for offers available to your account. |
| No ongoing quests | Accept a supported offer from Available, or accept it in Discord, then refresh. Work requires an already accepted quest. |
| A Discord restart is requested | Restart only when interrupting your Discord activity is acceptable. The app needs a local connection to the desktop client. |
| Connection lost or cards marked stale | Wait for Discord to finish starting, then Retry. Avoid repeatedly starting Work after an uncertain result. |
| A percentage has not changed | Allow the next refresh and check Discord. The app shows progress Discord reports; stale cards indicate the connection needs recovery. |
| The portable app does not open | Confirm Windows x64 and Microsoft Edge WebView2 Runtime are installed, and extract the full archive before launching. |

Still stuck? [Open an issue](https://github.com/edisonmalasan/discord-auto-quest/issues/new/choose) with the app version, Windows version, and steps to reproduce the problem. Do not include tokens, private messages, account identifiers, or unredacted diagnostics.

## Development

Requires Node.js 22+, Rust stable, and Tauri's Windows prerequisites, including the MSVC C++ build tools and WebView2.

```text
npm ci
npm run tauri dev
```

To run the frontend checks and backend tests:

```text
npm test
npm run typecheck
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
```

See [Contributing](https://github.com/edisonmalasan/discord-auto-quest/blob/main/CONTRIBUTING.md) for the complete checks and contribution workflow.

## Documentation

| Guide | Contents |
| --- | --- |
| [Changelog](https://github.com/edisonmalasan/discord-auto-quest/blob/main/CHANGELOG.md) | Changes recorded for each version. |
| [Release guide](https://github.com/edisonmalasan/discord-auto-quest/blob/main/RELEASE.md) | Versioning, packaging, GitHub drafts, verification, and publication. |
| [Release checks](https://github.com/edisonmalasan/discord-auto-quest/blob/main/docs/RELEASE_CHECKS.md) | Verification evidence, limitations, and remaining checks. |
| [Roadmap](https://github.com/edisonmalasan/discord-auto-quest/blob/main/docs/ROADMAP.md) | Verified progress and deferred work. |
| [Product requirements](https://github.com/edisonmalasan/discord-auto-quest/blob/main/PRODUCT.md) | Product behavior, constraints, and non-goals. |
| [Design](https://github.com/edisonmalasan/discord-auto-quest/blob/main/DESIGN.md) | The app's visual and interaction decisions. |

We follow [Semantic Versioning](https://semver.org/): breaking compatibility changes increment Major; compatible features increment Minor; compatible fixes increment Patch. Minor and Patch reset when a higher component increments. Starting with 1.0.0, documented user workflows and supported requirements form the compatibility contract. Backward-compatible Discord compatibility fixes can be patch releases. Preview revisions increment their beta or RC number. Published versions and tags are never replaced.

## Contributing and community

Bug reports and focused contributions are welcome. Read [Contributing](https://github.com/edisonmalasan/discord-auto-quest/blob/main/CONTRIBUTING.md) before opening a pull request and follow the [Code of Conduct](https://github.com/edisonmalasan/discord-auto-quest/blob/main/CODE_OF_CONDUCT.md).

Report security concerns privately using [Security](https://github.com/edisonmalasan/discord-auto-quest/blob/main/SECURITY.md). The private contact for security and conduct reports is **edisonmacaraegmalasan@gmail.com**.

## Disclaimer

Discord Auto Quest is an independent project, not affiliated with, endorsed by, or connected to Discord. Automated quest completion may conflict with Discord or publisher rules; no account-safety guarantee is made.

## License

Licensed under the [MIT License](LICENSE). Required attribution and dependency notices are in [NOTICE](NOTICE) and [THIRD_PARTY_NOTICES.txt](THIRD_PARTY_NOTICES.txt), and are included in both Windows distributions.
