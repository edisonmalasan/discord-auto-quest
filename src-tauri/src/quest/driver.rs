//! Driving Discord: preparing it, running the script, and putting it back.
//!
//! The quest script works by replacing two methods on the client's
//! running-games store and putting a fake game in it. That is the whole of
//! what makes Discord count a quest.
//!
//! Two things follow from that, and this module is about both.
//!
//! **The originals have to be kept.** The script restores them itself when the
//! quest finishes, but the application may need to stop before that — the user
//! closed it, or the quest was not the one they wanted. So the originals are
//! taken *before* the script runs, and putting them back is the application's
//! to do.
//!
//! **The script is not the application's only dependency.** The script finds
//! Discord's internals by the names of minified exports, and those names move
//! between Discord versions. The application reads the quest state by shape
//! instead (see [`super::reader`]), so it can still tell the user what is
//! available and what is running when the script has stopped working. What it
//! must never do is go quiet.

use crate::error::AppResult;
use crate::quest::cdp::Session;
use crate::quest::payload;

/// The expression that takes the originals and keeps them.
///
/// It runs before the script, so that the application can put things back
/// however the script ends.
const PREPARE: &str = r#"(function () {
  try {
    const wpRequire = webpackChunkdiscord_app.push([[Symbol()], {}, function (r) { return r; }]);
    webpackChunkdiscord_app.pop();
    const modules = Object.values(wpRequire.c);

    const hasAccessor = function (candidate, method) {
      try {
        if (typeof candidate[method] === 'function') return true;
        const proto = Object.getPrototypeOf(candidate);
        if (proto && typeof proto[method] === 'function') return true;
        if (candidate.prototype && typeof candidate.prototype[method] === 'function') return true;
      } catch (error) { /* not this one */ }
      return false;
    };

    for (const module of modules) {
      const exports = module && module.exports;
      if (!exports) continue;
      let keys;
      try { keys = Object.keys(exports); } catch (error) { continue; }
      for (const key of keys) {
        let candidate;
        try { candidate = exports[key]; } catch (error) { continue; }
        if (!candidate) continue;
        try {
          if (!hasAccessor(candidate, 'getRunningGames')) continue;
          if (typeof candidate.getGameForPID !== 'function') continue;

          // Only once, and only if nothing has been kept before.
          if (!window.__daq) {
            window.__daq = {
              getRunningGames: candidate.getRunningGames,
              getGameForPID: candidate.getGameForPID,
              store: candidate,
            };
          }
          return true;
        } catch (error) { /* not this one */ }
      }
    }
  } catch (error) {
    /* the application will notice, because the script will not work */
  }
  return false;
})()"#;

/// The expression that puts the originals back.
const RESTORE: &str = r#"(function () {
  const kept = window.__daq;
  if (!kept) return false;

  try {
    kept.store.getRunningGames = kept.getRunningGames;
    kept.store.getGameForPID = kept.getGameForPID;
  } catch (error) {
    /* the store is gone; there is nothing to put back */
  }

  window.__daq = null;
  return true;
})()"#;

/// Take the originals, and run the quest script.
///
/// The script is the payload, decrypted in memory. It is never written to disk.
///
/// **The script is run inside a function.** It declares `let wpRequire` at the
/// top level, and a top-level `let` in a renderer survives the script — so
/// running it a second time in the same client fails with *"Identifier
/// 'wpRequire' has already been declared"*. Wrapping it puts its declarations
/// in a scope of their own, and the script can be run as many times as the
/// user works quests. That was found by running it twice, which is the only
/// way to find it.
pub async fn run(session: &mut Session) -> AppResult<()> {
    session.evaluate(PREPARE).await?;

    let script = payload::script()?;
    session
        .evaluate(&format!("(function () {{\n{script}\n}})()"))
        .await?;

    Ok(())
}

/// Put Discord's own methods back.
///
/// This is what the application does when it stops, so that a spoofed game does
/// not outlive the application.
pub async fn stop(session: &mut Session) -> AppResult<()> {
    session.evaluate(RESTORE).await?;

    Ok(())
}

/// Whether the script attached.
///
/// The script says so by printing, and the application watches for that. This
/// is the blunt version: it looks for a game in the running-games list that
/// the client could not have known about.
pub async fn is_spoofing(session: &mut Session) -> AppResult<bool> {
    let value = session
        .evaluate(
            r#"(function () {
              try {
                const kept = window.__daq;
                if (!kept) return false;
                const games = kept.getRunningGames();
                return Array.isArray(games) && games.length > 0;
              } catch (error) {
                return false;
              }
            })()"#,
        )
        .await?;

    Ok(value.as_bool().unwrap_or(false))
}

/// Whether Discord is the desktop application, which the script needs.
pub async fn is_desktop_app(session: &mut Session) -> AppResult<bool> {
    let value = session
        .evaluate(r#"(function () { return typeof DiscordNative !== 'undefined'; })()"#)
        .await?;

    Ok(value.as_bool().unwrap_or(false))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_prepare_expression_keeps_the_originals() {
        assert!(
            PREPARE.contains("__daq"),
            "the originals have to be kept somewhere the restore can find them"
        );
        assert!(
            PREPARE.contains("getRunningGames") && PREPARE.contains("getGameForPID"),
            "both of the methods the script replaces have to be kept"
        );
    }

    #[test]
    fn the_restore_expression_puts_them_back() {
        assert!(
            RESTORE.contains("kept.store.getRunningGames = kept.getRunningGames"),
            "the original method has to be put back"
        );
        assert!(
            RESTORE.contains("kept.store.getGameForPID = kept.getGameForPID"),
            "both of them"
        );
    }
}
