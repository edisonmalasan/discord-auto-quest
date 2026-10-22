use serde::Serialize;

/// Machine-readable failure codes.
///
/// The frontend switches on these; it must never parse `message` to decide what to do.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ErrorCode {
    /// A renderer operation was dispatched but its outcome could not be confirmed.
    OperationUncertain,
    /// The Discord debugger could not be reached, or answered with a failure status.
    NetworkUnavailable,
    /// Discord answered, but the payload was not a usable quest state.
    InvalidPayload,
    /// A filesystem operation failed.
    IoError,
    /// The application is not allowed to write or read the path.
    Permission,
    /// Discord is not installed on this machine.
    NotInstalled,
    /// The operation is not available in this state — most often because
    /// Discord is not running with a debugging port.
    NotSupported,
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

    pub fn io(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::IoError, message, true)
    }

    pub fn permission(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::Permission, message, false)
    }

    pub fn not_installed(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::NotInstalled, message, false)
    }

    pub fn not_supported(message: impl Into<String>) -> Self {
        Self::new(ErrorCode::NotSupported, message, false)
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
        match error.kind() {
            std::io::ErrorKind::PermissionDenied => {
                AppError::permission(format!("permission denied: {error}"))
            }
            _ => AppError::io(error.to_string()),
        }
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
        let error: AppError = std::io::Error::new(std::io::ErrorKind::NotFound, "missing").into();
        assert_eq!(error.code, ErrorCode::IoError);
        assert!(error.retryable);
    }

    #[test]
    fn a_permission_error_is_reported_as_a_permission() {
        let error: AppError =
            std::io::Error::new(std::io::ErrorKind::PermissionDenied, "denied").into();
        assert_eq!(error.code, ErrorCode::Permission);
        assert!(!error.retryable, "retrying will not grant permission");
    }
}
