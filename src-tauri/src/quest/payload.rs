//! Protected content is transformed and encrypted before distribution.
//! Decryption happens only in memory. A user controlling the execution machine
//! can still recover it; these measures raise copying effort, not assure secrecy.
use crate::error::{AppError, AppResult};
use aes_gcm::aead::{Aead, KeyInit};
use aes_gcm::Nonce;

include!(concat!(env!("OUT_DIR"), "/protected.rs"));
const WORK: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/auto-quest.bin"));
const ENROLLMENT: &[u8] = include_bytes!(concat!(env!("OUT_DIR"), "/enrollment.bin"));

pub fn require_production() -> AppResult<()> {
    // Keep a verifiable build identity even with release optimization enabled.
    std::hint::black_box(BUILD_MARKER);
    if PRODUCTION {
        Ok(())
    } else {
        Err(AppError::not_supported(
            "Validation build: protected operations are disabled. Install an official release.",
        ))
    }
}

pub(crate) fn require_available() -> AppResult<()> {
    // Unit tests use simulated transports, never a real client.
    if cfg!(test) {
        Ok(())
    } else {
        require_production()
    }
}

pub fn content() -> AppResult<String> {
    decode(WORK)
}

pub(crate) fn enrollment() -> AppResult<String> {
    decode(ENROLLMENT)
}

fn decode(bytes: &[u8]) -> AppResult<String> {
    decode_with_key(bytes, &KEY)
}

fn decode_with_key(bytes: &[u8], key: &[u8; 32]) -> AppResult<String> {
    let invalid = || AppError::invalid_payload("Protected content authentication failed.");
    if bytes.len() < 29 {
        return Err(invalid());
    }
    let cipher = aes_gcm::Aes256Gcm::new_from_slice(key).map_err(|_| invalid())?;
    let plaintext = cipher
        .decrypt(Nonce::from_slice(&bytes[..12]), &bytes[12..])
        .map_err(|_| invalid())?;
    String::from_utf8(plaintext).map_err(|_| invalid())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_inputs_authenticate_and_identity_agrees_with_the_guard() {
        assert!(!content().unwrap().is_empty());
        assert!(!enrollment().unwrap().is_empty());
        assert_eq!(require_production().is_ok(), PRODUCTION);
        assert_eq!(
            BUILD_MARKER.starts_with("DAQ-CONTENT-PRODUCTION-v1:"),
            PRODUCTION
        );
    }

    #[test]
    fn altered_ciphertext_and_wrong_key_fail_without_returning_content() {
        let mut altered = WORK.to_vec();
        altered[12] ^= 1;
        assert!(decode(&altered).is_err());
        let mut wrong = KEY;
        wrong[0] ^= 1;
        assert!(decode_with_key(WORK, &wrong).is_err());
        assert!(decode(&[0; 20]).is_err());
    }
}
