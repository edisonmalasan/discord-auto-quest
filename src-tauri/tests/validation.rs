use discord_auto_quest_lib::{
    discord::DiscordState,
    quest::{enrollment, payload},
};

#[tokio::test]
async fn validation_build_cannot_start_accept_or_select_without_test_bypasses() {
    if payload::PRODUCTION {
        return;
    }
    assert!(payload::require_production().is_err());
    assert!(enrollment::expression("123", None).is_err());
    assert!(enrollment::expression("123", Some("reviewed")).is_err());
    assert!(enrollment::desktop_expression("123").is_err());
    let state = DiscordState::default();
    let error = state.start_work().await.unwrap_err();
    assert!(error.message.contains("Validation build"));
    assert_eq!(
        state.work_status().await.phase,
        discord_auto_quest_lib::discord::WorkPhase::Stopped
    );
}
