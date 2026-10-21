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

use crate::error::{AppError, AppResult};
use crate::quest::cdp::Session;
use crate::quest::payload;

/// The expression that takes the originals and keeps them.
///
/// It runs before the script, so that the application can put things back
/// however the script ends.
///
/// **The store has to be the one the script will use.** The driver and the
/// script have to agree on which object to touch, or "stop" restores the wrong
/// thing and the spoof outlives the application. So the driver finds the store
/// the way the script finds it — by the export the script names — and then
/// checks that it *is* the store by what it does.
///
/// The check matters, because Discord ships an internationalisation proxy that
/// answers **every** property name with a function. A candidate that merely has
/// something called `getRunningGames` can be that proxy, and keeping the
/// proxy's originals means the restore writes to the proxy while the real store
/// keeps the fake game.
const PREPARE: &str = r#"(function () {
  try {
    const wpRequire = webpackChunkdiscord_app.push([[Symbol()], {}, function (r) { return r; }]);
    webpackChunkdiscord_app.pop();
    const modules = Object.values(wpRequire.c);

    // Is this the store that holds the running games?
    const isTheStore = function (candidate) {
      try {
        if (typeof candidate.getRunningGames !== 'function') return false;
        if (typeof candidate.getGameForPID !== 'function') return false;
        return Array.isArray(candidate.getRunningGames());
      } catch (error) {
        return false;
      }
    };

    // The export the script names, first, because that is the object the
    // script will replace the methods on.
    for (const module of modules) {
      const exports = module && module.exports;
      if (!exports) continue;
      let candidate;
      try { candidate = exports.Ay; } catch (error) { continue; }
      if (!candidate || !isTheStore(candidate)) continue;

      window.__daq = {
        getRunningGames: candidate.getRunningGames,
        getGameForPID: candidate.getGameForPID,
        store: candidate,
      };
      return true;
    }

    // The slow way, for a Discord that has renamed the export: look at
    // everything every module exports, and take the first that behaves like
    // the store. Globals are not stores — the internationalisation proxy is
    // reachable as one, and it answers every property name with a function.
    for (const module of modules) {
      const exports = module && module.exports;
      if (!exports) continue;
      let keys;
      try { keys = Object.keys(exports); } catch (error) { continue; }
      for (const key of keys) {
        let candidate;
        try { candidate = exports[key]; } catch (error) { continue; }
        if (!candidate) continue;
        if (candidate === window) continue;
        if (window.__daq && candidate === window.__daq.store) continue;
        if (!isTheStore(candidate)) continue;

        // Only once, and only if nothing has been kept before.
        if (!window.__daq) {
          window.__daq = {
            getRunningGames: candidate.getRunningGames,
            getGameForPID: candidate.getGameForPID,
            store: candidate,
          };
        }
        return true;
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

/// The expression that says whether the script attached.
///
/// It asks whether the store's own method is still the one the application
/// kept. If it is not, the script found the store and replaced it — and if it
/// is, the script never attached, and the application has to say so rather
/// than pretend the quest is counting.
const IS_SPOOFING: &str = r#"(function () {
  try {
    const kept = window.__daq;
    if (!kept || !kept.store) return false;
    return kept.store.getRunningGames !== kept.getRunningGames;
  } catch (error) {
    return false;
  }
})()"#;

/// The message a raised script gets.
///
/// A script that raises did not attach, and "the script raised an error" is
/// not something a user can act on. This says what happened and what to do
/// about it.
fn did_not_attach(cause: &AppError) -> AppError {
    AppError::not_supported(format!(
        "The quest script did not attach to Discord. Discord has probably moved its internals, \
         and the script needs updating. ({cause})"
    ))
}

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
///
/// **A script that raises did not attach.** The script finds Discord's
/// internals by the names of minified exports, and it reads them without
/// checking: if Discord renames one, the script raises, and a raised script
/// has done nothing.
pub async fn run(session: &mut Session) -> AppResult<()> {
    session.evaluate(PREPARE).await?;

    let script = payload::script()?;
    session
        .evaluate(&format!("(function () {{\n{script}\n}})()"))
        .await
        .map_err(|error| did_not_attach(&error))?;

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

/// Whether the game is spoofed.
///
/// **This is the desktop route only.** A video quest is completed by posting to
/// Discord's own endpoint, an activity quest by its heartbeat, and a stream
/// quest by replacing a different store's method — none of which touch the
/// running-games store. So this answers "is a game being faked right now", and
/// nothing more: it is false on a quest that is being worked perfectly, and
/// false when there was nothing to work on.
///
/// The application's own answer to "did the script fail" is not this. It is
/// whether the script raised: a script that raises did not attach, and that is
/// reported as an error.
pub async fn is_spoofing(session: &mut Session) -> AppResult<bool> {
    let value = session.evaluate(IS_SPOOFING).await?;

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
    fn the_prepare_expression_asks_the_store_for_its_games() {
        // Discord's internationalisation proxy answers every property name
        // with a function, so a check on the name alone finds the wrong
        // object. The check has to be on what the object does.
        assert!(
            PREPARE.contains("Array.isArray(candidate.getRunningGames())"),
            "the store has to be recognised by what it returns"
        );
    }

    #[test]
    fn the_prepare_expression_looks_for_the_export_the_script_names() {
        // The driver and the script have to agree on which object to touch,
        // or "stop" restores the wrong one.
        assert!(
            PREPARE.contains("exports.Ay"),
            "the store the script replaces has to be the store the driver keeps"
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

    #[test]
    fn the_spoof_check_asks_whether_the_method_was_replaced() {
        assert!(
            IS_SPOOFING.contains("kept.store.getRunningGames !== kept.getRunningGames"),
            "the check has to be on the store's own method, not on the one kept"
        );
    }
}
