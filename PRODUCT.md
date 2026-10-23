# Product

Discord Auto Quest is a desktop utility for viewing and working quests the user has accepted in their own Discord desktop client.

## Supported release target

The first public beta targets Windows 10/11 x64 and stable Discord. Linux and macOS compilation does not establish working client integration. A current-user installer and portable archive are supported distribution formats.

## Principles and boundaries

- Discord is the authority for availability, progress, completion, and reward state.
- Quest data is read at runtime and never bundled as a production catalogue or persisted as an account cache.
- Accepting a quest and claiming its reward remain the user's actions in Discord.
- Restarting Discord requires the user's deliberate request and an interruption warning.
- Work applies only to already accepted quests. Uncertainty must remain visible, with recovery controls available.
- Only the user's own Discord desktop client is controlled. No unrelated process is modified.
- Local connectivity must remain restricted to loopback. No Discord RPC Rich Presence integration is included.
- Sensitive runtime content is kept in memory and must not be recoverable as readable content from shipped artifacts. Existing asset checks must remain effective.
- The reader locates compatible client records by shape so renamed exports do not silently erase the quest list.
- The app carries an original identity and an independent-project disclaimer.

## Non-goals

Automatic acceptance, reward claims, unattended restarts, account login collection, a bundled catalogue, browser-client support, and an automatic updater are excluded. Internal maintenance references belong only in ignored re/.

See docs/ROADMAP.md for verified outcomes and remaining work.
