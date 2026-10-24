# Product

Discord Auto Quest is a desktop utility for viewing and working quests the user has accepted in their own Discord desktop client.

## Supported release target

The 1.1 release line targets Windows 10/11 x64 and stable Discord. Linux and macOS compilation does not establish working client integration. A current-user installer and portable archive are supported distribution formats.

## Principles and boundaries

- Discord is the authority for availability, progress, completion, and reward state.
- Quest data is read at runtime and never bundled as a production catalogue or persisted as an account cache.
- A user may deliberately review and confirm acceptance of supported offers in this app. Unknown or special flows continue in Discord. Acceptance while Work is stopped never starts playback or an activity. While the user has explicitly enabled continuous Work, confirmed supported acceptances join its queue; the confirmation explains this.
- Reward claims remain the user's actions in Discord.
- Restarting Discord requires the user's deliberate request and an interruption warning.
- Work applies only to accepted quests. It is explicitly enabled, processes eligible quests sequentially, and waits for newly accepted quests until Stop. It never resumes automatically after app launch or an uncertain disconnect.
- Stop cancels owned activity and confirms cleanup before another run, update installation, or normal exit. Uncertainty remains visible and blocks dispatch; progress already reported cannot be undone.
- Completion feedback follows Discord confirmation, with optional Windows notifications for installed copies. Only notification preferences are persisted.
- Installed copies can check for stable updates and install a signed update after explicit confirmation and confirmed Work cleanup. Portable copies receive download links.
- Only the user's own Discord desktop client is controlled. No unrelated process is modified.
- Local connectivity must remain restricted to loopback. No Discord RPC Rich Presence integration is included.
- Sensitive runtime content ships encrypted and is decrypted only in memory. Existing artifact checks must reject its plaintext markers. This does not guarantee secrecy against determined reverse engineering.
- The reader locates compatible client records by shape so renamed exports do not silently erase the quest list.
- The app carries an original identity and an independent-project disclaimer.

## Non-goals

Automatic acceptance, reward claims, unattended restarts, account login collection, a bundled catalogue, browser-client support, unattended update installation, and portable in-place updating are excluded. Internal maintenance references belong only in ignored re/.

See docs/ROADMAP.md for verified outcomes and remaining work.
