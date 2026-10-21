---
name: discord-auto-quest
description: A printed register of the quests Discord is running, and how far along each one is.
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
  register-row:
    backgroundColor: "{colors.ground}"
    textColor: "{colors.ink}"
    height: "34px"
---

# Design System: discord-auto-quest

## Overview

**Creative North Star: "The Register"**

This product is a ledger, and the system is built like one. A working register is a printed
thing: a ground, a set of rules, a column of names, and a column of figures that line up. The
app takes that grammar and puts it on a screen where the list is live, where it changes, and
where most of it cannot be worked at all without leaving the app. The honesty of the page depends
on the page looking like it is reporting rather than selling.

That is the whole thesis. A list of quests, of which most cannot be worked until the user
accepts them in Discord, is a document with a marginal annotation on every line. The task beside
the title says what has to be done. The figures at the end of the line say what it gives and when
it goes. Nothing is a tile with a rounded corner and a play button; the mechanism is printed
beside the name, because the mechanism is the product.

The world is a printed register rendered as ink on a cold ground. The type is a workhorse
grotesque with a slightly technical mono for the figures — a reference typeface and a measurement
typeface, the pairing you get on the printed page. Depth is tonal: a hairline separates, a
surface lifts, and there are no shadows at all. The single spot colour appears on the one
control that starts the work, and nowhere else.

**Key Characteristics:**

- A column of figures that lines up, because every figure is a measurement.
- Hairlines divide. Boxes and cards do not.
- One spot colour, on one thing.
- Every figure is tabular.
- The page states what needs doing before it states anything else.

## Colors

A cold ink ground with one printer's spot colour, and two state colours that only appear when
they mean something.

### Primary

- **Spot Cyan** (#4FC3B0): the one control that starts the work, and the focus ring. It is the
  only colour on the page that says "this one is the thing to press".

### Neutral

- **Cold Ground** (#0F1214): the page and the register background.
- **Surface** (#151A1D): the raised band a hovered row takes.
- **Surface Raised** (#1C2327): the selected row.
- **Rule** (#232C31): the 1px hairline that divides the header, the band, and the section rules.
- **Rule Soft** (#1A2125): the hairline between register rows, one step quieter than Rule.
- **Paper** (#E7EAE8): primary text.
- **Pencil** (#9BA5A6): secondary text.
- **Faint** (#667173): tertiary text, section headings, and the figures that are not in play.

### Named Rules

**The One Spot Rule.** The spot colour appears on the control that starts the work and on the
focus ring. It appears nowhere else. Its rarity is what makes the one thing to press legible on
a page that is otherwise all ink and rules.

**The Hairline Rule.** Structure is made from 1px rules and tonal steps. No card, no panel
border, no drop shadow, no coloured accent bar. If something needs to be divided, a rule
divides it.

## Typography

**Display Font:** Archivo (with 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif)
**Body Font:** Archivo (with 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif)
**Label/Mono Font:** Azeret Mono (with 'Cascadia Mono', Consolas, monospace)

**Character:** One grotesque does the reading; a mono does the measuring. Archivo is a
workhorse with flat terminals and a tight fit, and it carries the whole interface without
needing a display face to lean on. Azeret Mono is set only where the content is a figure — the
things that are literally measurements and should line up in a column.

### Hierarchy

- **Display** (600, 17px, 1.25, -0.01em): the selected quest's name. The only large type in the
  application.
- **Headline** (600, 15px, 1.3, -0.01em): the application name in the title bar.
- **Title** (500, 13px, 1.4): a quest's name in the register.
- **Body** (400, 12.5px, 1.6): the explanatory sentence in the band, and a quest's task.
- **Label** (500, 11px, 0.11em, uppercase): section headings — ACCEPTED, ON OFFER.
- **Mono** (400, 11.5px): the progress figure, the reward, the end date, and every number in
  the interface. Always with `font-variant-numeric: tabular-nums`.

### Named Rules

**The Tabular Rule.** Every number in the interface is set with tabular figures. Progress,
rewards, durations and dates are read down a column, and they must line up.

**The Figure Rule.** A figure is never truncated and never dressed. The progress is a figure, the
reward is a figure, the date is a figure; the app prints them and lets them line up.

## Layout

One full-height column. A 56px title bar across the top, a band beneath it carrying the one
action and the one sentence that says what needs doing, and then the register itself, which is
the only scrolling region in normal use. A quiet rule and the colophon close the page.

Density is high and even: register rows are 34px, and the spacing rhythm is a 4px base with 8,
12, 16, and 20px steps. Space above a heading is always larger than the space below it.

The register is divided into two sections — the quests that have been accepted, and the quests on
offer — each with a heading and a count, separated by a rule. A section is a list, and a list is
read down; the columns are fixed so the figures line up between the two sections.

## Elevation & Depth

This system uses **no shadows**. Depth is tonal: the ground (#0F1214), the surface (#151A1D),
and the raised surface (#1C2327) form three flat levels, and a 1px rule separates regions. The
only light in the interface is the focus ring, which is the spot colour at 2px.

### Named Rules

**The Flat Rule.** Nothing floats. A raised surface means "this is where the reading is", not
"this is above the page". Shadows are decoration, and decoration is not in this system.

## Shapes

Corners are barely rounded: 3px on the buttons, 1px where a rule needs an edge. Nothing is
pill-shaped and nothing is round. A mark in the margin earned its place once, on a register of
twenty-five thousand games, where the eye needed to sort usable from unusable at a glance. This
register is twenty-one rows in two labelled sections, and the labels do that work. The mark would
have repeated them, so it is gone.

## Components

### Buttons

- **Shape:** barely rounded (3px radius), 1px rule, no fill.
- **Ghost:** transparent ground, secondary text. The stop control.
- **Ghost hover:** the surface tone, full-strength text, the rule steps to the tertiary text
  colour.
- **Disabled:** 40% opacity, and the hover treatment is withdrawn — a disabled control does not
  invite the pointer.
- **Primary:** the spot colour on the cold ground. One control starts the work, and it is the
  only one that is filled.

### Inputs / Fields

- **Style:** the surface tone, 1px rule, 3px radius, 32px tall.
- **Focus:** the browser's focus ring — the spot colour at 2px — is left in place rather than
  suppressed.

### Chips

There are no chips. Status is carried by words, coloured where it means something: the client's
state in the title bar, and the sentence in the band. No pills, no badges, no tags.

### The band

The line under the title bar, and the one place the application says what needs doing now.

- **One sentence and one control.** Never two sentences, never two controls.
- **What it says** is the most urgent thing: a quest that has been finished and is waiting to be
  claimed; a quest that cannot count without the user; the work running; or the instruction to
  accept a quest and work it.
- **The control** is the one action: work the quests, or stop. It changes between them and is
  never both at once.

### The register row

The signature component, and the reason the system exists.

- **Shape:** a grid of five columns — the quest's name, the task it takes, the progress, the
  reward, and the day it ends — separated by a 1px soft rule.
- **Task:** what has to be done, in words: "Play on desktop", "Watch a video". When a quest
  offers several ways, the first is printed; the alternatives are the same job.
- **Progress:** the count, in mono, as `612/900s`. An accepted quest that has not been started
  reads `0/1s`.
- **Reward:** the orbs, in mono. A quest with no orb reward reads an em dash.
- **Ends:** the day, in mono. A quest with no end date reads an em dash.
- **Nothing else.** No state label, no badge, no bar, no icon. The section heading says which
  list a row is in, and the figures say everything else.

## Do's and Don'ts

### Do:

- **Do** print the mechanism beside the name. The task and the figures are the product.
- **Do** set every figure in tabular numerals.
- **Do** divide with 1px rules and let tone carry the rest.
- **Do** say what needs doing, once, in one sentence.

### Don't:

- **Don't** wrap a quest in a card. A register made of cards is a gallery, not a register.
- **Don't** print the same fact twice. A progress bar beside a progress figure says it again.
- **Don't** use the spot colour for anything that is not the one action, or the focus ring.
- **Don't** use colour to imply a state the client has not confirmed.
- **Don't** use emoji or unicode glyphs as icons. Every icon in this app is drawn SVG on one
  16-unit grid at one stroke weight.
- **Don't** add a drop shadow, a glow, or a blurred backdrop. This system is flat.
- **Don't** hard-code a count. Every number is read from the client.
