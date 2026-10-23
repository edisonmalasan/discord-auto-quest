//! A deliberate, single-offer operation. Review never changes account state.
use crate::error::{AppError, AppResult};
use serde_json::{json, Value};

pub fn expression(id: &str, revision: Option<&str>) -> AppResult<String> {
    if id.is_empty() || id.len() > 20 || !id.bytes().all(|b| b.is_ascii_digit()) {
        return Err(AppError::not_supported(
            "Invalid quest identifier. Refresh your quests.",
        ));
    }
    if revision.is_some_and(|text| text.is_empty() || text.len() > 64000) {
        return Err(AppError::not_supported(
            "Review this offer again before accepting.",
        ));
    }
    let content = super::payload::decode(include_bytes!("../../payload/enrollment.bin"))?;
    let input =
        json!({"id":id,"mode":if revision.is_some(){"confirm"}else{"prepare"},"revision":revision});
    Ok(format!("({content})({input})"))
}

pub fn validate(value: Value, id: &str) -> AppResult<Value> {
    let status = value.get("status").and_then(Value::as_str).unwrap_or("");
    if ![
        "review",
        "accepted",
        "unsupported",
        "blocked",
        "expired",
        "changed",
        "pending",
        "uncertain",
    ]
    .contains(&status)
        || (["review", "accepted"].contains(&status)
            && value.get("id").and_then(Value::as_str) != Some(id))
    {
        return Err(AppError::not_supported(
            "Discord's response was not understood. Refresh and check the offer in Discord.",
        ));
    }
    Ok(value)
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn requests_reject_invalid_ids_and_unreviewed_confirmation() {
        for id in ["", "1');alert(1)", "123456789012345678901", "１２３"] {
            assert!(expression(id, None).is_err());
        }
        assert!(expression("123", Some("")).is_err());
        assert!(expression("123", Some(&"a".repeat(64001))).is_err());
        assert!(expression("123", None).unwrap().contains("\"prepare\""));
    }
    #[test]
    fn unknown_or_wrong_offer_responses_are_not_success() {
        assert!(validate(json!({"status":"accepted","id":"456"}), "123").is_err());
        assert!(validate(json!({"status":"success"}), "123").is_err());
        assert!(validate(json!({"status":"accepted","id":"123"}), "123").is_ok());
    }
}
