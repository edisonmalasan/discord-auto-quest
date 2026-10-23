use std::path::PathBuf;

/// Prepare the build.
///
/// The version is read from the workspace manifest and handed to the compiler,
/// so the about panel cannot show a version that disagrees with the one the
/// application was shipped as.
///
/// The quest operation is **not** built here. It is encrypted when the payload is
/// built, embedded as ciphertext, and decrypted in memory when it is needed —
/// see `quest::payload`.
fn main() {
    inject_version();

    tauri_build::build()
}

/// Read the version from the workspace manifest and hand it to the compiler.
///
/// The version is defined in one place — `package.json` — and the crate's own
/// manifest is checked against it. A crate that states one version while the
/// application states another produces an artefact that cannot say what it is,
/// so the mismatch fails the build rather than shipping.
fn inject_version() {
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("package.json");

    let text = std::fs::read_to_string(&manifest)
        .unwrap_or_else(|error| panic!("the workspace manifest must be readable: {error}"));

    let version = read_version(&text)
        .unwrap_or_else(|error| panic!("the workspace manifest must state a version: {error}"));

    let crate_version = env!("CARGO_PKG_VERSION");
    assert_eq!(
        crate_version, version,
        "the crate says it is {crate_version} and the workspace manifest says {version}; \
         run `npm run version:sync` to bring them into step"
    );

    println!("cargo:rustc-env=APP_VERSION={version}");
    println!("cargo:rerun-if-changed={}", manifest.display());
}

/// The `version` field of a `package.json`, read without a JSON parser.
///
/// The build operation has no dependencies, and a version field is a string in an
/// object: the one line that carries it is enough.
fn read_version(text: &str) -> Result<String, String> {
    for line in text.lines() {
        let line = line.trim();

        if !line.starts_with("\"version\"") {
            continue;
        }

        let colon = line
            .find(':')
            .ok_or_else(|| "the version line has no colon".to_string())?;
        let value = line[colon + 1..].trim().trim_end_matches(',');

        let version = value
            .strip_prefix('"')
            .and_then(|rest| rest.strip_suffix('"'))
            .ok_or_else(|| format!("the version is not a string: {value}"))?;

        return Ok(version.to_string());
    }

    Err("the manifest has no version field".to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_version_is_read_out_of_the_manifest() {
        let text = r#"{
  "name": "discord-auto-quest",
  "version": "1.2.3",
  "private": true
}"#;

        assert_eq!(read_version(text).expect("a version"), "1.2.3");
    }

    #[test]
    fn a_manifest_without_a_version_is_refused() {
        assert!(read_version(r#"{"name": "x"}"#).is_err());
    }
}
