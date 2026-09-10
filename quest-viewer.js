const MODULE_ID = "quest-viewer";
const LEGACY_DECK_NAMES_KEY = "deckNames";
const SELECTED_DECKS_KEY = "selectedDecks";

/**
 * Deck selector settings submenu.
 *
 * Foundry still supports FormApplication-based settings submenus in v13,
 * and this approach also keeps the module compact and dependency-free.
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
      <h1>QUEST</h1>
      <p>Quest Card</p>
    </div>
  `;
}

async function isConfiguredQuestCard(card) {
  const selected = new Set(getSelectedDeckIds());
  if (!selected.size) return false;

  // Most reliable case: a dealt card retains an origin UUID.
  if (card.origin) {
    try {
      const original = await fromUuid(card.origin);
      if (original?.parent?.id && selected.has(original.parent.id)) {
        return true;
      }
    } catch (err) {
      console.warn(`${MODULE_ID} | Could not resolve card origin`, err);
    }
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

function buildCardHTML(card, showingFront) {
  const text = showingFront ? getFaceText(card) : getBackText(card);
  const title = showingFront ? card.name : (card.back?.name || "Quest");

  return `
    <div class="qv-viewer-wrapper">
      <article class="qv-card" data-qv-flip role="button" tabindex="0"
               aria-label="Flip ${escapeHTML(card.name)}">
        <header class="qv-card-title">${escapeHTML(title)}</header>
        <section class="qv-card-body">${text}</section>
        <footer class="qv-card-footer">• QUEST •</footer>
        <div class="qv-card-hint">
          <i class="fa-solid fa-rotate"></i>
          Click to flip
        </div>
      </article>
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
    }],
    render: (event, dialog) => {
      const attachFlip = () => {
        const element = dialog.element.querySelector("[data-qv-flip]");
        if (!element) return;

        const flip = () => {
          showingFront = !showingFront;

          const wrapper = dialog.element.querySelector(".qv-viewer-wrapper");
          if (!wrapper) return;

          wrapper.outerHTML = buildCardHTML(card, showingFront);
          attachFlip();
        };

        element.addEventListener("click", flip);
        element.addEventListener("keydown", event => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            flip();
          }
        });
      };

      attachFlip();
    }
  });

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
