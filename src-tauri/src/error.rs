use serde::Serialize;

/// Machine-readable failure codes.
///
/// The frontend switches on these; it must never parse `message` to decide what to do.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    /// The catalogue endpoint could not be reached, or answered with a failure status.
    NetworkUnavailable,
    /// The endpoint answered, but the payload was not a usable catalogue.
    InvalidPayload,
    /// No cached catalogue exists to fall back on.
    CacheUnavailable,
    /// A filesystem operation failed.
    IoError,
}

/// The error shape every Tauri command returns on failure.
#[derive(Debug, Clone, Serialize)]
pub struct AppError {
    pub code: ErrorCode,
    pub message: String,
    /// Whether repeating the same operation could plausibly succeed.
    pub retryable: bool,
}

impl AppError {
    pub fn new(code: ErrorCode, message: impl Into<String>, retryable: bool) -> Self {
        Self {
            code,
            message: message.into(),
            retryable,
        }
    }

    pub fn network(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::NetworkUnavailable, message, true)
    }

    pub fn invalid_payload(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::InvalidPayload, message, false)
    }

    pub fn cache_unavailable(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::CacheUnavailable, message, true)
    }

    pub fn io(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::IoError, message, true)
    }
}

impl std::fmt::Display for AppError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "{:?}: {}", self.code, self.message)
    }
}

impl std::error::Error for AppError {}

impl From<std::io::Error> for AppError {
    fn from(error: std::io::Error) -> Self {
        AppError::io(error.to_string())
    }
}

impl From<serde_json::Error> for AppError {
    fn from(error: serde_json::Error) -> Self {
        AppError::invalid_payload(format!("could not decode the catalogue payload: {error}"))
    }
}

pub type AppResult<T> = Result<T, AppError>;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn error_codes_serialise_as_screaming_snake_case() {
        let json = serde_json::to_string(&AppError::network("nope")).expect("serialises");
        assert_eq!(
            json,
            r#"{"code":"NETWORK_UNAVAILABLE","message":"nope","retryable":true}"#
        );
    }

    #[test]
    fn an_invalid_payload_is_not_retryable() {
        assert!(!AppError::invalid_payload("bad shape").retryable);
    }

    #[test]
    fn io_errors_map_to_the_io_code() {
        let error: AppError = std::io::Error::new(std::io::ErrorKind::PermissionDenied, "denied").into();
        assert_eq!(error.code, ErrorCode::IoError);
        assert!(error.retryable);
    }
}
