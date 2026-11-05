# Release Notes — Discord Auto Quest

**Version:** v1.3.1

**Status:** Draft

**Release Date:** TBD

## Overview

Reopening Discord Auto Quest returns to the existing Windows window while keeping your current view and Work session.

## Improvements

- Restore and focus the existing window on repeat launches.
- Show a brief “Discord Auto Quest is already running” notification, retained in Notifications after it disappears.

## Bug Fixes

- Prevent duplicate app launches from starting separate Work controllers.
- Keep the app window and instance guard available if an update installer cannot start.

Downloads include the setup EXE, portable ZIP, installer signature, latest.json, and SHA256SUMS. The installer provisions WebView2 when needed; the portable ZIP requires it already installed. These builds have no Windows publisher signature. Updates require confirmation; rewards are claimed in Discord. Linux is excluded and macOS remains paused.

MIT license and required notices are included. See [release verification](https://github.com/edisonmalasan/discord-auto-quest/blob/main/docs/RELEASE_CHECKS.md) for exact-asset evidence.
