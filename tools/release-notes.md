# Release Notes — Discord Auto Quest

**Version:** v1.3.0

**Status:** Draft

**Release Date:** TBD

## Overview

A clearer Ongoing workspace and compact notifications for Windows 10/11 x64 and stable Discord desktop.

## New Features

- See the current quest under **Active now**, using the regular quest card and its Discord-confirmed progress.
- Browse **Pending** in Work’s execution order, with **Up next** on the first card and **Queued** on the remaining cards.
- Find recent instructions in a bell notification dropdown with unread indicators, expandable details, and **Mark all read**.

## Improvements

- Keep search above the quest groups and the active quest visible while filtering.
- Separate **Needs manual play** and **Needs attention** from the pending queue.
- Automatically skip achievement-only activity objectives so eligible quests can continue. Timed activities remain supported.
- Remove the extra Work status strip and move routine card messages into five-second floating notifications. Recovery problems remain visible.

## Bug Fixes

- Prevent achievement-only tasks from entering automatic Work even when upstream eligibility metadata is inconsistent.
- Keep handoff instructions available after a floating message disappears, without adding text below quest buttons.

Downloads include the setup EXE, portable ZIP, installer signature, latest.json, and SHA256SUMS. The installer provisions WebView2 when needed; the portable ZIP requires it already installed. These builds have no Windows publisher signature. Updates require confirmation; rewards are claimed in Discord. Linux is excluded and macOS remains paused.

MIT license and required notices are included. See [release verification](https://github.com/edisonmalasan/discord-auto-quest/blob/main/docs/RELEASE_CHECKS.md) for exact-asset evidence.
