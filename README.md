# Discord Auto Quest

A desktop utility for viewing and working Discord quests you have already accepted.

**Release version: 1.0.1.** Windows 10/11 x64 and the stable Discord desktop client are the initial target. Download availability and publication status are shown in GitHub Releases. Linux and macOS builds are development checks, not supported downloads.

## Download and install

Download from [GitHub Releases](https://github.com/edisonmalasan/discord-auto-quest/releases). Select the Windows x64 release. Publication status is shown on the release page; drafts are not public downloads.

- **Setup EXE:** installs for the current user and provisions Microsoft WebView2 if needed. Internet access is required for that provisioning.
- **Portable ZIP:** extract the entire folder and open Discord Auto Quest. Microsoft Edge WebView2 Runtime must already be installed.

Windows builds are unsigned. Windows may display an unknown-publisher warning. Verify the source of your download and follow your organization's security policies; do not disable security protections. SHA-256 checksums detect changed downloads but do not authenticate the publisher.

## Use

1. Open the stable Discord desktop client and sign in there.
2. Open Discord Auto Quest. If it requests a Discord restart, review the interruption warning and choose whether to restart.
3. Browse Available quests and choose **Accept quest**. Review the current requirements, then confirm acceptance. Unsupported offers use **Open in Discord** instead. Acceptance does not start Work or video playback.
4. Return to Ongoing and choose **Work my quests**. Percentages refresh from Discord about every four seconds, including during Work. Progress moves when Discord provides an update; completion requires Discord's confirmation.
5. Use **Stop** to request cleanup. An unconfirmed operation remains visible and may require reconnecting and retrying Stop.
6. Claim rewards yourself in Discord. Completed and reward-claimed are distinct states.

The app never accepts quests automatically, claims rewards, or restarts Discord automatically. Restarting Discord interrupts calls and other Discord activity.

## Supported behavior and limitations

- Quest availability and eligibility depend on Discord and the publisher. Some tasks still require user participation, such as sharing in a voice channel.
- One accepted video quest completed in Windows beta testing. A fresh accept-to-completion cycle and broader quest coverage remain unverified; do not assume every quest type works.
- In-app acceptance initially supports standard Orbs offers for desktop play and video tasks. Special features, console/activity tasks, and unfamiliar offer configurations require Discord. One desktop-play offer was accepted successfully through the packaged Windows app; other acceptance flows remain unverified.
- If acceptance cannot be confirmed, refresh or check Discord before trying again. The app does not automatically retry.
- Claim, reward, and fallback controls open Discord's Quests page and identify the quest to select.
- Discord updates can interrupt compatibility. Stale data and operation failures are shown explicitly.
- Stop and connection timeouts do not guarantee cancellation of every activity already started in Discord.
- Stable Discord installations are the supported target. PTB, Canary, Store-specific layouts, Windows ARM64, and 32-bit Windows are unverified.

This is an independent project, not affiliated with or endorsed by Discord. Automated quest completion may conflict with Discord or publisher rules; no account-safety guarantee is made.

## Troubleshooting

- **No quests:** confirm the Discord desktop client is open, wait for it to finish loading, and use Retry. Accept quests in Discord first.
- **Restart needed:** the app requires a local connection to Discord. Restart only when interrupting your Discord activity is acceptable.
- **Connection lost:** retained cards are marked stale. Retry after Discord finishes starting; do not repeatedly launch Work after an uncertain result.
- **Portable app does not open:** verify Windows x64 and Microsoft WebView2 Runtime are installed.
- **Report a problem:** use the [issue tracker](https://github.com/edisonmalasan/discord-auto-quest/issues) with app version, Windows version, and reproduction steps. Do not include tokens, private messages, account identifiers, or unredacted diagnostics.

## Development

Requires Node.js 22+, Rust stable, and Tauri's Windows prerequisites, including the MSVC C++ build tools and WebView2.

```text
npm ci
npm run tauri dev
npm test
npm run typecheck
npm run build
cargo test --manifest-path src-tauri/Cargo.toml
```

See CONTRIBUTING.md for checks and RELEASE.md for release preparation. No automatic updater is included; install a newer release manually.

## Versioning and license

We follow [Semantic Versioning](https://semver.org/): breaking compatibility changes increment Major; compatible features increment Minor; compatible fixes increment Patch. Minor and Patch reset when a higher component increments. Starting with 1.0.0, documented user workflows and supported requirements form the compatibility contract. Backward-compatible Discord compatibility fixes can be patch releases. Preview revisions increment their beta or RC number. Published versions and tags are never replaced.

MIT licensed; see LICENSE, NOTICE, and THIRD_PARTY_NOTICES.txt. Security reports: edisonmacaraegmalasan@gmail.com.
