//! The quest operation, as it ships.
//!
//! The operation is the heart of the mechanism, and it is the one piece of this
//! project that must not be readable by anyone who has the application. So it
//! is not in the application as text: it is encrypted when the payload is
//! built, embedded as ciphertext, and decrypted into memory when it is needed.
//!
//! It is never written to disk. The decrypted operation is handed straight to the
//! renderer and forgotten.
//!
//! **What this is, honestly.** The key is in the application, so this is
//! *obfuscation* and not secrecy: the operation is not sitting in the executable
//! as text, but the executable can decrypt it. A determined analyst with the
//! binary can recover the operation. What it buys is that the operation is not
//! handed over by `strings`, by a grep, or by anyone who opens the file.

use crate::error::{AppError, AppResult};

use aes_gcm::aead::{Aead, KeyInit, Payload};
use aes_gcm::Nonce;

/// The encrypted operation, built by internal maintenance tooling.
const PAYLOAD: &[u8] = include_bytes!("../../payload/auto-quest.bin");

/// The key it was encrypted with, in hexadecimal.
const KEY: &str = include_str!("../../payload/secret.key");

/// How much of the payload is the nonce.
const NONCE_BYTES: usize = 12;

/// How much of the payload is the authentication tag.
const TAG_BYTES: usize = 16;

/// The quest operation, decrypted.
///
/// The caller gets a string it can evaluate in Discord's renderer. Nothing is
/// written anywhere.
pub fn content() -> AppResult<String> {
    decode(PAYLOAD)
}

pub(crate) fn decode(bytes: &[u8]) -> AppResult<String> {
    let key = read_key()?;
    let cipher = aes_gcm::Aes256Gcm::new_from_slice(&key).map_err(|_| {
        AppError::invalid_payload("the payload's key is the wrong size for the cipher")
    })?;

    if bytes.len() < NONCE_BYTES + TAG_BYTES {
        return Err(AppError::invalid_payload(
            "the payload is too short to hold a nonce and a tag",
        ));
    }

    let (nonce, rest) = bytes.split_at(NONCE_BYTES);

    // The cipher reads the tag off the end of the message, so the message is
    // handed over whole.
    let plaintext = cipher
        .decrypt(
            Nonce::from_slice(nonce),
            Payload {
                msg: rest,
                aad: &[],
            },
        )
        .map_err(|_| {
            AppError::invalid_payload(
                "the payload could not be decrypted, so it does not match the key it was built with",
            )
        })?;

    String::from_utf8(plaintext).map_err(|error| {
        AppError::invalid_payload(format!("the decrypted payload is not text: {error}"))
    })
}

/// The key, read from the hexadecimal it is written in.
fn read_key() -> AppResult<Vec<u8>> {
    let text: String = KEY.chars().filter(|c| !c.is_whitespace()).collect();

    if text.len() % 2 != 0 {
        return Err(AppError::invalid_payload(
            "the payload's key is not a whole number of bytes",
        ));
    }

    let mut bytes = Vec::with_capacity(text.len() / 2);

    for pair in text.as_bytes().chunks(2) {
        let hex = std::str::from_utf8(pair)
            .map_err(|_| AppError::invalid_payload("the payload's key is not hexadecimal"))?;

        bytes.push(
            u8::from_str_radix(hex, 16)
                .map_err(|_| AppError::invalid_payload("the payload's key is not hexadecimal"))?,
        );
    }

    Ok(bytes)
}

/// A phrase from the operation, used to check that it is not readable in the
/// application.
///
/// It is a phrase the operation *prints*, so it is in the plaintext and nowhere
/// else — if it turns up in the built executable, the payload is not
/// encrypted.
pub const MARKER: &str = "Quest progress:";

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_payload_decrypts_to_the_work() {
        let operation = content().expect("the payload decrypts");

        assert!(
            operation.contains(MARKER),
            "the decrypted operation is the quest operation"
        );
        assert!(
            operation.contains("webpackChunkdiscord_app"),
            "it is the operation that reaches into Discord's modules"
        );
    }

    #[test]
    fn the_payload_does_not_contain_the_operation_in_the_clear() {
        let payload = String::from_utf8_lossy(PAYLOAD);

        assert!(
            !payload.contains(MARKER),
            "the marker must not be readable in the payload"
        );
        assert!(
            !payload.contains("webpackChunkdiscord_app"),
            "nor the name of Discord's module registry"
        );
    }

    #[test]
    fn the_key_is_thirty_two_bytes() {
        assert_eq!(read_key().expect("the key reads").len(), 32);
    }
}
