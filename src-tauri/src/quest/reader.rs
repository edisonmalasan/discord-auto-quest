//! Reading Discord's quest state.
//!
//! The application shows the user two lists: the quests that are **available** —
//! offered, not yet accepted, and not expired — and the quests they have
//! **claimed**, with how far along each one is.
//!
//! Both come out of Discord's own quest store, read in its own renderer. The
//! quest script does the same thing, but it is the script's own business: it
//! works a quest and says so. This is the application's business, and it has
//! to keep working when the script does not — so the store is found by *shape*
//! rather than by the name of a minified export, with the names as the fast
//! path.
//!
//! **Why that matters.** The script finds Discord's internals by guessing at
//! export names, and those names move between Discord versions. When they
//! move, the script stops attaching and the quest stops working. This reader
//! keeps working through that, so the application can still show what is
//! available and say plainly that the script needs updating. That difference
//! is the difference between "nothing happened" and a sentence.
//!
//! **What this is not.** Reading Discord's state is reading it. Nothing here
//! accepts a quest, and nothing here changes anything in Discord.

use serde::{Deserialize, Serialize};

use crate::error::{AppError, AppResult};

/// How a quest stands.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum QuestState {
    /// Offered, not accepted, and not expired.
    Available,
    /// Accepted, and not finished.
    Claimed,
    /// Accepted, and finished.
    Completed,
}

/// One quest, as Discord describes it.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestSummary {
    /// Discord's identifier for it.
    pub id: String,
    /// The name to show.
    pub name: String,
    /// What has to be done: `PLAY_ON_DESKTOP`, `WATCH_VIDEO`, and so on.
    pub tasks: Vec<String>,
    /// When it stops being available.
    pub expires_at: Option<String>,
    /// Which state it is in.
    pub state: QuestState,
    /// How many seconds it has counted, for the tasks that count seconds.
    pub progress_seconds: u64,
    /// How many seconds it needs.
    pub target_seconds: u64,
    /// The reward, in orbs, if it has one.
    pub reward_orbs: Option<u64>,
}

impl QuestSummary {
    /// Whether the quest is counting, or has finished counting.
    pub fn is_running(&self) -> bool {
        self.state == QuestState::Claimed && self.progress_seconds < self.target_seconds
    }
}

/// Everything the application needs to know about Discord's quests.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestList {
    /// The quests that are on offer and have not expired.
    pub available: Vec<QuestSummary>,
    /// The quests the user has accepted, finished or not.
    pub claimed: Vec<QuestSummary>,
    /// How many quests have expired and were never accepted.
    pub expired: usize,
    /// Whether the client is the desktop application.
    ///
    /// The quest script only works there, so the interface has to say so rather
    /// than offer a button that cannot work.
    pub desktop_app: bool,
    /// The games the client believes are running.
    pub running_games: Vec<RunningGame>,
}

/// A game the client believes is running.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunningGame {
    pub id: String,
    pub name: String,
    pub exe_name: Option<String>,
    pub pid: Option<u32>,
}

/// The expression that reads the state.
///
/// It is run in Discord's renderer and returns an object. The two ways of
/// finding the quest store are tried in turn: the export names first, because
/// they are quick, and the shape second, because they survive a rename.
const READ_STATE: &str = r#"(function () {
  const report = { available: [], claimed: [], expired: 0, desktop_app: false, running_games: [] };

  try {
    const wpRequire = webpackChunkdiscord_app.push([[Symbol()], {}, function (r) { return r; }]);
    webpackChunkdiscord_app.pop();
    const modules = Object.values(wpRequire.c);

    // Find the store that holds a given collection.
    //
    // Discord's stores are *instances*: the accessor lives on the instance's
    // prototype, and the collection lives on the instance. So the prototype is
    // looked for in all three places it can be — the object itself, its
    // prototype, and the prototype property of a class — and the collection is
    // what tells the right one apart from the thousands of others.
    const hasAccessor = function (candidate, method) {
      try {
        if (typeof candidate[method] === 'function') return true;

        const proto = Object.getPrototypeOf(candidate);
        if (proto && typeof proto[method] === 'function') return true;

        if (candidate.prototype && typeof candidate.prototype[method] === 'function') return true;
      } catch (error) { /* not this one */ }
      return false;
    };

    const findStore = function (method, isTheRightOne, names) {
      // The fast way: the export names the quest script uses. They are quick,
      // and they are right until Discord renames something.
      for (const name of names) {
        for (const module of modules) {
          const exports = module && module.exports;
          if (!exports) continue;
          let candidate;
          try { candidate = exports[name]; } catch (error) { continue; }
          if (!candidate) continue;
          try {
            if (!hasAccessor(candidate, method)) continue;
            if (!isTheRightOne(candidate)) continue;
            return candidate;
          } catch (error) { /* not this one */ }
        }
      }

      // The slow way, and the one that survives a rename: look at everything
      // every module exports.
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
            if (!hasAccessor(candidate, method)) continue;
            if (!isTheRightOne(candidate)) continue;
            return candidate;
          } catch (error) { /* not this one */ }
        }
      }

      return null;
    };

    // The quest store is the one whose collection is a map of quests, and the
    // running-games store is the one that can look a game up by its process
    // id. Either test is enough on its own; together they are certain.
    const questStore = findStore(
      'getQuest',
      function (candidate) { return candidate.quests instanceof Map; },
      ['A'],
    );

    const gameStore = findStore(
      'getRunningGames',
      function (candidate) { return typeof candidate.getGameForPID === 'function'; },
      ['Ay'],
    );

    if (!questStore) {
      report.error = 'the quest store could not be found in this version of Discord';
      return report;
    }

    const quests = questStore.quests instanceof Map
      ? Array.from(questStore.quests.values())
      : (Array.isArray(questStore.quests) ? questStore.quests : []);

    const now = Date.now();
    const expired = function (quest) {
      return !!(quest.config && quest.config.expiresAt &&
        new Date(quest.config.expiresAt).getTime() < now);
    };

    const summarise = function (quest) {
      const config = quest.config || {};
      const tasks = config.taskConfigV2 && config.taskConfigV2.tasks
        ? config.taskConfigV2.tasks
        : (config.taskConfig && config.taskConfig.tasks ? config.taskConfig.tasks : {});

      const taskNames = Object.keys(tasks);

      let progress = 0;
      let target = 0;
      for (const name of taskNames) {
        const task = tasks[name] || {};
        if (typeof task.target === 'number') target = Math.max(target, task.target);
        const value = quest.userStatus && quest.userStatus.progress && quest.userStatus.progress[name];
        const seconds = value && typeof value.value === 'number' ? value.value : 0;
        progress = Math.max(progress, seconds);
      }

      const rewards = config.rewardsConfig && config.rewardsConfig.rewards
        ? config.rewardsConfig.rewards : [];

      return {
        id: quest.id,
        name: (config.messages && config.messages.questName) || quest.id,
        tasks: taskNames,
        expires_at: config.expiresAt || null,
        state: quest.userStatus && quest.userStatus.completedAt
          ? 'completed'
          : (quest.userStatus && quest.userStatus.enrolledAt ? 'claimed' : 'available'),
        progress_seconds: progress,
        target_seconds: target,
        reward_orbs: rewards.length ? (rewards[0].orbQuantity || null) : null,
      };
    };

    for (const quest of quests) {
      const summary = summarise(quest);
      if (summary.state === 'claimed' || summary.state === 'completed') {
        report.claimed.push(summary);
      } else if (expired(quest)) {
        report.expired += 1;
      } else {
        report.available.push(summary);
      }
    }

    if (gameStore) {
      try {
        const games = gameStore.getRunningGames() || [];
        for (const game of games) {
          report.running_games.push({
            id: String(game.id),
            name: game.name,
            exe_name: game.exeName || null,
            pid: typeof game.pid === 'number' ? game.pid : null,
          });
        }
      } catch (error) { /* the store is not readable right now */ }
    }

    report.desktop_app = typeof DiscordNative !== 'undefined';
  } catch (error) {
    report.error = String(error);
  }

  return report;
})()"#;

/// Read the quest state out of Discord.
pub async fn read_state(session: &mut crate::quest::cdp::Session) -> AppResult<QuestList> {
    let value = session.evaluate(READ_STATE).await?;

    if let Some(error) = value.get("error").and_then(|error| error.as_str()) {
        return Err(AppError::invalid_payload(format!(
            "Discord's quest state could not be read: {error}"
        )));
    }

    let list: QuestList = serde_json::from_value(value).map_err(|error| {
        AppError::invalid_payload(format!(
            "Discord's quest state was not in a shape we understand: {error}"
        ))
    })?;

    Ok(list)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_quest_read_from_discord_is_understood() {
        let value = serde_json::json!({
            "available": [{
                "id": "1",
                "name": "Deadzone Rogue 2",
                "tasks": ["PLAY_ON_DESKTOP"],
                "expiresAt": "2026-10-23T00:00:00+00:00",
                "state": "available",
                "progressSeconds": 0,
                "targetSeconds": 900,
                "rewardOrbs": 700,
            }],
            "claimed": [],
            "expired": 64,
            "desktopApp": true,
            "runningGames": [],
        });

        let list: QuestList = serde_json::from_value(value).expect("the list is understood");

        assert_eq!(list.available.len(), 1);
        assert_eq!(list.expired, 64);
        assert!(list.desktop_app);

        let quest = &list.available[0];
        assert_eq!(quest.state, QuestState::Available);
        assert_eq!(quest.target_seconds, 900);
        assert_eq!(quest.reward_orbs, Some(700));
        assert!(!quest.is_running(), "an available quest is not running");
    }

    #[test]
    fn a_claimed_quest_that_is_counting_is_running() {
        let value = serde_json::json!({
            "available": [],
            "claimed": [{
                "id": "2",
                "name": "Deadzone Rogue 2",
                "tasks": ["PLAY_ON_DESKTOP"],
                "expiresAt": null,
                "state": "claimed",
                "progressSeconds": 119,
                "targetSeconds": 900,
                "rewardOrbs": null,
            }],
            "expired": 0,
            "desktopApp": true,
            "runningGames": [],
        });

        let list: QuestList = serde_json::from_value(value).expect("the list is understood");

        assert!(list.claimed[0].is_running());
    }

    #[test]
    fn a_finished_quest_is_not_running() {
        let value = serde_json::json!({
            "available": [],
            "claimed": [{
                "id": "3",
                "name": "Deadzone Rogue 2",
                "tasks": ["PLAY_ON_DESKTOP"],
                "expiresAt": null,
                "state": "completed",
                "progressSeconds": 900,
                "targetSeconds": 900,
                "rewardOrbs": 700,
            }],
            "expired": 0,
            "desktopApp": true,
            "runningGames": [],
        });

        let list: QuestList = serde_json::from_value(value).expect("the list is understood");

        assert!(
            !list.claimed[0].is_running(),
            "a finished quest is not running"
        );
    }
}
