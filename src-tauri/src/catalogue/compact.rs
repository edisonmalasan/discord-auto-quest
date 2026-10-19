use super::model::{CatalogEntry, CatalogExecutable, RawGame};

/// Project the raw payload onto the fields the clone keeps.
///
/// The raw catalogue is roughly 13 MB. The projection keeps only what the product
/// needs, which is what makes it worth caching: the result is a fraction of the size
/// and still answers every question the UI asks.
pub fn compact(raw: &[RawGame]) -> Vec<CatalogEntry> {
    let mut entries: Vec<CatalogEntry> = raw.iter().map(compact_entry).collect();

    // The catalogue is an index, and an index is read alphabetically. Sorting here
    // means the cached copy and the served copy are in the same order every time.
    entries.sort_by_cached_key(|entry| (entry.name.to_lowercase(), entry.id.clone()));

    entries
}

fn compact_entry(game: &RawGame) -> CatalogEntry {
    CatalogEntry {
        id: game.id.clone(),
        name: game.name.clone(),
        aliases: game
            .aliases
            .iter()
            .filter(|alias| !alias.is_empty())
            .cloned()
            .collect(),
        cover_image_hash: non_empty(game.cover_image_hash.as_deref()),
        icon_hash: non_empty(game.icon_hash.as_deref()),
        executables: game
            .executables
            .iter()
            .map(|executable| CatalogExecutable {
                os: executable.os.clone(),
                path: executable.name.clone(),
                is_launcher: executable.is_launcher,
            })
            .collect(),
        age_ratings: age_ratings(game),
    }
}

/// The catalogue carries age ratings from several agencies — `esrb`, `pegi`, `apple`,
/// `igdb`, `gop` — and the numeric value is agency-specific. Discord does not publish
/// a stable mapping from those numbers to labels, and the values are demonstrably not
/// a single scale (the same ESRB rating appears at several different numbers
/// depending on the title). The value is therefore kept verbatim as
/// `<agency>:<rating>` rather than being mapped to a label that cannot be verified.
fn age_ratings(game: &RawGame) -> Vec<String> {
    let Some(classification) = &game.content_classification else {
        return Vec::new();
    };

    let mut ratings: Vec<String> = classification
        .agency_ratings
        .iter()
        .map(|(agency, rating)| format!("{agency}:{}", rating.rating))
        .collect();
    ratings.sort();
    ratings
}

fn non_empty(value: Option<&str>) -> Option<String> {
    value
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(str::to_owned)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::catalogue::model::RawExecutable;

    fn raw() -> RawGame {
        RawGame {
            id: "356875221078245376".into(),
            name: "Overwatch".into(),
            aliases: vec!["OW".into(), String::new()],
            cover_image_hash: Some("843a3b07639f068fdacf40b9c3808c46".into()),
            icon_hash: Some("a60bb76ba4d4acafbd4cb9aad6e61739".into()),
            executables: vec![RawExecutable {
                os: "win32".into(),
                name: "_retail_/overwatch.exe".into(),
                is_launcher: false,
            }],
            content_classification: None,
        }
    }

    #[test]
    fn the_registered_path_survives_projection_intact() {
        let entry = compact_entry(&raw());
        assert_eq!(entry.executables[0].path, "_retail_/overwatch.exe");
        assert_eq!(entry.executables[0].os, "win32");
    }

    #[test]
    fn empty_aliases_are_dropped() {
        let entry = compact_entry(&raw());
        assert_eq!(entry.aliases, vec!["OW".to_string()]);
    }

    #[test]
    fn blank_hashes_become_none() {
        let mut game = raw();
        game.cover_image_hash = Some("   ".into());
        assert_eq!(compact_entry(&game).cover_image_hash, None);
    }

    #[test]
    fn the_projection_drops_the_payload_fields_the_product_does_not_use() {
        let entry = compact_entry(&raw());
        // `hook`, `overlay`, `third_party_skus` and `themes` have no field here.
        let serialised = serde_json::to_string(&entry).expect("serialises");
        for dropped in ["hook", "overlay", "third_party_skus", "themes"] {
            assert!(!serialised.contains(dropped), "{dropped} should not survive");
        }
    }

    #[test]
    fn age_ratings_are_kept_verbatim_and_sorted() {
        let mut game = raw();
        game.content_classification = Some(crate::catalogue::model::ContentClassification {
            agency_ratings: [
                (
                    "pegi".to_string(),
                    crate::catalogue::model::AgencyRating {
                        rating: 3,
                        descriptors: vec![],
                    },
                ),
                (
                    "esrb".to_string(),
                    crate::catalogue::model::AgencyRating {
                        rating: 4,
                        descriptors: vec![1, 2],
                    },
                ),
            ]
            .into_iter()
            .collect(),
        });
        let entry = compact_entry(&game);
        assert_eq!(entry.age_ratings, vec!["esrb:4".to_string(), "pegi:3".to_string()]);
    }
}
