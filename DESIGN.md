---
name: discord-auto-quest
description: A working index of every game Discord can detect, and whether it can be quested.
colors:
  ground: "#0f1214"
  surface: "#151a1d"
  surface-raised: "#1c2327"
  rule: "#232c31"
  rule-soft: "#1a2125"
  ink: "#e7eae8"
  ink-secondary: "#9ba5a6"
  ink-tertiary: "#667173"
  spot: "#4fc3b0"
  warn: "#d9a441"
  danger: "#d9534f"
typography:
  display:
    fontFamily: "Archivo, 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Archivo, 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.3
    letterSpacing: "-0.01em"
  title:
    fontFamily: "Archivo, 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.4
  body:
    fontFamily: "Archivo, 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif"
    fontSize: "12.5px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "Archivo, 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.11em"
  mono:
    fontFamily: "'Azeret Mono', 'Cascadia Mono', Consolas, monospace"
    fontSize: "11.5px"
    fontWeight: 400
    lineHeight: 1.5
rounded:
  hairline: "1px"
  small: "2px"
  medium: "3px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
components:
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.medium}"
    padding: "8px 12px"
  button-ghost-hover:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.medium}"
  button-primary:
    backgroundColor: "{colors.spot}"
    textColor: "{colors.ground}"
    rounded: "{rounded.medium}"
    padding: "8px 12px"
  input-search:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.medium}"
    padding: "6px 12px"
    height: "32px"
  filter-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.small}"
    padding: "6px 8px"
  index-row:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    height: "52px"
  index-row-selected:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
  mark-detected:
    backgroundColor: "{colors.spot}"
    size: "8px"
  mark-undetected:
    backgroundColor: "transparent"
    textColor: "{colors.ink-tertiary}"
    size: "8px"
---

# Design System: discord-auto-quest

## Overview

**Creative North Star: "The Working Index"**

This product is a reference instrument, and the system is built like one. A working catalogue is
a printed thing: a ground, a margin, a set of rules, a column of facts, and a key that tells you
what the marks mean. The app takes that grammar and puts it on a screen where the catalogue is
live, where it changes, and where most of it cannot be used at all. The honesty of the page
depends on the page looking like it is reporting rather than selling.

That is the whole thesis. A catalogue of ~25,000 games, of which more than half have no
registered executable and can never be quested, is a document with a marginal annotation on
every line. The mark in the margin says whether the title is detected. The path beside the
title says exactly what Discord will match against. The counts on the left say what proportion
of the whole is even in play. Nothing is a tile with a rounded corner and a play button; the
mechanism is printed in the margin, because the mechanism is the product.

The world is a printed catalogue rendered as ink on a cold ground. The type is a workhorse
grotesque with a slightly technical mono for the paths and the figures — a reference typeface
and a measurement typeface, the pairing you get on the printed page. Depth is tonal: a hairline
separates, a surface lifts, and there are no shadows at all. The single spot colour appears on
the mark in the margin, the selected line, and the focus ring, and nowhere else.

**Key Characteristics:**

- A margin that carries meaning, not a gutter that carries whitespace.
- Hairlines divide. Boxes and cards do not.
- One spot colour, used on at most one thing per line of the index.
- Every figure is tabular, because every figure is a measurement.
- The page states where its data came from before it states anything about the data.

## Colors

A cold ink ground with one printer's spot colour, and two state colours that only appear when
they mean something.

### Primary

- **Spot Cyan** (#4FC3B0): the mark in the margin of a detected entry, the selected line's
  pointer, the focus ring, and the proportion bar's questable segment. It is the only colour on
  the page that says "this one works".

### Neutral

- **Cold Ground** (#0F1214): the page and the index background.
- **Surface** (#151A1D): the raised band a hovered line takes, and the search field.
- **Surface Raised** (#1C2327): the selected line, and the composition readout's ground.
- **Rule** (#232C31): the 1px hairline that divides the header, the rail, and the panel.
- **Rule Soft** (#1A2125): the hairline between index lines, one step quieter than Rule.
- **Paper** (#E7EAE8): primary text and the filled mark.
- **Pencil** (#9BA5A6): secondary text, and the path column.
- **Faint** (#667173): tertiary text, column labels, and the hollow mark.

### Named Rules

**The One Spot Rule.** The spot colour appears on the margin mark, the selected pointer, the
focus ring, and the questable segment of the proportion bar. It appears nowhere else. Its rarity
is what makes a detected entry legible at a glance across 25,000 lines.

**The Hairline Rule.** Structure is made from 1px rules and tonal steps. No card, no panel
border, no drop shadow, no coloured accent bar. If something needs to be divided, a rule
divides it.

## Typography

**Display Font:** Archivo (with 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif)
**Body Font:** Archivo (with 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif)
**Label/Mono Font:** Azeret Mono (with 'Cascadia Mono', Consolas, monospace)

**Character:** One grotesque does the reading; a mono does the measuring. Archivo is a
workhorse with flat terminals and a tight fit, and it carries the whole interface without
needing a display face to lean on. Azeret Mono is set only where the content is a path, an id, a
hash, or a figure — the things that are literally measurements and should line up in a column.

### Hierarchy

- **Display** (600, 17px, 1.25, -0.01em): the selected entry's name in the fact panel. The only
  large type in the application.
- **Headline** (600, 15px, 1.3, -0.01em): the application name in the title bar.
- **Title** (500, 13px, 1.4): an entry's name in the index.
- **Body** (400, 12.5px, 1.6): the explanatory sentences — why an entry cannot be quested, what
  a cached copy means. Measure is 42–46 characters, not a wide paragraph.
- **Label** (500, 11px, 0.11em, uppercase): column labels and section headings — SCOPE,
  PLATFORM, COMPOSITION, INDEX.
- **Mono** (400, 11.5px): the registered path, the application id, the age ratings, and every
  number in the interface. Always with `font-variant-numeric: tabular-nums`.

### Named Rules

**The Tabular Rule.** Every number in the interface is set with tabular figures. Counts, ages,
percentages, ids — they are read down a column, and they must line up.

**The Path Rule.** A registered path is set in mono and is never truncated in the fact panel. It
is the mechanism; truncating it hides the thing that matters.

## Layout

Three fixed columns inside a full-height shell: a 232px rail, a flexible index, and a 320px
fact panel, with a 56px title bar across the top. The index scrolls on its own; the rail and
the panel scroll independently. Every column boundary is a 1px rule, not a gap.

Density is high and even: index lines are 52px, the fact panel's rows are 32px, and the rail's
filter rows are 28px. The spacing rhythm is a 4px base with 8, 12, 16, and 20px steps. Space
above a heading is always larger than the space below it.

The index is the only scrolling region in normal use. It renders 120 lines at a time and adds
more as the reader reaches the end, so a 25,000-line catalogue stays responsive without capping
what can be reached.

## Elevation & Depth

This system uses **no shadows**. Depth is tonal: the ground (#0F1214), the surface (#151A1D),
and the raised surface (#1C2327) form three flat levels, and a 1px rule separates regions. The
only light in the interface is the focus ring, which is the spot colour at 2px.

### Named Rules

**The Flat Rule.** Nothing floats. A raised surface means "this is where the reading is", not
"this is above the page". Shadows are decoration, and decoration is not in this system.

## Shapes

Corners are barely rounded: 3px on the search field and the buttons, 2px on cover art and the
filter rows, 1px where a mark needs an edge. Nothing is pill-shaped and nothing is round except
the artwork, which is cropped square. The mark in the margin is an 8px square — filled when the
entry is detected, hollow when it is not — and it is the only shape that carries meaning.

## Components

### Buttons

- **Shape:** barely rounded (3px radius), 1px rule, no fill.
- **Ghost:** transparent ground, secondary text. The refresh control in the title bar.
- **Ghost hover:** the surface tone, full-strength text, the rule steps to the tertiary text
  colour.
- **Disabled:** 40% opacity, and the hover treatment is withdrawn — a disabled control does not
  invite the pointer.
- **Primary:** the spot colour on the cold ground. Reserved for a control that starts a quest,
  which does not exist yet.

### Inputs / Fields

- **Style:** the surface tone, 1px rule, 3px radius, 32px tall, 12px inset on the left for the
  leading search icon.
- **Focus:** the rule steps to the tertiary text colour, and the browser's focus ring — the
  spot colour at 2px — is left in place rather than suppressed.

### Chips

There are no chips. Status is carried by words in the title bar, coloured where it means
something: the catalogue's source and age. No pills, no badges, no tags.

### The index line

The signature component, and the reason the system exists.

- **Shape:** a grid of five columns — a 14px pointer column, a 10px mark column, 36px cover
  art, the name, and the path — separated by a 1px soft rule.
- **Mark:** an 8px square in the margin. Filled in the spot colour when Discord has registered
  an executable for the title, hollow in the faint colour when it has not.
- **Pointer:** a spot-coloured caret replaces the mark's column on the selected line. Selection
  is stated in the margin, like everything else.
- **Path:** the registered path in mono at the tertiary text colour, or an em-dash when the
  entry has no executable.
- **Hover:** the surface tone. **Selected:** the raised surface tone.

### The fact panel

The selected entry printed as a fact pass: a 112px cover, the name, and a table of rows, each
one a label on the left and a value on the right, divided by soft rules. Below the facts, the
entry's **registered executables** are listed, each with the platform it belongs to, its path in
mono, and the control that starts or stops that executable's quest.

### The quest row

The control that runs a quest, and the state it reports.

- **Idle:** a 1px-ruled button reading "Start quest", in the spot colour.
- **Running:** the button is replaced by the stub's process id and an elapsed clock, both in
  tabular figures, with a "Stop" button beside them. The path the stub was written to sits
  beneath in mono.
- **Failed:** the backend's own error code, in mono, above the message. The error appears next
  to the game it happened to, not in a corner of the window.
- **Unavailable:** an entry with no registered executable is given no control at all. The panel
  says why in the place the executables would have been.

### The composition readout

A table, not a headline. Entries, questable, not questable, each a label and a tabular figure,
followed by a 4px proportion bar: the questable share in the spot colour, the rest in the rule
colour. The per-platform split is a second table of the same shape.

## Do's and Don'ts

### Do:

- **Do** put the mechanism in the margin. A detected mark and a visible path are the product.
- **Do** state the catalogue's source and age in the title bar, in those words, every time.
- **Do** set every figure in tabular numerals.
- **Do** divide with 1px rules and let tone carry the rest.
- **Do** show real cover art when the catalogue carries it, and fall back to the mark when it
  does not.

### Don't:

- **Don't** wrap catalogue entries in cards. A 25,000-line index made of cards is unreadable
  and slow.
- **Don't** use the spot colour for anything that is not detection, selection, or focus.
- **Don't** use colour to imply a state the backend has not confirmed. No green "verified"
  badge, ever.
- **Don't** use emoji or unicode glyphs as icons. Every icon in this app is drawn SVG on one
  16-unit grid at one stroke weight.
- **Don't** add a drop shadow, a glow, or a blurred backdrop. This system is flat.
- **Don't** hard-code a count. Every number is derived from the catalogue in hand.
