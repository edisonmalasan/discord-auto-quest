# Release Notes — Discord Auto Quest

**Version:** v1.4.0

**Status:** Draft

**Release Date:** TBD

## Overview

Separates the Completed view into clear reward-status groups so unclaimed rewards appear first at the top, with claimed rewards below.

## New Features

- Group **Completed** quests into **Unclaimed rewards** first, **Claimed rewards** below, and **Other completed** when expired or unverified rewards are present.
- Show live, search-filtered card counts on each Completed section header while keeping sidebar counts independent of search.

## Improvements

- Hide empty Completed section headers automatically during normal viewing and search, and preserve the **No matching quests** empty state with **Clear search**.
- Share consistent grouped-section layout and stretched card-footer alignment across Ongoing and Completed views.

Downloads include the setup EXE, portable ZIP, installer signature, latest.json, and SHA256SUMS. The installer provisions WebView2 when needed; the portable ZIP requires it already installed. These builds have no Windows publisher signature. Updates require confirmation; rewards are claimed in Discord. Linux is excluded and macOS remains paused.

MIT license and required notices are included. See [release verification](https://github.com/edisonmalasan/discord-auto-quest/blob/main/docs/RELEASE_CHECKS.md) for exact-asset evidence.
