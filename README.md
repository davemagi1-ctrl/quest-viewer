# Adventurer’s Cards

<img src="assets/quest-emblem.svg" width="96" height="96" alt="Quest scroll and wax seal">

Readable quest cards and 2024 rules references for Foundry VTT. Formerly **Quest Viewer**.

[Latest release](https://github.com/davemagi1-ctrl/quest-viewer/releases/latest) · [Changelog](CHANGELOG.md) · [Report a problem](https://github.com/davemagi1-ctrl/quest-viewer/issues)

## Features

- GM **Card Creator** with a preview, objectives, rewards, and optional back text.
- Parchment quest cards with front/back text, mouse and keyboard flipping, and no artwork required.
- Multiple source decks, automatic popups when dealt to player-owned Hands, and optional chat posts.
- **View Card** to reopen quests from a player's Hand without repeating chat messages.
- **Active**, **Completed**, and **Failed** status controlled by GMs and Hand owners, with objective checkboxes and saved notes.
- Automatic deck-to-Hand content updates that preserve each copy's progress.
- Selective dealing, optional section headings, and font/size choices.
- **Show Card to Players** to share the visible side with all connected players or a selected group.
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

The package ID and folder remain `quest-viewer` so existing settings and update links continue to work. Current release: **1.13.1**. The manifest declares Foundry **13 minimum** and **14 verified**; see testing notes below.

## Create a quest card

As GM, open the **Cards sidebar** on the right and click **Create Quest Card**, directly below the existing creation controls. The button is also available in the popped-out Cards directory. Settings → Adventurer’s Cards and Choose Decks retain their shortcuts.

Choose an existing destination deck and enter a title. Add a description, objectives (one per line), rewards, and optional back text. Use plain text; line breaks are preserved. **Preview Front** lets you check the card before saving. Click **Create Card** to save it and open its deck.

New cards receive the quest emblem and Active status. Objectives become checkboxes; start a line with `[x]` to check it initially or `[ ]` to leave it unchecked. Objectives/Rewards headings are hidden by default; enable **Show Objectives / Rewards headings** if wanted. Choose Classic serif, Clear sans-serif, or Monospace and Small, Normal, or Large text. Blank back text keeps the decorative quest back. Back text is readable by players who can flip the card, so do not use it for GM-only notes.

The creator excludes conditions/rules reference decks and does not modify deck selections, deal cards, or post to chat. Configure the destination in **Choose Decks** to enable quest viewing and automatic popups. If there are no eligible decks, create a Card Stack of type **Deck** in Foundry's Cards sidebar first. You can edit saved cards through Foundry's normal card editor.

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
GMs can reopen cards even when automatic GM popups are disabled, and can open configured quest cards directly from selected source decks. Players use their owned Hands; the shared reference deck has its own direct viewing support. Piles do not receive the quest button.
After changing deck selection, close and reopen an existing Hand window to refresh its buttons.

### Show Card to Players

As GM, open a quest or rules reference with **View Card**, then click **Show Card to Players**.
All connected players start selected; uncheck anyone who should not see the card, then click **Show Card**.

Only the currently visible side is sent. Players get a read-only popup and a private chat copy, without needing ownership of the source card. The reverse is not included and the shared copy cannot be flipped or edited. Reference cards share their single reference page.

Sharing does not deal cards, change deck permissions, or write status, checks, or notes. The GM viewer stays open after sharing or cancelling. Offline players are excluded; share again after they connect. Shared content is a snapshot. When a player has one matching owned Hand copy, the popup and chat display use that copy's status and checks, instead of the source-deck defaults. If several matching copies are owned and no specific Hand was shared, the source snapshot is shown. Notes are never included in shared snapshots. To edit progress, open the card in your Hand.

Manual sharing always creates its private chat copy, independently of the automatic **Post to Chat** setting. Other automatic popup and chat behavior remains unchanged.

### Quest status

GMs and players with **Owner** permission on the receiving Hand can open a quest and use **Quest status** to choose **Active**, **Completed**, or **Failed**. Existing cards without a status default to Active; opening or sharing them does not save that default over existing progress.

Status belongs to each individual card. Separate dealt copies track progress independently; returning a card does not copy its status back to the source deck. Open viewers refresh on card updates. Status changes do not post to chat.

### Objectives and notes

Click an objective's checkbox to save it immediately without flipping the card. Cards created by earlier versions with an Objectives heading and a list are recognized automatically. Editing or replacing legacy objective text can give that row a new identity; new creator cards carry stable row IDs in their HTML.

Click **Notes** to open a separate editor, write your text, then click **Save & Close**. Cancel or the window X discards unsaved changes. If someone has saved newer notes since you opened the editor, Save & Close keeps your draft and displays the latest saved text. Merge the changes and save again. This detects changes already received by your client; it is not a server-side atomic lock against exactly simultaneous saves. Notes are shared with the GM and other owners of the same Hand, not private to an individual player. Unsaved note text is retained when the open viewer refreshes. Notes, status and checks stay on that copy; returning/re-dealing uses Foundry's source-copy behavior.

### Deck edits and appearance

Editing a source card in a configured quest deck updates matching cards already in Hands: title, description, faces, artwork, back and font/headings options. An active GM performs the updates; reconciliation also runs when the GM loads the world. Matching uses source deck and card IDs, not names. Custom edits to the corresponding content of a Hand copy are replaced by source edits.

Status, checked objectives and notes are never copied over from the deck during these updates. Conditions/reference cards and piles are excluded. If no GM is connected, content catches up when a GM next loads the world.

For an existing quest, the GM can open **View Card → Font & Headings** to change font, size or hide existing Objectives/Rewards headings. Changing the source card's appearance propagates to Hand copies. Heading suppression does not remove the objectives or rewards.

### Hand out rewards (D&D Fifth Edition)

In **Card Creator → Rewards to hand out**, add currency, drag Items from the Items sidebar or a compendium, or add a custom boon/other reward. Currency amounts are totals for the party. Item quantities are given to one chosen character. Custom rewards become descriptive features on each selected character, without automatic mechanical effects. The optional reward description remains descriptive text and is not parsed or paid automatically.

For existing quests, open **View Card → Give Rewards → Set Up Rewards**. This updates the original quest and matching Hand copies. A quest must belong to a configured source deck. Rewards can be edited until the first distribution attempt; after that the package is fixed to keep its history reliable.

To distribute, the active GM opens **Give Rewards**, selects individual rewards and recipients, then chooses **Review Distribution**. The confirmation lists exactly who receives what. Currency is split in whole coins, with leftover coins going to the first selected characters in the displayed order. There is no automatic conversion between denominations. Click **Give Rewards** in the confirmation to apply the changes. Cancelling does nothing.

Currency is added to character-sheet balances. Items are copied into character inventories as new entries, leaving the source item intact. Containers are copied empty; equipment is initially unequipped and unattuned. Features and spells without quantity fields must have quantity 1. Items with advancements, such as classes or advancement-based boons, must be added manually through the system's character sheet workflow.

The GM's distribution history is shared by the original quest and all its Hand copies. It lists recipients, amounts, date, and GM. A normal second payout is blocked; **Award Again** explicitly enables another award and still requires review. Completing a quest, showing a card, dealing, or editing its text never distributes rewards. Player progress and notes are preserved.

If a write is interrupted, the package is blocked until the GM chooses **Review Interrupted Award** and checks the actual character sheets. Mark each outstanding entry as received or not received. This review itself changes no items or money. **Review Missing Rewards** then offers only the original allocations confirmed as missing, with another confirmation before retrying. Do not use Award Again as a substitute for recovery. Do not operate payouts from multiple sessions logged in as the same active GM at once, or edit recipient currency while distribution is running.

Reward definitions and receipts are not a hidden-reward feature. Character actors are supported; token-only actors and non-D&D systems are not supported for distribution. Other module features remain available. Existing text-only rewards require setup rather than automatic interpretation.

### Deal selected cards

As GM, open a configured quest deck. Check the selection boxes beside the available cards, click **Deal Selected**, choose a destination Hand, then click **Deal Cards**. Already-drawn cards cannot be selected. The normal automatic popup and chat preferences still apply. This uses Foundry's card passing and does not duplicate the selected cards into multiple Hands.

### Apply the quest emblem

In **Choose Decks**, check your quest decks and click **Apply Quest Emblem to Checked Decks**.

The emblem replaces default playing-card images on source-card faces and deck covers. Custom artwork, text, and backs are preserved. **The conditions/rules reference deck is always excluded, even when checked**, and flagged reference cards in other decks are skipped.

This button uses the current checkboxes without saving deck-selection settings. Use **Save Deck Selection** separately to change automatic popup sources.
Future deals inherit the source images. In configured quest decks, automatic content synchronization also updates existing Hand copies. Run the button again for newly added quest cards.

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

Version 1.13.1 passed **256 automated browser checks** using Foundry 14.365 templates with simulated documents and hooks. Checks include existing behavior, player progress permissions, notes, checkboxes, sharing without status reset, source-content synchronization preserving progress, selected dealing, headings, and fonts. Reward checks cover exact splits, inventory copies, custom features, GM permissions, duplicate prevention, stale confirmations, interruptions, recovery, and the editor/distribution controls. Syntax and ZIP structure were also checked.

Full live multiplayer testing has not been completed; the Foundry 13 legacy render hook was simulated.
Before a session, test viewing and flipping as a player, then deal a card to confirm your popup/chat settings.

When [reporting a problem](https://github.com/davemagi1-ctrl/quest-viewer/issues), include your module, Foundry, and game-system versions, whether you were GM or player, steps to reproduce, and any relevant error message. Remove private world data from screenshots or logs.

## License

Module code: [MIT](LICENSE). Adapted rules content: [CC BY 4.0 attribution](RULES-LICENSE.md).
