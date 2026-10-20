use std::collections::BTreeMap;

use super::model::{CatalogEntry, CatalogueStats, PlatformSplit};

/// Derive every count the UI shows from the catalogue that was actually loaded.
///
/// Nothing here is a constant. The live catalogue and any snapshot of it disagree by
/// thousands of entries, so a hard-coded number would be a lie the moment the
/// endpoint moved.
pub fn compute(entries: &[CatalogEntry], dropped_entries: u32) -> CatalogueStats {
    let mut questable = 0usize;
    let mut with_cover_art = 0usize;
    let mut with_icon = 0usize;
    let mut with_aliases = 0usize;
    let mut executables_per_os: BTreeMap<String, usize> = BTreeMap::new();

    for entry in entries {
        if !entry.executables.is_empty() {
            questable += 1;
        }
        if entry.cover_image_hash.is_some() {
            with_cover_art += 1;
        }
        if entry.icon_hash.is_some() {
            with_icon += 1;
        }
        if !entry.aliases.is_empty() {
            with_aliases += 1;
        }
        for executable in &entry.executables {
            *executables_per_os.entry(executable.os.clone()).or_insert(0) += 1;
        }
    }

    let total = entries.len();
    let questable_ratio = if total == 0 {
        0.0
    } else {
        questable as f64 / total as f64
    };

    CatalogueStats {
        total,
        questable,
        not_questable: total.saturating_sub(questable),
        questable_ratio,
        platform_splits: executables_per_os
            .into_iter()
            .map(|(os, executables)| PlatformSplit { os, executables })
            .collect(),
        with_cover_art,
        with_icon,
        with_aliases,
        dropped_entries,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::catalogue::model::CatalogExecutable;

    fn entry(name: &str, executables: Vec<CatalogExecutable>) -> CatalogEntry {
        CatalogEntry {
            id: name.to_string(),
            name: name.to_string(),
            aliases: Vec::new(),
            cover_image_hash: Some("cover".into()),
            icon_hash: None,
            executables,
            age_ratings: Vec::new(),
        }
    }

    fn executable(os: &str) -> CatalogExecutable {
        CatalogExecutable {
            os: os.to_string(),
            path: "game.exe".to_string(),
            is_launcher: false,
        }
    }

    #[test]
    fn an_entry_without_executables_is_not_questable() {
        let entries = vec![entry("a", vec![executable("win32")]), entry("b", vec![])];
        let stats = compute(&entries, 0);
        assert_eq!(stats.total, 2);
        assert_eq!(stats.questable, 1);
        assert_eq!(stats.not_questable, 1);
        assert!((stats.questable_ratio - 0.5).abs() < f64::EPSILON);
    }

    #[test]
    fn platform_splits_count_executable_records_not_entries() {
        let entries = vec![
            entry("a", vec![executable("win32"), executable("win32")]),
            entry("b", vec![executable("linux")]),
        ];
        let stats = compute(&entries, 0);
        let win32 = stats
            .platform_splits
            .iter()
            .find(|split| split.os == "win32")
            .expect("win32 present");
        assert_eq!(win32.executables, 2);
        assert_eq!(stats.platform_splits.len(), 2);
    }

    #[test]
    fn cover_art_and_icon_counts_are_derived() {
        let entries = vec![entry("a", vec![])];
        let stats = compute(&entries, 0);
        assert_eq!(stats.with_cover_art, 1);
        assert_eq!(stats.with_icon, 0);
        assert_eq!(stats.with_aliases, 0);
    }

    #[test]
    fn an_empty_catalogue_produces_zeroes_rather_than_a_nan_ratio() {
        let stats = compute(&[], 0);
        assert_eq!(stats.total, 0);
        assert_eq!(stats.questable_ratio, 0.0);
        assert_eq!(stats.not_questable, 0);
    }

    #[test]
    fn dropped_rows_are_carried_through() {
        let stats = compute(&[entry("a", vec![])], 7);
        assert_eq!(stats.dropped_entries, 7);
    }
}
