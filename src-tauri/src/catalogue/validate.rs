use serde_json::Value;

use crate::error::{AppError, AppResult};

use super::model::RawGame;

/// Validate the payload's shape and parse it.
///
/// The rule is deliberately narrow: the payload must be a non-empty JSON array whose
/// first element is an object carrying a `name` string and an `executables` array.
/// That is the same shape check upstream applies, and it is enough to tell a
/// catalogue apart from an error page or a captive-portal response.
///
/// Returns the parsed entries and the number of rows that had to be dropped.
pub fn parse(text: &str) -> AppResult<(Vec<RawGame>, u32)> {
    // Fast path: the whole payload is well-formed. This is the normal case and it
    // avoids building a `Value` tree for a 13 MB document.
    match serde_json::from_str::<Vec<RawGame>>(text) {
        Ok(games) => {
            if games.is_empty() {
                return Err(AppError::invalid_payload(
                    "the catalogue endpoint returned an empty array",
                ));
            }
            return Ok((games, 0));
        }
        Err(_) => { /* fall through to the tolerant path */ }
    }

    // Tolerant path: apply the shape rule to the first element, then parse each row
    // on its own so one malformed entry cannot discard the whole catalogue.
    let mut value: Value = serde_json::from_str(text).map_err(|error| {
        AppError::invalid_payload(format!(
            "the catalogue endpoint did not return valid JSON: {error}"
        ))
    })?;

    let array = match value.as_array_mut() {
        Some(array) => std::mem::take(array),
        None => {
            return Err(AppError::invalid_payload(
                "the catalogue endpoint did not return a JSON array",
            ))
        }
    };

    let first = array.first().ok_or_else(|| {
        AppError::invalid_payload("the catalogue endpoint returned an empty array")
    })?;

    let object = first.as_object().ok_or_else(|| {
        AppError::invalid_payload("the first catalogue entry is not a JSON object")
    })?;

    if object.get("name").and_then(Value::as_str).is_none() {
        return Err(AppError::invalid_payload(
            "the first catalogue entry has no `name` string",
        ));
    }

    if !object
        .get("executables")
        .map(Value::is_array)
        .unwrap_or(false)
    {
        return Err(AppError::invalid_payload(
            "the first catalogue entry has no `executables` array",
        ));
    }

    let mut games = Vec::with_capacity(array.len());
    let mut dropped = 0u32;
    for entry in array {
        match serde_json::from_value::<RawGame>(entry) {
            Ok(game) => games.push(game),
            Err(_) => dropped += 1,
        }
    }

    if games.is_empty() {
        return Err(AppError::invalid_payload(
            "no catalogue entry could be parsed",
        ));
    }

    Ok((games, dropped))
}

#[cfg(test)]
mod tests {
    use super::*;

    const GOOD: &str = r#"[
        {"id":"1","name":"Alpha","executables":[{"os":"win32","name":"alpha.exe","is_launcher":false}]},
        {"id":"2","name":"Beta","executables":[]}
    ]"#;

    #[test]
    fn a_well_formed_payload_parses() {
        let (games, dropped) = parse(GOOD).expect("parses");
        assert_eq!(games.len(), 2);
        assert_eq!(dropped, 0);
        assert_eq!(games[0].name, "Alpha");
        assert_eq!(games[0].executables[0].name, "alpha.exe");
        assert!(!games[0].executables[0].is_launcher);
    }

    #[test]
    fn a_non_array_payload_is_rejected() {
        let error = parse(r#"{"error":"nope"}"#).expect_err("rejected");
        assert_eq!(error.code, crate::error::ErrorCode::InvalidPayload);
        assert!(!error.retryable);
    }

    #[test]
    fn an_empty_array_is_rejected() {
        assert!(parse("[]").is_err());
    }

    #[test]
    fn invalid_json_is_rejected() {
        assert!(parse("<html>nope</html>").is_err());
    }

    #[test]
    fn a_first_entry_without_a_name_is_rejected() {
        let error = parse(r#"[{"id":"1","executables":[]}]"#).expect_err("rejected");
        assert!(error.message.contains("name"));
    }

    #[test]
    fn a_first_entry_without_executables_is_rejected() {
        let error = parse(r#"[{"id":"1","name":"Alpha"}]"#).expect_err("rejected");
        assert!(error.message.contains("executables"));
    }

    #[test]
    fn one_unparseable_row_is_dropped_and_counted() {
        let payload = r#"[
            {"id":"1","name":"Alpha","executables":[]},
            {"id":"2","name":"Beta","executables":[]},
            {"id":123,"name":"Gamma","executables":[]}
        ]"#;
        let (games, dropped) = parse(payload).expect("parses");
        assert_eq!(games.len(), 2);
        assert_eq!(dropped, 1);
    }

    #[test]
    fn optional_fields_default_when_absent() {
        let (games, _) = parse(r#"[{"id":"1","name":"Alpha","executables":[]}]"#).expect("parses");
        assert!(games[0].aliases.is_empty());
        assert!(games[0].cover_image_hash.is_none());
        assert!(games[0].icon_hash.is_none());
        assert!(games[0].content_classification.is_none());
    }
}
