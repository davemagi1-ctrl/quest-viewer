# Adventurer’s Cards

<img src="assets/quest-emblem.svg" width="96" height="96" alt="Quest scroll and wax seal">

Readable quest cards and 2024 rules references for Foundry VTT. Formerly **Quest Viewer**.

[Latest release](https://github.com/davemagi1-ctrl/quest-viewer/releases/latest) · [Changelog](CHANGELOG.md) · [Report a problem](https://github.com/davemagi1-ctrl/quest-viewer/issues)

## Features

- Parchment quest cards with front/back text, mouse and keyboard flipping, and no artwork required.
- Multiple source decks, automatic popups when dealt to player-owned Hands, and optional chat posts.
- **View Card** to reopen quests from a player's Hand without repeating chat messages.
- GM-controlled **Active**, **Completed**, and **Failed** status badges.
- A shared scroll-and-wax-seal quest emblem that preserves custom artwork and excludes reference cards.
- An optional shared deck of **40 rules reference cards** covering 2024 conditions, actions, movement, and combat.

## Install or update

In Foundry's **Add-on Modules → Install Module**, paste this manifest URL:

```text
https://github.com/davemagi1-ctrl/quest-viewer/releases/latest/download/module.json
```

Enable **Adventurer’s Cards** in your world's **Manage Modules**, then reload the world.
Existing installations can use Foundry's module updater.

For manual installation, download the module ZIP from the [latest release](https://github.com/davemagi1-ctrl/quest-viewer/releases/latest), then extract its `quest-viewer/` folder into `Data/modules/`. Use the attached module ZIP, rather than GitHub's automatically generated source archive.

The package ID and folder remain `quest-viewer` so existing settings and update links continue to work. Current release: **1.9.0**. The manifest declares Foundry **13 minimum** and **14 verified**; see testing notes below.

## Set up quest cards

1. Open **Game Settings → Configure Settings → Module Settings → Adventurer’s Cards**.
2. Under **Quest Decks**, click **Choose Decks**, check your source decks, and choose **Save Deck Selection**.
3. Give each receiving player **Owner** permission on their Hand.
4. Deal a card from a selected deck to that Hand.

Settings control chat posting, automatic GM popups, popup delay, and the chat speaker name.
Older deck-name settings are migrated automatically.

The viewer reads the active face's text, falling back to the card description, and uses the card back's text for the reverse. The reverse has dark green and gold styling; empty back text displays the default compass seal.

### Reopen and flip

Players open their Hand in **Cards** and click **View Card** beside a configured quest.
Click the displayed card, or focus it and press **Enter** or **Space**, to flip it.

Reopening is local: it does not deal a card, repeat chat posts, or open another player's viewer.
GMs can reopen cards even when automatic GM popups are disabled. Ordinary source decks and piles do not receive the quest button; the shared reference deck has its own direct viewing support.
After changing deck selection, close and reopen an existing Hand window to refresh its buttons.

### Quest status

As GM, open a quest and use **Quest status** to choose **Active**, **Completed**, or **Failed**.
Players see the badge in the viewer and their owned Hand. Existing cards default to Active.

Status belongs to each individual card. Separate dealt copies track progress independently; returning a card does not copy its status back to the source deck. Open viewers refresh on card updates. Status changes do not post to chat.

### Apply the quest emblem

In **Choose Decks**, check your quest decks and click **Apply Quest Emblem to Checked Decks**.

The emblem replaces default playing-card images on source-card faces and deck covers. Custom artwork, text, and backs are preserved. **The conditions/rules reference deck is always excluded, even when checked**, and flagged reference cards in other decks are skipped.

This button uses the current checkboxes without saving deck-selection settings. Use **Save Deck Selection** separately to change automatic popup sources.
Already-dealt copies keep their images; future deals inherit the source images. Run the button again for newly added quest cards.

## Rules Reference — 2024

As GM, open **Choose Decks → Create / Update Reference Deck**.
Players can open the shared deck in **Cards** and click **View Card**, without needing cards dealt to them.
New reference decks grant default **Observer** access.

| Category | Included references |
| --- | --- |
| Conditions | All 15 conditions |
| Actions | Dodge, Hide, Dash, Disengage, Help, Ready |
| Movement | Flying, Hovering, Climbing, Swimming, Burrowing, Crawling |
| Combat states | Concentration, Surprised, Sleeping, Bloodied, Stable, Dying, Dead |
| Other rules | Burning, Falling, Cover, Lightly Obscured, Heavily Obscured, Heroic Inspiration |

These cards explain rules; they do not apply actor or token effects. Actions and movement are labelled separately from conditions. Reference cards use a single-page layout without quest status or flipping, and can also be viewed in owned Hands.

### Update an existing reference deck

Run **Create / Update Reference Deck** after updating the module. It adds missing references and replaces original book icons while preserving edited text, extra faces, custom artwork, and permissions.
The old default name **Conditions — 2024** becomes **Rules Reference — 2024**; custom names remain.

Repeated setup does not duplicate identified cards, but it restores deleted references.
Legacy cards are identified by card or first-face name; if both were changed before the upgrade, setup cannot recognize them automatically. Updated cards have stable identifiers so later renaming is safe.
Previously dealt copies retain their own artwork. Reference setup does not change your selected quest decks.

Rules are adapted from SRD 5.2.1 under CC BY 4.0, with attribution in each reference card and [RULES-LICENSE.md](RULES-LICENSE.md). This is a selected reference collection, not every possible game rule or effect.

## Testing and support

Version 1.9.0 passed **94 automated browser checks** using Foundry 14.365 templates with simulated documents and hooks. Checks cover quest viewing, flipping, ownership, multiple decks, automatic behavior, reference updates, and quest-emblem exclusions. Syntax, icon appearance, and ZIP structure were also checked.

Full live multiplayer testing has not been completed; the Foundry 13 legacy render hook was simulated.
Before a session, test viewing and flipping as a player, then deal a card to confirm your popup/chat settings.

When [reporting a problem](https://github.com/davemagi1-ctrl/quest-viewer/issues), include your module, Foundry, and game-system versions, whether you were GM or player, steps to reproduce, and any relevant error message. Remove private world data from screenshots or logs.

## License

Module code: [MIT](LICENSE). Adapted rules content: [CC BY 4.0 attribution](RULES-LICENSE.md).
