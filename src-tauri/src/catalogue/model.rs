use std::collections::BTreeMap;

use serde::{Deserialize, Serialize};

/// A catalogue entry exactly as Discord serves it.
///
/// Only the fields the clone keeps are modelled. Everything else in the payload
/// (`hook`, `overlay*`, `third_party_skus`, `themes`, …) is ignored at parse time,
/// which is what makes the compact projection cheap.
#[derive(Debug, Clone, Deserialize)]
pub struct RawGame {
    /// Discord application id, a snowflake.
    pub id: String,
    pub name: String,
    #[serde(default)]
    pub aliases: Vec<String>,
    #[serde(default, rename = "cover_image_hash")]
    pub cover_image_hash: Option<String>,
    #[serde(default, rename = "icon_hash")]
    pub icon_hash: Option<String>,
    /// Required. Every entry the endpoint serves carries it, and an entry without
    /// it is not a catalogue entry.
    pub executables: Vec<RawExecutable>,
    #[serde(default, rename = "content_classification")]
    pub content_classification: Option<ContentClassification>,
}

/// A registered executable.
///
/// `name` holds the **full registered path**, not a bare file name: `_beta_/wow-64.exe`,
/// `osx64/dota2.app`. Discord matches on that path, so it has to survive intact.
#[derive(Debug, Clone, Deserialize)]
pub struct RawExecutable {
    pub os: String,
    pub name: String,
    #[serde(default, rename = "is_launcher")]
    pub is_launcher: bool,
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct ContentClassification {
    #[serde(default, rename = "agency_ratings")]
    pub agency_ratings: BTreeMap<String, AgencyRating>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AgencyRating {
    pub rating: i64,
    #[serde(default)]
    pub descriptors: Vec<i64>,
}

/// A catalogue entry after projection. This is the shape that is cached on disk and
/// sent across the IPC boundary.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogEntry {
    pub id: String,
    pub name: String,
    pub aliases: Vec<String>,
    pub cover_image_hash: Option<String>,
    pub icon_hash: Option<String>,
    pub executables: Vec<CatalogExecutable>,
    pub age_ratings: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogExecutable {
    pub os: String,
    /// The full registered path, as Discord published it.
    pub path: String,
    pub is_launcher: bool,
}

/// Where the served catalogue came from.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub enum CatalogueSource {
    /// Fetched from Discord's endpoint during this session.
    Network,
    /// Read from the on-disk cache.
    Cache,
}

/// Counts derived from the catalogue that was actually loaded.
///
/// Every number here is computed at runtime from the entries in hand. Nothing is
/// hard-coded, because the live catalogue and any snapshot of it disagree by
/// thousands of entries.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogueStats {
    pub total: usize,
    /// Entries with at least one registered executable.
    pub questable: usize,
    pub not_questable: usize,
    /// `questable / total`, in the range `0.0..=1.0`.
    pub questable_ratio: f64,
    /// Registered executable records per operating system.
    pub platform_splits: Vec<PlatformSplit>,
    pub with_cover_art: usize,
    pub with_icon: usize,
    pub with_aliases: usize,
    /// Entries the endpoint served that could not be parsed.
    pub dropped_entries: u32,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PlatformSplit {
    pub os: String,
    pub executables: usize,
}

/// What the frontend receives.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CatalogueSnapshot {
    pub entries: Vec<CatalogEntry>,
    pub stats: CatalogueStats,
    pub source: CatalogueSource,
    /// When the underlying data was fetched, as a Unix timestamp in seconds.
    pub fetched_at: Option<u64>,
    /// True when the data came from the cache and is past its refresh interval.
    pub stale: bool,
}
