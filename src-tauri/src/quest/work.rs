//! Backend-owned Work state and queue decisions. Transport operations live in DiscordState.
use super::reader::{QuestList, QuestState, QuestSummary};
use serde::Serialize;
use std::collections::HashSet;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Default)]
#[serde(rename_all = "snake_case")]
pub enum WorkPhase {
    #[default]
    Stopped,
    Starting,
    Working,
    Waiting,
    Stopping,
    Paused,
}
#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct WorkState {
    pub phase: WorkPhase,
    pub active_quest_id: Option<String>,
    pub active_task_kind: Option<String>,
    pub queued_count: usize,
    pub pending_quest_ids: Vec<String>,
    pub skipped_quests: Vec<SkippedQuest>,
    pub message: Option<String>,
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkippedQuest {
    pub quest_id: String,
    pub reason: &'static str,
}

fn supported_task(kind: &str) -> bool {
    matches!(
        kind,
        "WATCH_VIDEO"
            | "WATCH_VIDEO_ON_MOBILE"
            | "PLAY_ON_DESKTOP"
            | "STREAM_ON_DESKTOP"
            | "PLAY_ACTIVITY"
    )
}

fn skip_reason(quest: &QuestSummary) -> Option<&'static str> {
    if !quest.desktop_ready() {
        return Some("desktop_required");
    }
    if !quest
        .selected_task_kind
        .as_deref()
        .is_some_and(supported_task)
    {
        if quest
            .tasks
            .iter()
            .any(|kind| kind == "ACHIEVEMENT_IN_ACTIVITY")
            && !quest.tasks.iter().any(|kind| supported_task(kind))
        {
            return Some("manual_play");
        }
        return Some("unsupported");
    }
    if !quest.work_eligible || !quest.enrolled_at_ms.is_some_and(f64::is_finite) {
        return Some("unavailable");
    }
    None
}
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct QuestCompleted {
    pub quest_id: String,
    pub name: String,
}
#[derive(Debug, Clone)]
pub enum WorkEvent {
    State(WorkState),
    Completed(QuestCompleted),
}
#[derive(Default)]
pub(crate) struct Ledger {
    pub state: WorkState,
    pub enabled: bool,
    managed: HashSet<String>,
    completed: HashSet<String>,
}
impl Ledger {
    pub fn update_overview(&mut self, list: &QuestList) {
        self.state.pending_quest_ids = self.queue(list).iter().map(|q| q.id.clone()).collect();
        self.state.queued_count = self.state.pending_quest_ids.len();
        let mut seen = HashSet::new();
        self.state.skipped_quests = list
            .claimed
            .iter()
            .filter(|q| {
                q.state == QuestState::Claimed
                    && q.completed_at.is_none()
                    && self.state.active_quest_id.as_deref() != Some(&q.id)
                    && seen.insert(q.id.clone())
            })
            .filter_map(|q| {
                skip_reason(q).map(|reason| SkippedQuest {
                    quest_id: q.id.clone(),
                    reason,
                })
            })
            .collect();
    }
    pub fn observe(&mut self, list: &QuestList) -> Vec<QuestCompleted> {
        let mut events = Vec::new();
        for quest in &list.claimed {
            if quest.state == QuestState::Completed
                && quest.completed_at.is_some()
                && self.completed.insert(quest.id.clone())
                && self.managed.contains(&quest.id)
            {
                events.push(QuestCompleted {
                    quest_id: quest.id.clone(),
                    name: quest.name.clone(),
                });
            }
        }
        events
    }
    pub fn manage(&mut self, id: &str) {
        self.managed.insert(id.into());
    }
    pub fn skipped_count(&self, list: &QuestList) -> usize {
        list.claimed
            .iter()
            .filter(|quest| {
                quest.state == QuestState::Claimed
                    && quest.completed_at.is_none()
                    && skip_reason(quest).is_some()
            })
            .map(|quest| &quest.id)
            .collect::<HashSet<_>>()
            .len()
    }
    pub fn queue<'a>(&self, list: &'a QuestList) -> Vec<&'a QuestSummary> {
        if !list.desktop_app {
            return Vec::new();
        }
        let mut seen = HashSet::new();
        let mut quests: Vec<_> = list
            .claimed
            .iter()
            .filter(|quest| {
                quest.state == QuestState::Claimed
                    && quest.completed_at.is_none()
                    && skip_reason(quest).is_none()
                    && self.state.active_quest_id.as_deref() != Some(&quest.id)
                    && seen.insert(quest.id.clone())
            })
            .collect();
        quests.sort_by(|a, b| {
            a.enrolled_at_ms
                .partial_cmp(&b.enrolled_at_ms)
                .unwrap_or(std::cmp::Ordering::Equal)
                .then_with(|| a.id.cmp(&b.id))
        });
        quests
    }
}
#[cfg(test)]
mod tests {
    use super::*;
    fn list(rows: &[(&str, &str, f64)]) -> QuestList {
        serde_json::from_value(serde_json::json!({"available":[],"expired":0,"desktopApp":true,"runningGames":[],"claimed":rows.iter().map(|(id,state,accepted)|serde_json::json!({
     "id":id,"name":id,"tasks":["WATCH_VIDEO"],"state":state,"progressSeconds":0,"targetSeconds":100,"selectedTaskKind":"WATCH_VIDEO","workEligible":*state=="claimed","enrolledAtMs":accepted,"completedAt":if *state=="completed"{Some("2026-10-24")}else{None},"taskDetails":[]
   })).collect::<Vec<_>>()})).unwrap()
    }
    #[test]
    fn achievement_only_is_skipped_but_timed_activity_and_supported_alternatives_remain_eligible() {
        let mut ledger = Ledger::default();
        let mut feed = list(&[
            ("manual", "claimed", 0.),
            ("timed", "claimed", 1.),
            ("alternative", "claimed", 2.),
        ]);
        feed.claimed[0].tasks = vec!["ACHIEVEMENT_IN_ACTIVITY".into()];
        feed.claimed[0].selected_task_kind = Some("ACHIEVEMENT_IN_ACTIVITY".into());
        feed.claimed[1].tasks = vec!["PLAY_ACTIVITY".into()];
        feed.claimed[1].selected_task_kind = Some("PLAY_ACTIVITY".into());
        feed.claimed[2].tasks.push("ACHIEVEMENT_IN_ACTIVITY".into());
        ledger.update_overview(&feed);
        assert_eq!(ledger.state.pending_quest_ids, vec!["timed", "alternative"]);
        assert_eq!(ledger.state.skipped_quests.len(), 1);
        assert_eq!(ledger.state.skipped_quests[0].reason, "manual_play");
        ledger.state.active_quest_id = Some("timed".into());
        ledger.update_overview(&feed);
        assert_eq!(ledger.state.pending_quest_ids, vec!["alternative"]);
    }
    #[test]
    fn multi_platform_quests_wait_for_confirmed_desktop_even_if_other_metadata_says_eligible() {
        let ledger = Ledger::default();
        let mut feed = list(&[("multi", "claimed", 1.)]);
        feed.claimed[0].tasks = vec!["PLAY_ON_DESKTOP".into(), "PLAY_ON_XBOX".into()];
        assert!(ledger.queue(&feed).is_empty());
        assert_eq!(ledger.skipped_count(&feed), 1);
        feed.claimed[0].native_platform = Some("console".into());
        assert!(ledger.queue(&feed).is_empty());
        feed.claimed[0].native_platform = Some("desktop".into());
        assert_eq!(ledger.queue(&feed).len(), 1);
    }
    #[test]
    fn queue_is_oldest_acceptance_first_and_excludes_active_and_completed() {
        let mut ledger = Ledger::default();
        let feed = list(&[
            ("new", "claimed", 30.),
            ("old", "claimed", 10.),
            ("middle", "claimed", 20.),
            ("done", "completed", 1.),
        ]);
        ledger.state.active_quest_id = Some("middle".into());
        assert_eq!(
            ledger
                .queue(&feed)
                .iter()
                .map(|q| q.id.as_str())
                .collect::<Vec<_>>(),
            vec!["old", "new"]
        );
    }
    #[test]
    fn freshly_accepted_quests_join_the_next_scan_without_duplicates() {
        let ledger = Ledger::default();
        let before = list(&[]);
        assert!(ledger.queue(&before).is_empty());
        let after = list(&[
            ("one", "claimed", 1.),
            ("one", "claimed", 1.),
            ("two", "claimed", 2.),
        ]);
        assert_eq!(ledger.queue(&after).len(), 2);
    }
    #[test]
    fn completion_requires_a_timestamp_and_never_notifies_historical_completions() {
        let mut ledger = Ledger::default();
        assert!(ledger
            .observe(&list(&[("old", "completed", 0.), ("new", "claimed", 1.)]))
            .is_empty());
        ledger.manage("new");
        let result = ledger.observe(&list(&[("old", "completed", 0.), ("new", "completed", 1.)]));
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].quest_id, "new");
        assert!(ledger
            .observe(&list(&[("new", "completed", 1.)]))
            .is_empty());
    }
    #[test]
    fn observing_an_unmanaged_quest_never_announces_its_completion() {
        let mut ledger = Ledger::default();
        ledger.observe(&list(&[("manual", "claimed", 1.)]));
        assert!(ledger
            .observe(&list(&[("manual", "completed", 1.)]))
            .is_empty());
    }
    #[test]
    fn reconnect_seeds_a_new_baseline_and_preserves_notification_deduplication() {
        let mut ledger = Ledger::default();
        ledger.observe(&list(&[("one", "claimed", 1.)]));
        assert!(ledger
            .observe(&list(&[("one", "completed", 1.)]))
            .is_empty());
    }
    #[test]
    fn skipped_count_explains_ineligible_accepted_quests_only() {
        let ledger = Ledger::default();
        let mut feed = list(&[
            ("eligible", "claimed", 1.),
            ("expired", "claimed", 2.),
            ("done", "completed", 3.),
        ]);
        feed.claimed[1].work_eligible = false;
        assert_eq!(ledger.skipped_count(&feed), 1);
        assert_eq!(ledger.queue(&feed).len(), 1);
    }
}
