# Changelog

## 1.9.0
- Renamed the displayed module to Adventurer’s Cards; internal quest-viewer ID and saved settings remain compatible.
- Added a bundled scroll-and-wax-seal quest emblem and a GM button to apply it to checked quest decks.
- Changes only standard playing-card icons on source faces and deck covers, preserving custom artwork, text, and backs.
- Explicitly excludes the conditions/reference deck and reference cards; previously dealt copies are unchanged.

## 1.8.0
- Replaced placeholder books with matching Foundry symbols on new reference cards.
- Expanded to 40 cards with actions, movement, combat states, hazards, and visibility rules, including Hide, Dodge, Flying, and Hovering.
- Labelled each reference by rule type; added the card icon to the viewer.
- Added an update workflow that fills missing references and replaces legacy book icons while preserving edited text, extra faces, custom artwork, and permissions.
- Existing default deck name becomes Rules Reference — 2024; custom names remain.
- Preserved all existing quest behavior.

## 1.7.0
- Added a GM setup button for a shared Conditions — 2024 reference deck containing all 15 conditions.
- Players with Observer access can open condition cards directly from the deck without dealing.
- Condition cards use a readable reference layout without quest badges or flipping.
- Includes revised Exhaustion rules and expanded Incapacitated reminders, adapted from SRD 5.2.1 with CC BY 4.0 attribution.
- Preserves quest deck selections, statuses, automatic popups, and chat behavior.

## 1.6.0
- Added Active, Completed, and Failed badges to the viewer and configured cards in owned Hands.
- GMs can change status from a dropdown below the card; existing cards default to Active.
- Saves status on each card using a module flag. Separate copies have independent progress.
- Open viewers refresh when their card updates and close when it is removed.
- Status changes do not post chat messages or change the visible side.
- Retains the published 1.5.0 card-back design; the cancelled custom-back alteration is not included.

## 1.5.0
- Added a dark green leather-style card back with gold borders and a compass seal.
- Default backs display QUEST and "A tale yet to be told"; custom back text remains visible in the new theme.
- Drawn entirely with CSS, with no external artwork, fonts, or downloads required.
- Preserves the parchment front, flipping, View Card controls, and automatic popup/chat behavior.

## 1.4.2
- Fixed inactive Click to flip by attaching handlers to the DialogV2 render event.
- Preserve the visible side after a dialog rerender and keyboard focus after flipping.
- Corrected the dialog test double to emit Foundry's render event instead of invoking an unsupported constructor callback.
- Preserved source-deck matching, View Card controls, and automatic popup/chat behavior.

## 1.4.1
- Fixed `uuid.split is not a function` when Foundry supplies a Cards document as a card's source/origin.
- Match the source deck directly; only pass actual UUID strings to fromUuid.
- Preserve deck ID and UUID support for older/custom workflows.
- Prevent cards with a known unselected source from matching a selected deck by name.
- Added regression coverage for document origins, renamed cards, and duplicate names.

## 1.4.0
- Added a View Card button beside configured quest cards already in owned Hands.
- Reuses the existing parchment viewer and front/back flipping without repeating chat posts.
- Allows GM manual viewing independently of the automatic GM popup preference.
- Rechecks hand ownership, card presence, and deck selection when clicked.
- Preserves automatic dealing behavior, multi-deck settings, and legacy migration.
- Packages the module in a top-level quest-viewer directory.

## 1.3.0
- Rebuilt the Deck Selection settings window with Foundry's ApplicationV2 framework.
- Fixed the issue where Foundry detected the deck but the Handlebars UI rendered an empty list.
- Removed the deprecated FormApplication/V1 dependency.
- Verified the selector logic against the user's Foundry 14.365 / D&D5e 5.3.3 console output.


## 1.2.3
- Reworked the deck selector to populate from the live `game.cards` collection after the settings window renders.
- No longer depends on FormApplication template context for deck discovery.
- Uses multiple Collection access fallbacks for Foundry v13/v14 compatibility.
- Excludes Hands and Piles while allowing any other Card Stack to be selected.
- Added stronger console diagnostics.


## 1.2.2
- Fixed deck selector rendering by making settings data synchronous.
- Removed reliance on the Handlebars `checked` helper.
- Added robust Cards stack type detection and a compatibility fallback.
- Added detailed console diagnostics for detected Card Stacks.


## 1.2.1
- Fixed the deck selector showing an empty list on some Foundry installations.
- Deck discovery now reads `game.cards.contents` explicitly.
- Made selector data loading asynchronous for better FormApplication compatibility.
- Added console diagnostics when opening the deck selector.

## 1.2.0
- Added checkbox-based multiple deck selection.
- Added popup delay, chat speaker name, and GM popup settings.
- Added keyboard-accessible card flipping.
