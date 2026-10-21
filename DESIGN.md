---
name: discord-auto-quest
description: The quests Discord is running, drawn as the cards Discord draws them, in this project's own ink.
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
  quest-blue: "#7c9cff"
  quest-green: "#3ba55d"
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
  card: "6px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "20px"
components:
  button-ghost:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-secondary}"
    rounded: "{rounded.medium}"
    padding: "8px 12px"
  button-primary:
    backgroundColor: "{colors.spot}"
    textColor: "{colors.ground}"
    rounded: "{rounded.medium}"
    padding: "8px 12px"
  quest-card:
    backgroundColor: "{colors.surface-raised}"
    rounded: "{rounded.card}"
    border: "1px {colors.rule}"
---

# Design System: discord-auto-quest

## Overview

**Creative North Star: "The Card"**

This product shows a list of things the user can act on, and every one of those things already
has a face: Discord draws its quests as cards, with the game's own artwork, the publisher's name,
the reward and a progress ring. A separate, invented shape for the same information would be
worse in every way — it would hide the artwork, it would take a second language to learn, and it
would look like a different application from the one it lives inside.

So the card is Discord's card. The banner is Discord's banner. The wordmark over it is Discord's
wordmark. The publisher, the end date, the reward, the multiplier, the ring and the buttons are
Discord's, read out of Discord's own quest data at run time.

What is this project's is the ink. The ground, the type, the spot colour that marks the one
control that starts the work, and the discipline about what the application says. The card is
Discord's; the application around it is ours, and it never claims a quest is finished unless
Discord says it is.

**Key Characteristics:**

- Real artwork, at the size Discord draws it, never a placeholder.
- One accent per card, and it is on the data: the ring, the reward, the check.
- Every figure is a measurement, and it lines up.
- Two registers, and the one that can be worked comes first.
- Nothing on the card is invented. Every word on it came out of Discord.

## Colors

A cold ink ground with one printer's spot colour, and two colours that only appear where Discord
puts them.

### Primary

- **Spot Cyan** (#4FC3B0): the one control that starts the work, and the focus ring.
- **Quest Blue** (#7C9CFF): the quest's own name, where Discord puts it.
- **Quest Green** (#3BA55D): the check beside a publisher's name, and the filled arc of the ring.

### Neutral

- **Cold Ground** (#0F1214): the page and the card's frame.
- **Surface** (#151A1D): the card's body.
- **Surface Raised** (#1C2327): the band and the footer's rule.
- **Rule** (#232C31): the card's edge, and the rule under the buttons.
- **Rule Soft** (#1A2125): the quiet rules.
- **Paper** (#E7EAE8): primary text.
- **Pencil** (#9BA5A6): secondary text.
- **Faint** (#667173): tertiary text, the end date, and the orb glyph.

### Named Rules

**The One Spot Rule.** The spot colour appears on the control that starts the work and on the
focus ring. It appears nowhere else. Its rarity is what makes the one thing to press legible on a
page that is otherwise all ink, artwork and rules.

**Discord's Colours Are Not Ours.** The quest blue and the quest green belong to Discord's card,
and they appear only on the parts Discord puts them on. They are never used for anything this
application says.

## Typography

**Display Font:** Archivo (with 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif)
**Body Font:** Archivo (with 'Segoe UI Variable Text', 'Segoe UI', system-ui, sans-serif)
**Label/Mono Font:** Azeret Mono (with 'Cascadia Mono', Consolas, monospace)

**Character:** One grotesque does the reading; a mono does the measuring, and only where a figure
has to line up with the figure under it. The card is mostly artwork and names, so the type is
quiet and the pictures are loud.

### Hierarchy

- **Display** (600, 17px, 1.25, -0.01em): the application name in the title bar.
- **Headline** (600, 15px, 1.3, -0.01em): a section's name — "Accepted Quests".
- **Title** (500, 13px, 1.4): a quest's name, in Discord's own capitals and blue.
- **Body** (400, 12.5px, 1.6): the publisher's line and the card's description.
- **Label** (500, 11px, 0.11em, uppercase): reserved for the parts of the shell that are not a
  card.
- **Mono** (400, 11.5px): a figure that has to line up — the version, and the state readout.

### Named Rules

**The Tabular Rule.** Every figure is set with tabular figures. Progress, rewards, durations and
dates are read down a column, and they must line up.

**The Figure Rule.** A figure is never truncated and never dressed. The reward is a figure, the end
date is a figure, the percentage is a figure; the application prints them and lets them line up.

**No Monospace for Words.** The mono face is for figures and for the code-like. A word set in mono
reads as a label of something, and nothing on this screen is that.

## Layout

One full-height column. A 56px title bar across the top, a band beneath it carrying the one
action and the one sentence that says what needs doing, and then the cards, which are the only
scrolling region in normal use. A quiet rule and the colophon close the page.

**Two registers, and the order is the product.** The quests the user has accepted come first,
because those are the ones that can be worked. The quests on offer follow, because those are the
ones they might accept. Each register has a heading and a count, and the count is in mono because it
is a figure.

**The grid.** Cards are laid on one grid with one gutter — 16px, everywhere. The column count is
chosen by the width, not by the data: as many cards as fit at a minimum of 19rem, and no more. A
register with one card left over in a row of three has a hole in it, so a lone card spans.

**The card's own proportions.** The banner is 16:7. The reward row is a 64px square on the left
and the words on the right. The buttons are a pair across the foot, split evenly.

## Elevation & Depth

This system uses **no shadows**. Depth is tonal: the ground, the surface and the raised surface are
three flat levels, and a 1px rule separates regions. The only light in the interface is the focus
ring, which is the spot colour at 2px.

### Named Rules

**The Flat Rule.** Nothing floats. A card is a surface on the ground, and it is separated by its
edge, not by a shadow.

**The Scrim Rule.** The one gradient in the system is the neutral scrim under a wordmark drawn
over artwork, because artwork does not always leave room for a word. It is a scrim and nothing
else: no gradient on a button, no gradient in a fill, no gradient behind text that is not on a
picture.

## Shapes

The card is 6px round. Buttons are 3px. Nothing is a pill and nothing is round. The artwork keeps
its own square corners, because it is artwork.

### Components

**The card.** Discord's card, drawn from Discord's own data.

- **The banner.** `assets.questBarHero`, at 16:7, cropped to fill. The wordmark
  (`assets.logotypeDark`) sits over its lower left, on a neutral scrim.
- **The publisher and the end date.** "Promoted by ✓ NC" on the left, "Ends 10/12" on the right,
  in tertiary ink.
- **The reward row.** A 64px square on the left: the game's icon (`assets.gameTileDark`), or a
  progress ring when the quest has counted something. On the right: the quest's own name in
  Discord's capitals and blue, then "Claim ◈ 200 Orbs" with the orb glyph, then the multiplier
  badge — "Unlock 1.2x" — when a premium member gets more. Then the sentence that says what the
  quest takes.
- **The buttons.** Discord's own call to action on the left, in the card's own surface colour; the
  application's own action on the right, in Discord's blue.

**The progress ring.** A thin arc in the quest's green, on a grey track, with the percentage in the
middle. The percentage is the quest's own progress, read from Discord.

**The buttons.** Flat, one fill colour, one corner radius, decided once. The ghost button is the
card's surface; the primary is Discord's blue or this project's spot colour.

## Do's and Don'ts

### Do:

- **Do** show the artwork. It is the whole reason a card is better than a row.
- **Do** take every word on the card from Discord — the publisher, the reward, the call to action.
- **Do** set every figure with tabular figures.
- **Do** put the quests that can be worked first.
- **Do** say what needs doing, once, in one sentence.

### Don't:

- **Don't** draw a card that is not Discord's. A card with the artwork left out is a worse card.
- **Don't** repeat a fact. The reward is on the card once.
- **Don't** use the spot colour for anything but the one action and the focus ring.
- **Don't** use colour to imply a state Discord has not confirmed.
- **Don't** use emoji or unicode glyphs as icons. Every icon here is drawn SVG.
- **Don't** add a drop shadow, a glow, or a blurred backdrop.
- **Don't** hard-code a count. Every number is read from the client.
