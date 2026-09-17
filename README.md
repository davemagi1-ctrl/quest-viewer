# Adventurer’s Cards

Adventurer’s Cards is a lightweight Foundry VTT module for displaying text-based
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

**Game Settings → Configure Settings → Module Settings → Adventurer’s Cards**

Use **Quest Decks → Choose Decks** to select any number of Cards decks.

Other settings control:

- Chat posting
- GM popups
- Popup delay
- Chat speaker name

## Quest status (1.6.0)

Open a quest card using View Card. As GM, use the **Quest status** dropdown
below it to choose **Active**, **Completed**, or **Failed**. Players see the
badge in the viewer and in their owned Hand; Adventurer’s Cards only provides the
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

Adventurer’s Cards reads:

- Front: the active Card Face's `text`
- Fallback front: the Card's description
- Back: the Card Back's `text`

## Installation

Place the `quest-viewer` folder in Foundry's `Data/modules/` directory, enable
**Adventurer’s Cards** in Manage Modules, then reload the world.

The ZIP filename is `quest-viewer-v1.9.0.zip`; its inner directory remains
`quest-viewer`, matching the module ID. Existing world settings are retained.

For a GitHub release, attach both this ZIP and the supplied `module.json` to
tag `v1.9.0`. The manifest download URL targets that release and becomes usable
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

## Rules reference cards (1.8.0)

As GM, open **Configure Settings → Adventurer’s Cards → Choose Decks → Create / Update Reference Deck**.
The shared **Rules Reference — 2024** deck contains 40 cards with matching Foundry symbols:

- All 15 conditions.
- Dodge, Hide, Dash, Disengage, Help, Ready.
- Flying, Hovering, Climbing, Swimming, Burrowing, Crawling.
- Concentration, Surprised, Sleeping, Bloodied, Stable, Dying, Dead.
- Burning, Falling, Cover, Lightly Obscured, Heavily Obscured, Heroic Inspiration.

Players open the deck in **Cards** and click **View Card**. New decks grant default Observer
permission. Reference cards explain rules; they do not apply effects to actors or tokens.
Actions, movement, and other rules are labelled separately from conditions. Generic Foundry
markers without a universal 2024 rule, such as Shocked or Frozen, are not presented as official conditions.

For an existing 1.7.0 deck, click the same setup button after updating the module and reloading:
missing references are added, and original book icons are replaced. Existing text, extra faces,
custom artwork, and ownership remain. The original default deck name becomes **Rules Reference — 2024**;
a custom deck name is preserved. Running setup again does not duplicate identified cards.
Cards gain stable reference identifiers, so subsequent renaming is safe. Legacy cards are
recognized by their name or first face name; if both were renamed before upgrading, they cannot
be identified automatically. Deleted references are restored when setup is run again.

The deck is not automatically selected for dealing. Existing quest deck selections and automatic
popup/chat behavior are unchanged. Reference cards in owned Hands can also be viewed.
The icon update affects the shared deck; previously dealt copies retain their own artwork.

Rules are adapted from SRD 5.2.1 under CC BY 4.0. Source details are in each card and
[RULES-LICENSE.md](RULES-LICENSE.md). This is a reference selection, not every action, spell,
class feature, or possible effect in the game.

Validation: 86 browser checks passed using Foundry 14.365 Hand and Deck templates with simulated
documents and hooks. Tests include legacy deck upgrades, custom-art preservation, no duplicate
updates, Observer access, and existing quest behavior. Icon paths, previews, syntax, and ZIP
structure were checked. Live multiplayer testing remains.

## Quest emblem and new name (1.9.0)

Quest Viewer is now **Adventurer’s Cards**. The internal module ID, URLs, flags, and settings keys remain `quest-viewer` for compatibility.

As GM, open **Configure Settings → Adventurer’s Cards → Choose Decks**. Check your quest decks,
then click **Apply Quest Emblem to Checked Decks**. This applies a parchment-scroll and wax-seal
image to standard playing-card icons on source-card faces and deck covers. Text, card backs,
extra faces, and custom artwork are preserved. The conditions/reference deck is always excluded,
even when checked; flagged reference cards within another deck are also excluded.

The button uses the currently checked decks; it does not change saved deck-selection settings.
Use **Save Deck Selection** separately if you also want to change automatic popup sources.
Existing dealt copies retain their current images. Future deals use the updated source faces.
Run the button again after adding new quest cards. The emblem is bundled as an SVG with the
module; no external artwork service is required.

Validation for 1.9.0: 94 browser checks, including strict reference-deck exclusion and preserving
custom artwork. Live-world multiplayer testing remains.
