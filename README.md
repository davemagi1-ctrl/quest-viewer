# Quest Viewer

Quest Viewer is a lightweight Foundry VTT module for displaying text-based
Cards as readable quest cards.

## Features

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

## Player permissions

A player must have **Owner** permission on the Hand receiving the card in order
to receive the automatic popup.

## Card content

Quest Viewer reads:

- Front: the active Card Face's `text`
- Fallback front: the Card's description
- Back: the Card Back's `text`

## Installation

Place the `quest-viewer` folder in Foundry's `Data/modules/` directory, enable
**Quest Viewer** in Manage Modules, then reload the world.
