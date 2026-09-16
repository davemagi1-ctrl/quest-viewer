# Quest Viewer

Quest Viewer is a lightweight Foundry VTT module for displaying text-based
Cards as readable quest cards.

## Features

- Reopen configured quest cards already in your Hand using **View Card**.
- Choose multiple quest decks using a checkbox-based deck selector.
- Automatically opens a readable parchment-style card when a configured card
  is dealt to a player-owned Hand.
- Posts the card's front text to chat, if enabled.
- Click the displayed card to flip between Face Text and Back Text.
- No card artwork is required.
- Configurable popup delay.
- Optional GM popup.
- Configurable chat speaker name.
- Keyboard-accessible card flipping with Enter or Space.
- Includes migration support for the older comma-separated deck-name setting.

## Configuration

Open:

**Game Settings → Configure Settings → Module Settings → Quest Viewer**

Use **Quest Decks → Choose Decks** to select any number of Cards decks.

Other settings control:

- Chat posting
- GM popups
- Popup delay
- Chat speaker name

## Quest status (1.6.0)

Open a quest card using View Card. As GM, use the **Quest status** dropdown
below it to choose **Active**, **Completed**, or **Failed**. Players see the
badge in the viewer and in their owned Hand; Quest Viewer only provides the
editing control to GMs. Existing cards start as Active without a migration.

Status is stored in `flags.quest-viewer.status` on that specific card.
Separate dealt copies have independent progress. Moving a card carries its
flags according to Foundry's normal card transfer behavior; returning a card
does not synchronize its status to the original source-deck card. Re-dealing
uses the original card's data. This is per-card tracking, not a shared quest log.

Open viewers update when Foundry sends a card update. Status changes do not
post to chat or change automatic popup settings. Chat history remains unchanged.

## Player permissions

A player must have **Owner** permission on the Hand receiving the card in order
to receive the automatic popup.

## Reopening cards (1.4.0)

Open your Hand from the Cards sidebar and click **View Card** beside a quest
card from a selected deck. The same parchment viewer opens, with front/back
flipping. Reopening does not post another chat message, deal or modify the
card, or open a popup for other users.

Players need Owner permission on the Hand. GMs can reopen cards manually even
when **Show Automatic Popup to GM** is disabled. Cards from unselected decks,
ordinary source decks, and piles do not receive this button. The shared Conditions deck is an exception (see below). Existing deck selections
and automatic popup/chat settings are preserved. After changing deck selection,
close and reopen an already-open Hand to refresh its buttons.

## Card back design (1.6.0)

The reverse uses dark green leather styling and gold ornamentation. Cards without back text show a compass seal and QUEST title. Custom back text is preserved in cream on the dark background. All ornamentation uses CSS; no external assets are needed.

## Card content

Quest Viewer reads:

- Front: the active Card Face's `text`
- Fallback front: the Card's description
- Back: the Card Back's `text`

## Installation

Place the `quest-viewer` folder in Foundry's `Data/modules/` directory, enable
**Quest Viewer** in Manage Modules, then reload the world.

The ZIP filename is `quest-viewer-v1.7.0.zip`; its inner directory remains
`quest-viewer`, matching the module ID. Existing world settings are retained.

For a GitHub release, attach both this ZIP and the supplied `module.json` to
tag `v1.7.0`. The manifest download URL targets that release and becomes usable
after those assets are published.

## Validation for 1.6.0

JavaScript syntax and 57 browser-based checks passed using the installed
Foundry 14.365 Hand template and simulated Foundry documents/hooks. Checks
cover both selected decks, ownership, stale cards, repeated rendering,
front/back flipping, and automatic popup/chat behavior. The pre-existing
settings, migration, and automatic deal code are unchanged. The viewer now attaches flip handlers through the DialogV2 render event. Source-deck matching now uses Foundry Cards documents directly, fixing the uuid.split error. Regression tests also cover renamed cards and duplicate names across decks.

This package has not been tested in a running Foundry world; v13's legacy
render hook was simulated. The existing v13/v14 compatibility declaration is
retained. Before using in a session, open a player-owned Hand containing a
configured card as that player, click View Card, flip it, and confirm no new
chat post appears. Then deal another card to check your automatic preferences.

## Condition reference cards (1.7.0)

As GM, open **Configure Settings → Quest Viewer → Choose Decks**, then click
**Create / Open Conditions Deck**. This creates **Conditions — 2024** in the
Cards sidebar with all 15 conditions. Default Observer permission lets players
read it without granting editing access. Existing deck selections are unchanged.

Players open **Cards → Conditions — 2024**, then click **View Card** beside a
condition. No dealing is required. These reference cards explain the effects;
they do not apply conditions to actors or tokens. They have no quest status or
click-to-flip control, so the text and source links can be read normally.

Clicking the setup button again opens the existing deck, preserving any GM edits
and permission changes. To regenerate the original cards, delete that reference
deck first and use the setup button again. Creating the deck posts no chat and
does not select it for automatic dealing. If desired, select it like another deck
for the existing deal behavior. Condition cards in owned Hands also have View Card.

Rules are adapted from SRD 5.2.1 (2024 fifth-edition rules). Each card includes
source and license details; see [RULES-LICENSE.md](RULES-LICENSE.md).

Validation for 1.7.0: 77 browser checks passed using installed Foundry 14.365 Hand and Deck templates with simulated documents and hooks, including observer access, stale controls, repeated setup, card content, and existing quest behavior. Live multiplayer testing in a running world remains to be done.
