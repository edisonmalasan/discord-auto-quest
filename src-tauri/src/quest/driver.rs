//! Dispatch one protected runtime job and confirm complete cancellation.
use crate::error::{AppError, AppResult};
use crate::quest::{cdp::Session, payload};
use serde::Deserialize;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStatus {
    pub phase: String,
    pub quest_id: Option<String>,
    pub task_kind: Option<String>,
    pub message: Option<String>,
}

/// Run exactly one selected quest. The renderer rejects any existing owner.
pub async fn run_quest(session: &mut Session, id: &str, kind: &str) -> AppResult<()> {
    dispatch(
        session,
        Some(serde_json::json!({"questId":id,"taskKind":kind})),
    )
    .await
}

/// Maintenance entry point. The runtime selects at most one eligible quest.
pub async fn run(session: &mut Session) -> AppResult<()> {
    dispatch(session, None).await
}

async fn dispatch(session: &mut Session, request: Option<serde_json::Value>) -> AppResult<()> {
    let operation = payload::content()?;
    let expression = format!(
        "(function () {{ window.__daqRequest = {}; try {{ return (function () {{\n{}\n}})(); }} finally {{ delete window.__daqRequest; }} }})()",
        request.map(|v| v.to_string()).unwrap_or_else(|| "null".to_string()), operation
    );
    let value = session.evaluate(&expression).await?;
    if value.get("accepted").and_then(|v| v.as_bool()) != Some(true) {
        return Err(AppError::not_supported(
            "Discord did not accept the selected Work job.",
        ));
    }
    Ok(())
}

/// Cancellation only succeeds after all runtime resources and requests settle.
pub async fn stop(session: &mut Session) -> AppResult<()> {
    let value = session
        .evaluate(
            r#"(async function () {
      const owner = window.__daq;
      if (!owner) return {stopped:true};
      if (typeof owner.stop !== 'function') throw new Error('Runtime cannot confirm cancellation.');
      return await owner.stop();
    })()"#,
        )
        .await?;
    if value.get("stopped").and_then(|v| v.as_bool()) != Some(true) {
        return Err(AppError::not_supported(
            "Discord did not confirm that Work stopped.",
        ));
    }
    Ok(())
}

pub async fn status(session: &mut Session) -> AppResult<RuntimeStatus> {
    let value = session.evaluate(r#"(function () {
      const owner = window.__daq;
      return owner ? {phase:owner.phase,questId:owner.questId || null,taskKind:owner.taskKind || null,message:owner.message || null}
        : {phase:'stopped',questId:null,taskKind:null,message:null};
    })()"#).await?;
    serde_json::from_value(value).map_err(Into::into)
}

/// Maintenance compatibility: whether a running desktop job owns the runtime.
pub async fn is_spoofing(session: &mut Session) -> AppResult<bool> {
    let current = status(session).await?;
    Ok(current.phase == "working" && current.task_kind.as_deref() == Some("PLAY_ON_DESKTOP"))
}

pub async fn is_desktop_app(session: &mut Session) -> AppResult<bool> {
    let value = session
        .evaluate("typeof DiscordNative !== 'undefined'")
        .await?;
    Ok(value.as_bool().unwrap_or(false))
}
