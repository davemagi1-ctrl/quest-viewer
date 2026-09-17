const MODULE_ID = "quest-viewer";
const LEGACY_DECK_NAMES_KEY = "deckNames";
const SELECTED_DECKS_KEY = "selectedDecks";
const QUEST_ICON = "modules/quest-viewer/assets/quest-emblem.svg";

/**
 * Deck selector settings submenu.
 *
 * Uses ApplicationV2 for Foundry v13 and v14.
 */
const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

class QuestViewerDeckSelector extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "quest-viewer-deck-selector",
    tag: "form",
    window: {
      title: "Adventurer’s Cards — Deck Selection",
      resizable: true
    },
    position: {
      width: 560,
      height: "auto"
    },
    form: {
      closeOnSubmit: true,
      handler: QuestViewerDeckSelector.#onSubmit
    },
    actions: {
      selectAll: QuestViewerDeckSelector.#onSelectAll,
      createConditions: QuestViewerDeckSelector.#onCreateConditions,
      applyQuestIcon: QuestViewerDeckSelector.#onApplyQuestIcon,
      clearAll: QuestViewerDeckSelector.#onClearAll
    }
  };

  static PARTS = {
    form: {
      template: "modules/quest-viewer/templates/deck-selector.hbs"
    }
  };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const selected = new Set(getSelectedDeckIds());

    const stacks = Array.from(game.cards?.contents ?? game.cards ?? []);

    const allStacks = stacks.map(stack => {
      const stackType = String(
        stack.type ??
        stack._source?.type ??
        stack.system?.type ??
        ""
      ).toLowerCase();

      return {
        id: stack.id,
        name: stack.name || "(Unnamed Card Stack)",
        stackType,
        isDeck: stackType === "deck",
        cardCount:
          stack.cards?.size ??
          stack.cards?.contents?.length ??
          stack.cards?.length ??
          0,
        selected: selected.has(stack.id)
      };
    });

    const decks = allStacks
      .filter(stack => stack.isDeck)
      .sort((a, b) => a.name.localeCompare(b.name));

    console.log(`${MODULE_ID} | Card stacks detected:`, allStacks);
    console.log(`${MODULE_ID} | Selectable source decks:`, decks);

    return foundry.utils.mergeObject(context, {
      decks,
      hasDecks: decks.length > 0,
      selectedCount: decks.filter(d => d.selected).length
    }, { inplace: false });
  }

  _onRender(context, options) {
    super._onRender(context, options);

    const root = this.element;
    if (!root) return;

    root.querySelectorAll(".qv-deck-checkbox").forEach(input => {
      input.addEventListener("change", () => this.#updateCounter());
    });
  }

  #updateCounter() {
    const root = this.element;
    if (!root) return;

    const count = root.querySelectorAll(".qv-deck-checkbox:checked").length;
    const counter = root.querySelector("[data-qv-selected-count]");
    if (counter) counter.textContent = String(count);
  }

  static #onSelectAll(event, target) {
    const app = this;
    app.element?.querySelectorAll(".qv-deck-checkbox").forEach(input => {
      input.checked = true;
    });
    app.#updateCounter();
  }

  static #onClearAll(event, target) {
    const app = this;
    app.element?.querySelectorAll(".qv-deck-checkbox").forEach(input => {
      input.checked = false;
    });
    app.#updateCounter();
  }

  static async #onCreateConditions(event, target) {
    target.disabled = true;
    try {
      const deck = await createConditionsDeck();
      deck.sheet.render({ force: true });
      ui.notifications.info("Reference deck updated. Players can open it in Cards and choose View Card.");
    } catch (err) {
      console.error(`${MODULE_ID} | Conditions deck setup failed`, err);
      ui.notifications.error("Could not create the Conditions deck. See the console for details.");
    } finally { target.disabled = false; }
  }

  static async #onApplyQuestIcon(event, target) {
    const ids = Array.from(this.element?.querySelectorAll(".qv-deck-checkbox:checked") ?? [], input => input.value);
    target.disabled = true;
    try {
      const result = await applyQuestIcons(ids);
      ui.notifications.info(`Quest emblem applied to ${result.cards} card(s) and ${result.decks} deck cover(s). Reference cards and custom artwork were preserved.`);
    } catch (err) {
      console.error(`${MODULE_ID} | Quest icon update failed`, err);
      ui.notifications.error("Some quest icons could not be updated. You can safely retry; see the console for details.");
    } finally { target.disabled = false; }
  }

  static async #onSubmit(event, form, formData) {
    const checked = Array.from(
      this.element?.querySelectorAll(".qv-deck-checkbox:checked") ?? []
    ).map(input => input.value);

    await game.settings.set(
      MODULE_ID,
      SELECTED_DECKS_KEY,
      JSON.stringify(checked)
    );

    ui.notifications.info(
      `Adventurer’s Cards: ${checked.length} deck${checked.length === 1 ? "" : "s"} selected.`
    );
  }
}

Hooks.once("init", () => {
  // Hidden machine-readable list of selected deck IDs.
  game.settings.register(MODULE_ID, SELECTED_DECKS_KEY, {
    name: "Selected Decks",
    scope: "world",
    config: false,
    type: String,
    default: "[]"
  });

  // Hidden legacy setting, retained so v1.1.x users can be migrated cleanly.
  game.settings.register(MODULE_ID, LEGACY_DECK_NAMES_KEY, {
    name: "Legacy Deck Names",
    scope: "world",
    config: false,
    type: String,
    default: ""
  });

  game.settings.registerMenu(MODULE_ID, "deckSelector", {
    name: "Quest Decks",
    label: "Choose Decks",
    hint: "Choose which card decks should trigger Adventurer’s Cards when their cards are dealt to a hand.",
    icon: "fa-solid fa-layer-group",
    type: QuestViewerDeckSelector,
    restricted: true
  });

  game.settings.register(MODULE_ID, "postToChat", {
    name: "Post Quest Text to Chat",
    hint: "Post the front text of a quest card to chat when it is dealt.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
  });

  game.settings.register(MODULE_ID, "gmPopup", {
    name: "Show Automatic Popup to GM",
    hint: "Also show the automatic quest-card popup to the GM who deals the card.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  game.settings.register(MODULE_ID, "popupDelay", {
    name: "Popup Delay",
    hint: "Delay in milliseconds before the card viewer opens after a card is dealt.",
    scope: "world",
    config: true,
    type: Number,
    default: 350,
    range: {
      min: 0,
      max: 2000,
      step: 50
    }
  });

  game.settings.register(MODULE_ID, "chatAlias", {
    name: "Chat Speaker Name",
    hint: "The speaker name used when Adventurer’s Cards posts a card to chat.",
    scope: "world",
    config: true,
    type: String,
    default: "Quest Board"
  });
});

Hooks.once("ready", async () => {
  await migrateLegacyDeckNames();

  const selectedNames = getSelectedDeckIds()
    .map(id => game.cards?.get(id)?.name)
    .filter(Boolean);

  console.log(`${MODULE_ID} | Ready. Watching decks:`, selectedNames);
});

function getSelectedDeckIds() {
  const raw = game.settings.get(MODULE_ID, SELECTED_DECKS_KEY) ?? "[]";

  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter(v => typeof v === "string") : [];
  } catch (err) {
    console.warn(`${MODULE_ID} | Invalid selected deck data`, err);
    return [];
  }
}

async function migrateLegacyDeckNames() {
  if (!game.user.isGM) return;
  if (getSelectedDeckIds().length) return;

  const legacy = String(
    game.settings.get(MODULE_ID, LEGACY_DECK_NAMES_KEY) ?? ""
  ).trim();

  if (!legacy) return;

  const names = legacy
    .split(",")
    .map(name => name.trim())
    .filter(Boolean);

  const ids = (game.cards?.filter(stack =>
    stack.type === "deck" && names.includes(stack.name)
  ) ?? []).map(deck => deck.id);

  if (!ids.length) return;

  await game.settings.set(
    MODULE_ID,
    SELECTED_DECKS_KEY,
    JSON.stringify(ids)
  );

  console.log(`${MODULE_ID} | Migrated legacy deck selection`, ids);
}

function escapeHTML(str = "") {
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getFace(card) {
  const index = Number.isInteger(card.face) ? card.face : 0;
  return card.faces?.[index] ?? card.faces?.[0] ?? null;
}

function getFaceText(card) {
  const face = getFace(card);
  return face?.text || card.description || "<p>No quest text was found.</p>";
}

function getBackText(card) {
  return card.back?.text || `
    <div class="qv-default-back">
      <div class="qv-back-kicker">THE ADVENTURER'S CALL</div>
      <div class="qv-back-seal" aria-hidden="true"><span></span></div>
      <h1>QUEST</h1>
      <div class="qv-back-rule" aria-hidden="true">◆</div>
      <p>A tale yet to be told</p>
    </div>
  `;
}

async function isConfiguredQuestCard(card) {
  const selected = new Set(getSelectedDeckIds());
  if (!selected.size) return false;

  // Foundry's source/origin is a Cards document, not a UUID string.
  const source = card.source ?? card.origin;
  if (source && typeof source === "object" && source.id) {
    return source.type === "deck" && selected.has(source.id);
  }

  // Retain support for older/custom workflows with a deck ID or UUID.
  const origin = typeof source === "string" ? source : card._source?.origin;
  if (typeof origin === "string" && origin) {
    const deck = game.cards?.get(origin);
    if (deck) return deck.type === "deck" && selected.has(deck.id);

    // Standard world UUIDs identify the deck even if its document is unavailable.
    const deckId = /^Cards\.([^.]+)(?:\.Card\.[^.]+)?$/.exec(origin)?.[1];
    if (deckId) return selected.has(deckId);
    if (!origin.includes(".")) return selected.has(origin);
    try {
      const original = await fromUuid(origin);
      const originalDeck = original?.documentName === "Cards" ? original : original?.parent;
      if (originalDeck?.id) return originalDeck.type === "deck" && selected.has(originalDeck.id);
    } catch (err) {
      console.warn(`${MODULE_ID} | Could not resolve card origin`, err);
    }
    // A known origin must not match an unrelated selected deck by card name.
    return false;
  }

  // Fallback for systems/workflows that do not preserve origin as expected.
  // Only inspect the specifically selected decks.
  for (const deckId of selected) {
    const deck = game.cards?.get(deckId);
    if (!deck || deck.type !== "deck") continue;

    if (deck.cards?.some(cardInDeck => cardInDeck.name === card.name)) {
      return true;
    }
  }

  return false;
}

function canCurrentUserViewHand(hand) {
  if (!hand) return false;

  if (game.user.isGM) {
    return game.settings.get(MODULE_ID, "gmPopup");
  }

  return hand.testUserPermission(game.user, "OWNER");
}

async function postQuestToChat(card) {
  if (!game.settings.get(MODULE_ID, "postToChat")) return;

  const alias = String(
    game.settings.get(MODULE_ID, "chatAlias") || "Quest Board"
  );

  await ChatMessage.create({
    speaker: { alias },
    content: `
      <div class="qv-chat-card">
        <h2>${escapeHTML(card.name)}</h2>
        <div class="qv-chat-body">${getFaceText(card)}</div>
        <div class="qv-chat-footer">• QUEST •</div>
      </div>
    `
  });
}

const QUEST_STATUSES = { active: "Active", completed: "Completed", failed: "Failed" };

function getQuestStatus(card) {
  const status = card.getFlag?.(MODULE_ID, "status");
  return Object.hasOwn(QUEST_STATUSES, status) ? status : "active";
}

function statusBadgeHTML(card) {
  const status = getQuestStatus(card);
  return `<span class="qv-status-badge qv-status-${status}" aria-label="Quest status: ${QUEST_STATUSES[status]}">${QUEST_STATUSES[status]}</span>`;
}

async function setQuestStatus(card, status) {
  if (!game.user.isGM) throw new Error("Only the GM can change quest status using Adventurer’s Cards.");
  if (!Object.hasOwn(QUEST_STATUSES, status)) throw new Error("Invalid quest status.");
  if (card.parent?.cards.get(card.id) !== card || !(await isConfiguredQuestCard(card))) {
    throw new Error("This quest card is no longer available.");
  }
  if (!game.user.isGM || card.parent.cards.get(card.id) !== card) throw new Error("This quest card is no longer available.");
  await card.setFlag(MODULE_ID, "status", status);
}

const questViewers = new Map();
function sameQuestCard(a, b) {
  return a === b || (a.uuid && a.uuid === b.uuid);
}
Hooks.on("updateCard", card => {
  for (const entry of questViewers.values()) {
    if (sameQuestCard(entry.card, card)) entry.refresh();
  }
});
Hooks.on("deleteCard", card => {
  for (const [viewer, entry] of questViewers) {
    if (sameQuestCard(entry.card, card)) {
      questViewers.delete(viewer);
      viewer.close();
    }
  }
});

function buildCardHTML(card, showingFront) {
  if (isConditionCard(card)) return `
    <div class="qv-viewer-wrapper">
      <article class="qv-card qv-card--condition" aria-label="${escapeHTML(card.name)} reference">
        <img class="qv-reference-icon" src="${escapeHTML(getFace(card)?.img || "icons/svg/card-hand.svg")}" alt="">
        <div class="qv-condition-edition">${escapeHTML(card.getFlag?.(MODULE_ID, "referenceKind") || "Condition")} • 2024 RULES</div>
        <header class="qv-card-title">${escapeHTML(card.name)}</header>
        <section class="qv-card-body">${getFaceText(card)}</section>
      </article>
    </div>`;
  const text = showingFront ? getFaceText(card) : getBackText(card);
  const title = showingFront ? card.name : (card.back?.name || "Quest");

  return `
    <div class="qv-viewer-wrapper">
      <article class="qv-card${showingFront ? "" : " qv-card--back"}${!showingFront && !card.back?.text ? " qv-card--sealed" : ""}" data-qv-flip role="button" tabindex="0"
               aria-label="Flip ${escapeHTML(card.name)}">
        <header class="qv-card-title">${escapeHTML(title)}</header>
        <div class="qv-status-display" aria-live="polite">${statusBadgeHTML(card)}</div>
        <section class="qv-card-body">${text}</section>
        <footer class="qv-card-footer">• QUEST •</footer>
        <div class="qv-card-hint">
          <i class="fa-solid fa-rotate"></i>
          Click to flip
        </div>
      </article>
      ${game.user.isGM ? `<label class="qv-status-control">Quest status
        <select aria-label="Quest status" data-qv-status>
          ${Object.entries(QUEST_STATUSES).map(([value, label]) => `<option value="${value}"${value === getQuestStatus(card) ? " selected" : ""}>${label}</option>`).join("")}
        </select></label>` : ""}
    </div>
  `;
}

async function showQuestCard(card) {
  const DialogV2 = foundry.applications.api.DialogV2;
  let showingFront = true;

  const viewer = new DialogV2({
    window: {
      title: card.name,
      resizable: true
    },
    content: buildCardHTML(card, showingFront),
    buttons: [{
      action: "close",
      label: "Close",
      icon: "fa-solid fa-xmark"
    }]
  });

  // Direct DialogV2 instances emit a render event. The render callback option
  // is only wired up by DialogV2.wait/prompt/confirm, not by the constructor.
  viewer.addEventListener("render", () => {
      const dialog = viewer;
      const currentWrapper = dialog.element.querySelector(".qv-viewer-wrapper");
      if (currentWrapper) currentWrapper.outerHTML = buildCardHTML(card, showingFront);
      const attachFlip = () => {
        const statusSelect = dialog.element.querySelector("[data-qv-status]");
        statusSelect?.addEventListener("change", async () => {
          statusSelect.disabled = true;
          try {
            await setQuestStatus(card, statusSelect.value);
            refresh();
          } catch (err) {
            console.error(`${MODULE_ID} | Status update failed`, err);
            ui.notifications.error(err.message);
            statusSelect.value = getQuestStatus(card);
          } finally { statusSelect.disabled = false; }
        });
        const element = dialog.element.querySelector("[data-qv-flip]");
        if (!element) return;

        const flip = (restoreFocus = false) => {
          showingFront = !showingFront;

          const wrapper = dialog.element.querySelector(".qv-viewer-wrapper");
          if (!wrapper) return;

          wrapper.outerHTML = buildCardHTML(card, showingFront);
          attachFlip();
          if (restoreFocus) dialog.element.querySelector("[data-qv-flip]")?.focus();
        };

        element.addEventListener("click", () => flip());
        element.addEventListener("keydown", event => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            flip(true);
          }
        });
      };

      attachFlip();
  });

  const refresh = () => {
    // Rebuild from the live document while retaining the side currently shown.
    viewer.render({ force: true });
  };
  questViewers.set(viewer, { card, refresh });
  viewer.addEventListener("close", () => questViewers.delete(viewer), { once: true });
  viewer.render({ force: true });
}

Hooks.on("createCard", async (card, options, userId) => {
  try {
    if (card.parent?.type !== "hand") return;
    if (!(await isConfiguredQuestCard(card))) return;

    // The client that initiated the creation makes the one shared chat post.
    if (game.user.id === userId) {
      await postQuestToChat(card);
    }

    // Every connected client independently checks whether it should see the popup.
    if (!canCurrentUserViewHand(card.parent)) return;

    const delay = Number(game.settings.get(MODULE_ID, "popupDelay")) || 0;
    if (delay > 0) {
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    await showQuestCard(card);
  } catch (err) {
    console.error(`${MODULE_ID} | Adventurer’s Cards error`, err);
  }
});

// Reopening a card is local and independent of the automatic GM popup setting.
function canManuallyViewHand(hand) {
  if (hand?.documentName !== "Cards") return false;
  if (hand.type === "deck" && isConditionsDeck(hand)) {
    return game.user.isGM || hand.testUserPermission(game.user, "OBSERVER");
  }
  return hand.type === "hand" && (game.user.isGM || hand.testUserPermission(game.user, "OWNER"));
}

// An older asynchronous render must not add controls after a newer render.
const handRenderTokens = new WeakMap();

async function addViewCardButtons(app, html) {
  const hand = app.document ?? app.object;
  if (hand?.documentName !== "Cards" || !["hand", "deck"].includes(hand.type)) return;
  const root = html?.querySelectorAll ? html : html?.[0];
  if (!root) return;
  const token = {};
  handRenderTokens.set(app, token);
  root.querySelectorAll(".qv-view-card, .qv-hand-status").forEach(button => button.remove());
  if (!canManuallyViewHand(hand)) return;

  try {
    for (const row of root.querySelectorAll("li[data-card-id]")) {
      const cardId = row.dataset.cardId;
      const card = hand.cards.get(cardId);
      if (!card || !(isConditionCard(card) || await isConfiguredQuestCard(card))) continue;
      if (handRenderTokens.get(app) !== token) return;
      if (!root.contains(row) || !canManuallyViewHand(hand)
        || hand.cards.get(cardId) !== card) continue;

      const button = root.ownerDocument.createElement("button");
      button.type = "button";
      button.className = "qv-view-card";
      button.textContent = "View Card";
      button.setAttribute("aria-label", `View Card: ${card.name}`);
      button.title = "Open this card";
      button.addEventListener("click", async event => {
        event.preventDefault();
        event.stopPropagation();
        if (button.disabled) return;
        button.disabled = true;
        try {
          // Recheck the live hand: the card may have been returned or played,
          // permissions changed, or its source deck deselected since rendering.
          const current = hand.cards.get(cardId);
          if (!canManuallyViewHand(hand) || !current
            || !(isConditionCard(current) || await isConfiguredQuestCard(current))
            || !canManuallyViewHand(hand) || hand.cards.get(cardId) !== current) {
            ui.notifications.warn("This card is no longer available. Reopen the card stack to refresh it.");
            return;
          }
          await showQuestCard(current);
        } catch (err) {
          console.error(`${MODULE_ID} | Could not reopen quest card`, err);
          ui.notifications.error("Adventurer’s Cards could not open this card. See the console for details.");
        } finally {
          button.disabled = false;
        }
      });
      row.append(button);
      if (isConditionCard(card)) continue;
      const badge = root.ownerDocument.createElement("span");
      badge.className = "qv-hand-status";
      badge.innerHTML = statusBadgeHTML(card);
      row.append(badge);
    }
  } catch (err) {
    console.error(`${MODULE_ID} | Could not add View Card buttons`, err);
  }
}

// v14 sheets use ApplicationV2; legacy v13 sheets pass a jQuery element.
Hooks.on("renderApplicationV2", addViewCardButtons);
Hooks.on("renderCardHand", addViewCardButtons);
Hooks.on("renderCardDeckConfig", addViewCardButtons);

// Adapted from SRD 5.2.1 (CC BY 4.0). See RULES-LICENSE.md.
const CONDITION_ATTRIBUTION = `This work includes material from the System Reference Document 5.2.1 (“SRD 5.2.1”) by Wizards of the Coast LLC, available at <a href="https://www.dndbeyond.com/srd" target="_blank" rel="noopener noreferrer">https://www.dndbeyond.com/srd</a>. The SRD 5.2.1 is licensed under the Creative Commons Attribution 4.0 International License, available at <a href="https://creativecommons.org/licenses/by/4.0/legalcode" target="_blank" rel="noopener noreferrer">https://creativecommons.org/licenses/by/4.0/legalcode</a>.`;
const INCAPACITATED_REMINDER = "<strong>Incapacitated.</strong> You cannot take actions, Bonus Actions, or Reactions. Your Concentration breaks, you cannot speak, and you have Disadvantage on Initiative rolls.";
const CONDITIONS_2024 = [
  { name: "Blinded", effects: [
    "<strong>Sight.</strong> You cannot see. You automatically fail ability checks that require sight.",
    "<strong>Attacks.</strong> Your attack rolls have Disadvantage. Attack rolls against you have Advantage."
  ] },
  { name: "Charmed", effects: [
    "<strong>The charmer.</strong> You cannot attack the charmer or target them with damaging abilities or magical effects.",
    "<strong>Social interaction.</strong> The charmer has Advantage on ability checks to interact with you socially."
  ] },
  { name: "Deafened", effects: [
    "<strong>Hearing.</strong> You cannot hear. You automatically fail ability checks that require hearing."
  ] },
  { name: "Exhaustion", effects: [
    "<strong>Levels.</strong> Each time you gain Exhaustion, add 1 level. At level 6, you die.",
    "<strong>D20 Tests.</strong> Subtract twice your Exhaustion level from ability checks, attack rolls, and saving throws.",
    "<strong>Speed.</strong> Reduce your Speed by 5 feet per Exhaustion level.",
    "<strong>Recovery.</strong> Finishing a Long Rest removes 1 level. At level 0, this condition ends. Specific effects can restrict recovery."
  ] },
  { name: "Frightened", effects: [
    "<strong>Checks and attacks.</strong> Your ability checks and attack rolls have Disadvantage while the source of your fear is within line of sight.",
    "<strong>Approaching.</strong> You cannot willingly move closer to the source of your fear."
  ] },
  { name: "Grappled", effects: [
    "<strong>Speed.</strong> Your Speed is 0 and cannot increase.",
    "<strong>Attacks.</strong> Your attack rolls have Disadvantage against everyone except the creature grappling you.",
    "<strong>Being moved.</strong> The grappler can drag or carry you. Each foot it moves costs an extra foot, unless you are Tiny or at least two sizes smaller than it."
  ] },
  { name: "Incapacitated", effects: [INCAPACITATED_REMINDER] },
  { name: "Invisible", effects: [
    "<strong>Initiative.</strong> You have Advantage on Initiative rolls.",
    "<strong>Concealment.</strong> Effects that require seeing their target cannot affect you unless their creator can see you. Your worn and carried equipment is also concealed.",
    "<strong>Attacks.</strong> Your attack rolls have Advantage, and attack rolls against you have Disadvantage. Neither benefit applies against a creature that can see you."
  ] },
  { name: "Paralyzed", effects: [
    INCAPACITATED_REMINDER,
    "<strong>Speed.</strong> Your Speed is 0 and cannot increase.",
    "<strong>Saving throws.</strong> You automatically fail Strength and Dexterity saving throws.",
    "<strong>Attacks.</strong> Attack rolls against you have Advantage. Any attack roll that hits you is a Critical Hit if the attacker is within 5 feet of you."
  ] },
  { name: "Petrified", effects: [
    "<strong>Transformation.</strong> You and your nonmagical worn and carried objects become solid, inanimate material, usually stone. Your weight becomes ten times normal, and you stop aging.",
    INCAPACITATED_REMINDER,
    "<strong>Speed.</strong> Your Speed is 0 and cannot increase.",
    "<strong>Attacks and saves.</strong> Attack rolls against you have Advantage. You automatically fail Strength and Dexterity saving throws.",
    "<strong>Protection.</strong> You have Resistance to all damage and Immunity to the Poisoned condition."
  ] },
  { name: "Poisoned", effects: [
    "<strong>Checks and attacks.</strong> You have Disadvantage on ability checks and attack rolls."
  ] },
  { name: "Prone", effects: [
    "<strong>Movement.</strong> You can crawl, or spend movement equal to half your Speed (round down) to stand and end this condition. You cannot stand this way if your Speed is 0.",
    "<strong>Your attacks.</strong> Your attack rolls have Disadvantage.",
    "<strong>Attacks against you.</strong> Attack rolls have Advantage if the attacker is within 5 feet of you; otherwise, they have Disadvantage."
  ] },
  { name: "Restrained", effects: [
    "<strong>Speed.</strong> Your Speed is 0 and cannot increase.",
    "<strong>Attacks.</strong> Your attack rolls have Disadvantage. Attack rolls against you have Advantage.",
    "<strong>Saving throws.</strong> You have Disadvantage on Dexterity saving throws."
  ] },
  { name: "Stunned", effects: [
    INCAPACITATED_REMINDER,
    "<strong>Saving throws.</strong> You automatically fail Strength and Dexterity saving throws.",
    "<strong>Attacks.</strong> Attack rolls against you have Advantage."
  ] },
  { name: "Unconscious", effects: [
    INCAPACITATED_REMINDER,
    "<strong>Fallen.</strong> You also have the Prone condition and drop whatever you are holding. You remain Prone when Unconscious ends.",
    "<strong>Speed and awareness.</strong> Your Speed is 0 and cannot increase. You are unaware of your surroundings.",
    "<strong>Saving throws.</strong> You automatically fail Strength and Dexterity saving throws.",
    "<strong>Attacks.</strong> Attack rolls against you have Advantage. Any attack roll that hits you is a Critical Hit if the attacker is within 5 feet of you. Apply Prone and any other sources of Advantage or Disadvantage as usual."
  ] }
];

function isConditionsDeck(deck) {
  return deck?.getFlag?.(MODULE_ID, "conditionsReference") === "2024";
}

function isConditionCard(card) {
  return card?.getFlag?.(MODULE_ID, "conditionRules") === "2024" || isConditionsDeck(card?.parent);
}

function conditionCardData(condition, index) {
  const text = `<ul class="qv-condition-effects">${condition.effects.map(effect => `<li>${effect}</li>`).join("")}</ul>
    <p class="qv-condition-note">${condition.kind ? "This is a rules reference, not an additional condition. Specific effects can change these rules." : "The effect causing a condition determines its duration and how it ends. Specific rules can override these general effects."}</p>
    <details class="qv-rules-credit"><summary>Rules source &amp; license</summary><p>Adapted and summarized for these cards; related Incapacitated effects are expanded for convenience.</p><p>${CONDITION_ATTRIBUTION}</p></details>`;
  return {
    name: condition.name, description: text, face: 0, sort: (index + 1) * 100000,
    faces: [{ name: condition.name, text, img: referenceIcon(condition) }],
    flags: { [MODULE_ID]: { conditionRules: "2024", referenceKey: condition.name, referenceKind: condition.kind || "Condition" } }
  };
}

const CONDITION_ICONS = {
  Blinded: "blind", Charmed: "aura", Deafened: "deaf", Exhaustion: "downgrade",
  Frightened: "terror", Grappled: "anchor", Incapacitated: "cancel", Invisible: "invisible",
  Paralyzed: "paralysis", Petrified: "statue", Poisoned: "poison", Prone: "falling",
  Restrained: "net", Stunned: "daze", Unconscious: "unconscious"
};
function referenceIcon(rule) {
  return `icons/svg/${rule.icon || CONDITION_ICONS[rule.name] || "card-hand"}.svg`;
}

const DEFAULT_QUEST_IMAGES = new Set(["", "icons/svg/card-joker.svg", "icons/svg/card-hand.svg"]);
let questIconUpdate;
async function applyQuestIcons(deckIds) {
  if (!game.user.isGM) throw new Error("Only a GM can update quest icons.");
  if (questIconUpdate) return questIconUpdate;
  questIconUpdate = (async () => {
    const result = { cards: 0, decks: 0 };
    for (const id of new Set(deckIds)) {
      const deck = game.cards?.get(id);
      // Explicitly exclude the reference deck, even if it was checked in settings.
      if (!deck || deck.type !== "deck" || isConditionsDeck(deck)) continue;
      const updates = [];
      for (const card of deck.cards.values()) {
        if (isConditionCard(card) || isConditionsDeck(card.source ?? card.origin)) continue;
        const faces = card.toObject().faces;
        if (!faces?.some(face => DEFAULT_QUEST_IMAGES.has(face.img ?? ""))) continue;
        updates.push({ _id: card.id, faces: faces.map(face => ({ ...face,
          img: DEFAULT_QUEST_IMAGES.has(face.img ?? "") ? QUEST_ICON : face.img })) });
      }
      if (updates.length) {
        await deck.updateEmbeddedDocuments("Card", updates);
        result.cards += updates.length;
      }
      if (DEFAULT_QUEST_IMAGES.has(deck.img ?? "")) {
        await deck.update({ img: QUEST_ICON });
        result.decks++;
      }
    }
    return result;
  })();
  try { return await questIconUpdate; }
  finally { questIconUpdate = null; }
}

// Additional references are labelled by their actual rule type, not as conditions.
const EXTRA_RULES_2024 = [
  { name: "Dodge", kind: "Action", icon: "shield", effects: [
    "<strong>Until your next turn.</strong> Until the start of your next turn, attack rolls against you have Disadvantage if you can see the attacker. Your Dexterity saving throws have Advantage.",
    "<strong>Losing the benefit.</strong> These benefits end if you become Incapacitated or your Speed becomes 0."
  ] },
  { name: "Hide", kind: "Action", icon: "cowled", effects: [
    "<strong>Requirements.</strong> Be out of every enemy's line of sight and either Heavily Obscured or behind Three-Quarters or Total Cover. If you can see a creature, you can tell whether it can see you.",
    "<strong>Check.</strong> Succeed on a DC 15 Dexterity (Stealth) check. You gain the Invisible condition while hidden. Record your total: it becomes the DC to find you with Wisdom (Perception).",
    "<strong>While hidden.</strong> Invisible gives Advantage on Initiative and on your attacks, and Disadvantage on attacks against you. The attack benefits do not apply against a creature that can see you. Effects requiring a visible target cannot affect you unless their creator can see you.",
    "<strong>Hiding ends.</strong> You stop being hidden immediately after making a sound louder than a whisper, being found by an enemy, making an attack roll, or casting a spell with a Verbal component."
  ] },
  { name: "Dash", kind: "Action", icon: "wingfoot", effects: [
    "<strong>Extra movement.</strong> Gain movement equal to your Speed, after modifiers, for this turn. With Speed 30 feet, one Dash lets you move up to 60 feet in total.",
    "<strong>Special speeds.</strong> You can choose a special speed, such as Fly or Swim Speed, instead. Choose the speed each time you Dash."
  ] },
  { name: "Disengage", kind: "Action", icon: "direction", effects: [
    "<strong>Safe movement.</strong> Your movement does not provoke Opportunity Attacks for the rest of the current turn."
  ] },
  { name: "Help", kind: "Action", icon: "heal", effects: [
    "<strong>Help a check.</strong> Choose a skill or tool you are proficient with and an ally close enough to assist. They have Advantage on their next ability check with it before the start of your next turn. The GM decides whether your assistance is possible.",
    "<strong>Help an attack.</strong> Alternatively, distract an enemy within 5 feet of you. The next attack roll by an ally against that enemy has Advantage. This benefit expires at the start of your next turn.",
    "<strong>Stabilize.</strong> You can also use Help to try to stabilize a creature at 0 Hit Points with a DC 10 Wisdom (Medicine) check."
  ] },
  { name: "Ready", kind: "Action", icon: "clockwork", effects: [
    "<strong>Choose a trigger.</strong> Name a perceivable circumstance and the action you will take, or choose to move up to your Speed. You can respond before the start of your next turn.",
    "<strong>Respond.</strong> Use your Reaction immediately after the trigger finishes, or ignore it.",
    "<strong>Readying a spell.</strong> It must have a casting time of an action. Cast it now, spending its resources, and hold it with Concentration until you release it. If Concentration breaks, the spell has no effect. You can hold it only until the start of your next turn."
  ] },
  { name: "Flying", kind: "Movement", icon: "wing", effects: [
    "<strong>Fly Speed.</strong> A Fly Speed allows movement through the air. You can stay aloft until you land, fall, or die. This reference does not grant flight or a Fly Speed.",
    "<strong>Falling.</strong> While flying, you fall if you become Incapacitated or Prone, or your Fly Speed becomes 0. The ability to hover lets you remain aloft in those circumstances."
  ] },
  { name: "Hovering", kind: "Movement", icon: "wingfoot", effects: [
    "<strong>Special ability.</strong> Hovering must be granted by your stat block, a spell, or another effect. Having a Fly Speed alone does not grant it.",
    "<strong>Remain aloft.</strong> While flying, hovering prevents falling because you become Incapacitated or Prone, or your Fly Speed is reduced to 0."
  ] },
  { name: "Climbing", kind: "Movement", icon: "ladder", effects: [
    "<strong>Movement cost.</strong> Each foot climbed costs 1 extra foot, or 2 extra feet in Difficult Terrain. Using a Climb Speed removes the extra cost for climbing.",
    "<strong>Difficult climb.</strong> The GM can require a DC 15 Strength (Athletics) check for a slippery surface or one with few handholds."
  ] },
  { name: "Swimming", kind: "Movement", icon: "waterfall", effects: [
    "<strong>Movement cost.</strong> Each foot swum costs 1 extra foot, or 2 extra feet in Difficult Terrain. Using a Swim Speed removes the extra cost for swimming.",
    "<strong>Rough water.</strong> The GM can require a DC 15 Strength (Athletics) check to move through rough water."
  ] },
  { name: "Burrowing", kind: "Movement", icon: "mole", effects: [
    "<strong>Burrow Speed.</strong> Use this speed to move through sand, earth, mud, or ice. You cannot burrow through solid rock unless a trait allows it. This reference does not grant a Burrow Speed."
  ] },
  { name: "Crawling", kind: "Movement", icon: "down", effects: [
    "<strong>Movement cost.</strong> Each foot crawled costs 1 extra foot, or 2 extra feet in Difficult Terrain.",
    "<strong>While Prone.</strong> You can crawl or spend movement equal to half your Speed, rounded down, to stand. You cannot stand this way with Speed 0."
  ] },
  { name: "Concentration", kind: "Spellcasting", icon: "eye", effects: [
    "<strong>Maintaining an effect.</strong> Keep Concentration for up to the duration stated by the effect. You may end it at any time without an action.",
    "<strong>Taking damage.</strong> Make a Constitution saving throw. The DC is 10 or half the damage, rounded down, whichever is higher, to a maximum DC of 30. Failure breaks Concentration.",
    "<strong>Other endings.</strong> Concentration ends if you become Incapacitated or die. It also ends when you start casting another spell requiring Concentration or activate another effect requiring it."
  ] },
  { name: "Surprised", kind: "Combat state", icon: "hazard", effects: [
    "<strong>Initiative.</strong> If combat starts while you are caught unawares, you have Disadvantage on your Initiative roll. Surprise in the 2024 rules does not make you skip your first turn."
  ] },
  { name: "Sleeping", kind: "Combat state", icon: "sleep", effects: [
    "<strong>Unconscious.</strong> While sleeping, you have the Unconscious condition. You cannot take actions, Bonus Actions, or Reactions; cannot speak; lose Concentration; and are unaware of your surroundings.",
    "<strong>Other effects.</strong> You are Prone, drop held items, have Speed 0, and automatically fail Strength and Dexterity saves. Attacks against you have Advantage; a hit is a Critical Hit if the attacker is within 5 feet. Apply Prone and other sources of Advantage or Disadvantage as usual.",
    "<strong>Waking.</strong> Check the rule that caused sleep, especially magical sleep, for how it ends. When Unconscious ends, you remain Prone."
  ] },
  { name: "Bloodied", kind: "Combat state", icon: "blood", effects: [
    "<strong>Half health.</strong> You are Bloodied while you have half your maximum Hit Points or fewer remaining. Specific features may use this threshold; it imposes no general penalty by itself."
  ] },
  { name: "Stable", kind: "Combat state", icon: "regen", effects: [
    "<strong>At 0 Hit Points.</strong> You remain Unconscious but do not make Death Saving Throws. Becoming Stable resets your death-save successes and failures.",
    "<strong>Recovery and damage.</strong> If not healed, you regain 1 Hit Point after 1d4 hours. Taking damage ends stability and resumes Death Saving Throws; the damage-at-0 rules still apply."
  ] },
  { name: "Dying", kind: "Combat state", icon: "degen", effects: [
    "<strong>At 0 Hit Points.</strong> If you do not die instantly, you become Unconscious until you regain Hit Points. Unless Stable, make a Death Saving Throw at the start of each turn: 10 or higher succeeds.",
    "<strong>Track results.</strong> Three successes make you Stable; three failures kill you. A natural 1 counts as two failures; a natural 20 restores 1 Hit Point. Healing or becoming Stable clears both counts.",
    "<strong>Damage.</strong> Damage at 0 Hit Points causes one failed death save, or two from a Critical Hit. Damage equal to or greater than your Hit Point maximum kills you."
  ] },
  { name: "Dead", kind: "Combat state", icon: "skull", effects: [
    "<strong>Revival required.</strong> A dead creature has no Hit Points and cannot regain them until revived by magic such as Revivify or Raise Dead. Its spirit may refuse to return.",
    "<strong>Returning.</strong> The revival effect determines restored Hit Points. Unless it says otherwise, ongoing conditions, curses, and magical contagions return if their durations have not ended. Exhaustion is reduced by 1 level, and previous magic-item Attunement is lost."
  ] },
  { name: "Burning", kind: "Hazard", icon: "fire", effects: [
    "<strong>Damage.</strong> A burning creature or object takes 1d4 Fire damage at the start of each of its turns.",
    "<strong>Extinguish.</strong> As an action, make yourself Prone and roll on the ground to extinguish fire on yourself. Dousing, submerging, or suffocating the fire also extinguishes it. Specific effects may use different rules."
  ] },
  { name: "Falling", kind: "Hazard", icon: "falling", effects: [
    "<strong>Impact.</strong> At the end of a fall, take 1d6 Bludgeoning damage per 10 feet fallen, up to 20d6. You land Prone unless you avoid all damage from the fall.",
    "<strong>Into liquid.</strong> Use your Reaction to make a DC 15 Strength (Athletics) or Dexterity (Acrobatics) check to hit head or feet first. Success halves the fall damage."
  ] },
  { name: "Cover", kind: "Combat rule", icon: "shield", effects: [
    "<strong>Half Cover.</strong> Gain +2 to AC and Dexterity saving throws.",
    "<strong>Three-Quarters Cover.</strong> Gain +5 to AC and Dexterity saving throws.",
    "<strong>Total Cover.</strong> You cannot be targeted directly. Cover is relative to the attack or effect; use only the most protective degree, not their sum."
  ] },
  { name: "Lightly Obscured", kind: "Visibility", icon: "light-off", effects: [
    "<strong>Seeing.</strong> Wisdom (Perception) checks to see something in a Lightly Obscured space have Disadvantage. Dim Light is Lightly Obscured."
  ] },
  { name: "Heavily Obscured", kind: "Visibility", icon: "blind", effects: [
    "<strong>Seeing.</strong> You have the Blinded condition when trying to see something in a Heavily Obscured space. Darkness is Heavily Obscured. Relevant special senses can change what you can see."
  ] },
  { name: "Heroic Inspiration", kind: "Benefit", icon: "angel", effects: [
    "<strong>Reroll.</strong> Spend Heroic Inspiration to reroll any die immediately after rolling it. You must use the new roll.",
    "<strong>Already inspired.</strong> If you gain it while you already have it, it is lost unless you give it to another player character who lacks it."
  ] }
];
const REFERENCE_RULES_2024 = [...CONDITIONS_2024, ...EXTRA_RULES_2024];

let conditionsDeckCreation;
async function createConditionsDeck() {
  if (!game.user.isGM) throw new Error("Only a GM can create the Conditions deck.");
  if (conditionsDeckCreation) return conditionsDeckCreation;
  conditionsDeckCreation = (async () => {
    const decks = Array.from(game.cards?.contents ?? game.cards?.values() ?? []);
    const existing = decks.find(deck => deck.type === "deck" && isConditionsDeck(deck));
    if (existing) {
      const cards = Array.from(existing.cards.values());
      const updates = [];
      const additions = [];
      for (const [index, rule] of REFERENCE_RULES_2024.entries()) {
        const card = cards.find(card => {
          const key = card.getFlag(MODULE_ID, "referenceKey");
          return key ? key === rule.name : card.name === rule.name || card.faces?.[0]?.name === rule.name;
        });
        if (!card) { additions.push(conditionCardData(rule, index)); continue; }
        const update = { _id: card.id };
        if (!card.getFlag(MODULE_ID, "referenceKey")) {
          update[`flags.${MODULE_ID}.referenceKey`] = rule.name;
          update[`flags.${MODULE_ID}.referenceKind`] = rule.kind || "Condition";
        }
        // Replace only the placeholder; retain edited text, extra faces and custom art.
        if (card.faces?.some(face => face.img === "icons/svg/book.svg")) {
          update.faces = card.toObject().faces.map(face => ({ ...face,
            img: face.img === "icons/svg/book.svg" ? referenceIcon(rule) : face.img }));
        }
        if (Object.keys(update).length > 1) updates.push(update);
      }
      if (updates.length) await existing.updateEmbeddedDocuments("Card", updates);
      if (additions.length) await existing.createEmbeddedDocuments("Card", additions);
      const deckUpdate = {};
      if (existing.img === "icons/svg/book.svg") deckUpdate.img = "icons/svg/card-hand.svg";
      if (existing.name === "Conditions — 2024") deckUpdate.name = "Rules Reference — 2024";
      if (Object.keys(deckUpdate).length) await existing.update(deckUpdate);
      return existing;
    }
    const CardsClass = getDocumentClass("Cards");
    return CardsClass.create({
      name: "Rules Reference — 2024", type: "deck", img: "icons/svg/card-hand.svg",
      description: `<p>Open this deck in Cards and choose View Card to read conditions, actions, movement, and combat rules. Compatible with fifth edition (2024 rules).</p><p>${CONDITION_ATTRIBUTION}</p>`,
      ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER },
      flags: { [MODULE_ID]: { conditionsReference: "2024" } },
      cards: REFERENCE_RULES_2024.map(conditionCardData)
    });
  })();
  try { return await conditionsDeckCreation; }
  finally { conditionsDeckCreation = null; }
}
