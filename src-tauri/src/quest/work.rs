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
    pub message: Option<String>,
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
    observed: HashSet<String>,
    completed: HashSet<String>,
}
impl Ledger {
    pub fn observe(&mut self, list: &QuestList) -> Vec<QuestCompleted> {
        let mut events = Vec::new();
        for quest in &list.claimed {
            if quest.state == QuestState::Completed && quest.completed_at.is_some() {
                if self.completed.insert(quest.id.clone()) && self.observed.contains(&quest.id) {
                    events.push(QuestCompleted {
                        quest_id: quest.id.clone(),
                        name: quest.name.clone(),
                    });
                }
            } else if quest.state == QuestState::Claimed {
                self.observed.insert(quest.id.clone());
            }
        }
        events
    }
    pub fn reset_observation(&mut self) {
        self.observed.clear();
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
                    && quest.work_eligible
                    && quest.selected_task_kind.is_some()
                    && quest.enrolled_at_ms.is_some_and(f64::is_finite)
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
        let result = ledger.observe(&list(&[("old", "completed", 0.), ("new", "completed", 1.)]));
        assert_eq!(result.len(), 1);
        assert_eq!(result[0].quest_id, "new");
        assert!(ledger
            .observe(&list(&[("new", "completed", 1.)]))
            .is_empty());
    }
    #[test]
    fn reconnect_seeds_a_new_baseline_and_preserves_notification_deduplication() {
        let mut ledger = Ledger::default();
        ledger.observe(&list(&[("one", "claimed", 1.)]));
        ledger.reset_observation();
        assert!(ledger
            .observe(&list(&[("one", "completed", 1.)]))
            .is_empty());
    }
}
