const MODULE_ID = "quest-viewer";
const LEGACY_DECK_NAMES_KEY = "deckNames";
const SELECTED_DECKS_KEY = "selectedDecks";

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
      title: "Quest Viewer — Deck Selection",
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
      ui.notifications.info("Conditions deck ready. Players can open it in Cards and choose View Card.");
    } catch (err) {
      console.error(`${MODULE_ID} | Conditions deck setup failed`, err);
      ui.notifications.error("Could not create the Conditions deck. See the console for details.");
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
      `Quest Viewer: ${checked.length} deck${checked.length === 1 ? "" : "s"} selected.`
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
    hint: "Choose which card decks should trigger Quest Viewer when their cards are dealt to a hand.",
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
    hint: "The speaker name used when Quest Viewer posts a card to chat.",
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
  if (!game.user.isGM) throw new Error("Only the GM can change quest status using Quest Viewer.");
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
      <article class="qv-card qv-card--condition" aria-label="${escapeHTML(card.name)} condition">
        <div class="qv-condition-edition">CONDITION • 2024 RULES</div>
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
    console.error(`${MODULE_ID} | Quest Viewer error`, err);
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
          ui.notifications.error("Quest Viewer could not open this card. See the console for details.");
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
    <p class="qv-condition-note">The effect causing a condition determines its duration and how it ends. Specific rules can override these general effects.</p>
    <details class="qv-rules-credit"><summary>Rules source &amp; license</summary><p>Adapted and summarized for these cards; related Incapacitated effects are expanded for convenience.</p><p>${CONDITION_ATTRIBUTION}</p></details>`;
  return {
    name: condition.name, description: text, face: 0, sort: (index + 1) * 100000,
    faces: [{ name: condition.name, text, img: "icons/svg/book.svg" }],
    flags: { [MODULE_ID]: { conditionRules: "2024" } }
  };
}

let conditionsDeckCreation;
async function createConditionsDeck() {
  if (!game.user.isGM) throw new Error("Only a GM can create the Conditions deck.");
  if (conditionsDeckCreation) return conditionsDeckCreation;
  conditionsDeckCreation = (async () => {
    const decks = Array.from(game.cards?.contents ?? game.cards?.values() ?? []);
    const existing = decks.find(deck => deck.type === "deck" && isConditionsDeck(deck));
    // Never overwrite a GM's card edits or permission changes when reopening.
    if (existing) return existing;
    const CardsClass = getDocumentClass("Cards");
    return CardsClass.create({
      name: "Conditions — 2024", type: "deck", img: "icons/svg/book.svg",
      description: `<p>Open this deck in Cards and choose View Card to read a condition. Compatible with fifth edition (2024 rules).</p><p>${CONDITION_ATTRIBUTION}</p>`,
      ownership: { default: CONST.DOCUMENT_OWNERSHIP_LEVELS.OBSERVER },
      flags: { [MODULE_ID]: { conditionsReference: "2024" } },
      cards: CONDITIONS_2024.map(conditionCardData)
    });
  })();
  try { return await conditionsDeckCreation; }
  finally { conditionsDeckCreation = null; }
}
