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
      createQuest: () => new QuestCardCreator().render({ force: true }),
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

class QuestCardCreator extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "quest-viewer-card-creator", tag: "form",
    window: { title: "Adventurer’s Cards — Card Creator", resizable: true },
    position: { width: 560, height: "auto" },
    form: { closeOnSubmit: false, handler: QuestCardCreator.#onSubmit },
    actions: { preview: QuestCardCreator.#onPreview }
  };
  static PARTS = { form: { template: "modules/quest-viewer/templates/card-creator.hbs" } };

  async _prepareContext(options) {
    const context = await super._prepareContext(options);
    const selected = new Set(getSelectedDeckIds());
    const decks = game.user.isGM ? Array.from(game.cards.values())
      .filter(deck => deck.type === "deck" && !isConditionsDeck(deck))
      .sort((a, b) => Number(selected.has(b.id)) - Number(selected.has(a.id)) || String(a.name || "").localeCompare(String(b.name || "")))
      .map(deck => ({ id: deck.id, name: deck.name || "Unnamed Deck", configured: selected.has(deck.id) })) : [];
    return { ...context, decks, hasDecks: decks.length > 0 };
  }

  static #onPreview() {
    if (!game.user.isGM) return;
    try {
      const data = Object.fromEntries(new FormData(this.element));
      const card = questCardData(data);
      new foundry.applications.api.DialogV2({
        window: { title: "Quest card preview", resizable: true },
        content: sharedCardContent(card, true),
        buttons: [{ action: "close", label: "Close" }]
      }).render({ force: true });
    } catch (err) { ui.notifications.error(err.message); }
  }

  static async #onSubmit(_event, _form, formData) {
    if (this.creating) return;
    this.creating = true;
    const submit = this.element.querySelector('[type="submit"]');
    if (submit) submit.disabled = true;
    try {
      const card = await createQuestCard(formData.object);
      ui.notifications.info(`Created ${card.name}. Select its deck in Choose Decks to enable quest viewing and automatic popups.`);
      await this.close();
      card.parent.sheet?.render({ force: true });
    } catch (err) {
      console.error(`${MODULE_ID} | Card creation failed`, err);
      ui.notifications.error(err.message);
    } finally {
      this.creating = false;
      if (submit) submit.disabled = false;
    }
  }
}

// Cards sidebar, including its pop-out and legacy jQuery render hook.
Hooks.on("renderCardsDirectory", (_app, html) => {
  const root = html?.querySelector ? html : html?.[0];
  if (!root) return;
  root.querySelectorAll(".qv-create-quest-sidebar").forEach(button => button.remove());
  if (!game.user.isGM) return;
  const header = root.querySelector(".directory-header");
  if (!header) return;
  const button = root.ownerDocument.createElement("button");
  button.type = "button";
  button.className = "qv-create-quest-sidebar";
  button.innerHTML = '<i class="fa-solid fa-feather-pointed" aria-hidden="true"></i> Create Quest Card';
  button.addEventListener("click", event => {
    event.preventDefault();
    event.stopPropagation();
    if (game.user.isGM) new QuestCardCreator().render({ force: true });
  });
  const actions = header.querySelector(".header-actions");
  if (actions) actions.after(button);
  else header.append(button);
});

function questCardData(input) {
  const read = (key, limit) => {
    const value = String(input[key] ?? "").trim();
    if (value.length > limit) throw new Error(`${key} is too long (maximum ${limit} characters).`);
    return value;
  };
  const name = read("title", 200);
  if (!name) throw new Error("Enter a title for your quest card.");
  const description = read("description", 10000);
  const objectives = read("objectives", 5000).split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  const rewards = read("rewards", 5000);
  const backText = read("backText", 10000);
  const paragraphs = value => value.split(/\r?\n\s*\r?\n/).filter(Boolean)
    .map(part => `<p>${escapeHTML(part).replace(/\r?\n/g, "<br>")}</p>`).join("");
  const showHeadings = input.showHeadings === true || input.showHeadings === "on";
  const objectiveChecks = Object.fromEntries(objectives.map((line, i) => [`o${i}`, /^\[x\]\s*/i.test(line)]));
  const text = paragraphs(description)
    + (objectives.length ? `${showHeadings ? '<h3>Objectives</h3>' : ''}<ul class="qv-objectives">${objectives.map((line, i) => `<li data-qv-objective="o${i}">${escapeHTML(line.replace(/^\[[ x]\]\s*/i, ''))}</li>`).join("")}</ul>` : "")
    + (rewards ? `${showHeadings ? '<h3>Rewards</h3>' : ''}${paragraphs(rewards)}` : "");
  return {
    name, description: text, face: 0,
    faces: [{ name, text: text || "<p>No quest details have been added yet.</p>", img: QUEST_ICON }],
    back: { name: "Quest", text: paragraphs(backText), img: QUEST_ICON },
    flags: { [MODULE_ID]: { status: "active", objectiveChecks, font: validFont(input.font), fontSize: validFontSize(input.fontSize) } }
  };
}

async function createQuestCard(input) {
  if (!game.user.isGM) throw new Error("Only the GM can create quest cards.");
  const deck = game.cards.get(input.deckId);
  if (!deck || deck.type !== "deck" || isConditionsDeck(deck)) {
    throw new Error("Choose an existing quest deck. Rules reference decks cannot be used.");
  }
  const data = questCardData(input);
  const [card] = await deck.createEmbeddedDocuments("Card", [data]);
  if (!card) throw new Error("Foundry did not return a new card. Check the deck before retrying.");
  return card;
}

Hooks.once("init", () => {
  game.settings.registerMenu(MODULE_ID, "cardCreator", {
    name: "Card Creator", label: "Create Quest Card", icon: "fa-solid fa-feather-pointed",
    hint: "Create a quest card with objectives, rewards, and the quest emblem.",
    type: QuestCardCreator, restricted: true
  });
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
  if (isSyncGM()) {
    for (const id of getSelectedDeckIds()) {
      const deck = game.cards.get(id);
      if (deck?.type === 'deck' && !isConditionsDeck(deck)) {
        for (const card of deck.cards.values()) await queueQuestSync(card);
      }
    }
  }
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

const QUEST_FONTS = { serif: "Classic serif", sans: "Clear sans-serif", mono: "Monospace" };
const QUEST_SIZES = { small: "Small", normal: "Normal", large: "Large" };
function validFont(value) { return Object.hasOwn(QUEST_FONTS, value) ? value : "serif"; }
function validFontSize(value) { return Object.hasOwn(QUEST_SIZES, value) ? value : "normal"; }
function questFlag(card, key) { return card.getFlag?.(MODULE_ID, key) ?? card.flags?.[MODULE_ID]?.[key]; }
function canEditQuestProgress(card) {
  return !isConditionCard(card) && (game.user.isGM || (card.parent?.type === "hand"
    && card.parent.testUserPermission?.(game.user, "OWNER")));
}
async function assertQuestProgressAccess(card) {
  if (!canEditQuestProgress(card) || card.parent?.cards.get(card.id) !== card
    || !(await isConfiguredQuestCard(card)) || !canEditQuestProgress(card)) {
    throw new Error("You no longer have permission to edit this quest card.");
  }
}
function objectiveTemplate(card) {
  const template = document.createElement('template');
  template.innerHTML = getFaceText(card);
  // Recognize cards made by older versions without rewriting their stored text.
  for (const heading of template.content.querySelectorAll('h3')) {
    if (heading.textContent.trim().toLowerCase() === 'objectives' && heading.nextElementSibling?.matches('ul')) {
      heading.nextElementSibling.classList.add('qv-objectives');
    }
  }
  const seen = new Set();
  for (const [index, li] of Array.from(template.content.querySelectorAll('.qv-objectives > li')).entries()) {
    let key = li.dataset.qvObjective;
    if (!key || !/^[a-zA-Z0-9_-]{1,64}$/.test(key) || ['__proto__', 'constructor', 'prototype'].includes(key) || seen.has(key)) {
      // Text-derived IDs keep legacy progress stable when rows are reordered.
      let hash = 2166136261;
      for (const c of li.textContent) hash = Math.imul(hash ^ c.charCodeAt(0), 16777619);
      key = `legacy${hash >>> 0}`;
      if (seen.has(key)) key += `_${index}`;
    }
    seen.add(key); li.dataset.qvObjective = key;
  }
  if (questFlag(card, 'hideHeadings') === true) {
    for (const h of template.content.querySelectorAll('h3')) {
      if (/^(objectives|rewards)$/i.test(h.textContent.trim())) h.remove();
    }
  }
  return template;
}
function questObjectiveHTML(card) {
  const template = objectiveTemplate(card);
  const checked = questFlag(card, 'objectiveChecks') || {};
  for (const li of template.content.querySelectorAll('.qv-objectives > li')) {
    const key = li.dataset.qvObjective;
    const content = li.innerHTML;
    li.innerHTML = `<label><input type="checkbox" data-qv-check="${key}" ${checked[key] === true ? 'checked' : ''} ${canEditQuestProgress(card) ? '' : 'disabled'}><span>${content}</span></label>`;
  }
  return template.innerHTML;
}
async function setQuestObjective(card, key, checked) {
  await assertQuestProgressAccess(card);
  const keys = Array.from(objectiveTemplate(card).content.querySelectorAll('[data-qv-objective]'), li => li.dataset.qvObjective);
  if (!keys.includes(key) || typeof checked !== 'boolean') throw new Error("This objective is no longer available.");
  await card.update({ [`flags.${MODULE_ID}.objectiveChecks.${key}`]: checked });
}
async function setQuestNotes(card, notes) {
  await assertQuestProgressAccess(card);
  if (typeof notes !== 'string' || notes.length > 10000) throw new Error("Notes must be at most 10,000 characters.");
  await card.setFlag(MODULE_ID, 'notes', notes);
}
const questNotesEditors = new Map();
async function openQuestNotes(card) {
  try {
    await assertQuestProgressAccess(card);
    const key = card.uuid || `${card.parent.id}.${card.id}`;
    const existing = questNotesEditors.get(key);
    if (existing) { existing.bringToFront?.(); return existing; }
    const editor = new foundry.applications.api.DialogV2({
      window: { title: `Notes — ${card.name}`, resizable: true },
      position: { width: 480 },
      form: { closeOnSubmit: false },
      content: `<label class="qv-notes-editor">Notes on this card copy
        <textarea data-qv-notes maxlength="10000" rows="10">${escapeHTML(questFlag(card, 'notes') || '')}</textarea>
        </label><p>Visible to the GM and other owners of this Hand. Save &amp; Close keeps your changes; Cancel or the window X discards them.</p>`,
      buttons: [
        { action: 'save', label: 'Save & Close', icon: 'fa-solid fa-floppy-disk', callback: async (_event, _button, dialog) => {
          try {
            await setQuestNotes(card, dialog.element.querySelector('[data-qv-notes]').value);
            await dialog.close();
          } catch (err) { ui.notifications.error(err.message); }
        } },
        { action: 'cancel', label: 'Cancel', callback: (_event, _button, dialog) => dialog.close() }
      ]
    });
    questNotesEditors.set(key, editor);
    editor.addEventListener('close', () => questNotesEditors.delete(key), { once: true });
    editor.render({ force: true });
    return editor;
  } catch (err) { ui.notifications.error(err.message); }
}

function questOriginId(card) {
  const origin = card.source ?? card.origin ?? card._source?.origin;
  if (origin && typeof origin === 'object') return origin.id;
  return typeof origin === 'string' ? (/^Cards\.([^.]+)/.exec(origin)?.[1] || origin) : null;
}
function isContentChange(changes) {
  return ['name', 'description', 'faces', 'back'].some(key => Object.hasOwn(changes, key))
    || Object.keys(changes).some(key => /^(faces|back)\./.test(key))
    || ['font', 'fontSize', 'hideHeadings'].some(key => [key, `-=${key}`].some(field => Object.hasOwn(changes, `flags.${MODULE_ID}.${field}`)
      || Object.hasOwn(changes.flags?.[MODULE_ID] || {}, field)));
}
function isSyncGM() {
  if (!game.user.isGM) return false;
  const activeGM = game.users?.activeGM || Array.from(game.users?.values?.() || []).find(user => user.isGM && user.active);
  return activeGM?.id === game.user.id;
}
async function syncQuestCopies(source) {
  if (!isSyncGM() || source.parent?.type !== 'deck' || isConditionCard(source)
    || !getSelectedDeckIds().includes(source.parent.id) || source.parent.cards.get(source.id) !== source) return;
  const data = source.toObject();
  for (const hand of game.cards.values()) {
    if (hand.type !== 'hand') continue;
    const copy = hand.cards.get(source.id);
    if (!copy || isConditionCard(copy) || questOriginId(copy) !== source.parent.id) continue;
    const current = copy.toObject();
    const update = { _id: copy.id };
    for (const key of ['name', 'description', 'faces', 'back']) {
      if (JSON.stringify(current[key]) !== JSON.stringify(data[key])) update[key] = data[key];
    }
    for (const [key, value] of Object.entries({ font: validFont(questFlag(source, 'font')), fontSize: validFontSize(questFlag(source, 'fontSize')), hideHeadings: questFlag(source, 'hideHeadings') === true })) {
      if (questFlag(copy, key) !== value) update[`flags.${MODULE_ID}.${key}`] = value;
    }
    if (Number.isInteger(copy.face) && copy.face >= data.faces.length) update.face = 0;
    // Never copy status, objectiveChecks, notes, ownership, sort, origin or drawn.
    if (Object.keys(update).length > 1) await hand.updateEmbeddedDocuments('Card', [update]);
  }
}
const questSyncQueues = new Map();
function queueQuestSync(source) {
  if (!isSyncGM() || source.parent?.type !== 'deck') return Promise.resolve();
  const key = `${source.parent.id}.${source.id}`;
  const task = (questSyncQueues.get(key) || Promise.resolve()).then(() => syncQuestCopies(source))
    .catch(err => { console.error(`${MODULE_ID} | Quest content sync failed`, err); ui.notifications.warn('A quest copy could not be updated. Check Hand permissions and try editing the source again.'); });
  questSyncQueues.set(key, task);
  task.finally(() => { if (questSyncQueues.get(key) === task) questSyncQueues.delete(key); });
  return task;
}

function getQuestStatus(card) {
  const status = questFlag(card, "status");
  return Object.hasOwn(QUEST_STATUSES, status) ? status : "active";
}

function statusBadgeHTML(card) {
  const status = getQuestStatus(card);
  return `<span class="qv-status-badge qv-status-${status}" aria-label="Quest status: ${QUEST_STATUSES[status]}">${QUEST_STATUSES[status]}</span>`;
}

async function setQuestStatus(card, status) {
  if (!canEditQuestProgress(card)) throw new Error("You must own this Hand to change quest progress.");
  if (!Object.hasOwn(QUEST_STATUSES, status)) throw new Error("Invalid quest status.");
  if (card.parent?.cards.get(card.id) !== card || !(await isConfiguredQuestCard(card))) {
    throw new Error("This quest card is no longer available.");
  }
  if (!canEditQuestProgress(card) || card.parent.cards.get(card.id) !== card) throw new Error("This quest card is no longer available.");
  await card.setFlag(MODULE_ID, "status", status);
}

const questViewers = new Map();
function sameQuestCard(a, b) {
  return a === b || (a.uuid && a.uuid === b.uuid);
}
Hooks.on("updateCard", (card, changes = {}) => {
  for (const entry of questViewers.values()) {
    if (sameQuestCard(entry.card, card)) entry.refresh();
  }
  if (isContentChange(changes)) queueQuestSync(card);
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
  const text = showingFront ? questObjectiveHTML(card) : getBackText(card);
  const title = showingFront ? card.name : (card.back?.name || "Quest");

  return `
    <div class="qv-viewer-wrapper">
      <article class="qv-card qv-font-${validFont(questFlag(card, 'font'))} qv-size-${validFontSize(questFlag(card, 'fontSize'))}${showingFront ? "" : " qv-card--back"}${!showingFront && !card.back?.text ? " qv-card--sealed" : ""}" data-qv-flip role="button" tabindex="0"
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
      ${canEditQuestProgress(card) ? `<label class="qv-status-control">Quest status
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
    form: { closeOnSubmit: false },
    buttons: [...(game.user.isGM ? [{
      action: "showPlayers",
      label: "Show Card to Players",
      icon: "fa-solid fa-eye",
      callback: () => chooseCardRecipients(card, showingFront)
    }] : []), ...(canEditQuestProgress(card) ? [{ action: "notes", label: "Notes", icon: "fa-solid fa-note-sticky", callback: () => openQuestNotes(card) }] : []), {
      action: "close",
      label: "Close",
      icon: "fa-solid fa-xmark",
      callback: (_event, _button, dialog) => dialog.close()
    }]
  });

  // Direct DialogV2 instances emit a render event. The render callback option
  // is only wired up by DialogV2.wait/prompt/confirm, not by the constructor.
  viewer.addEventListener("render", () => {
      const dialog = viewer;
      const currentWrapper = dialog.element.querySelector(".qv-viewer-wrapper");
      if (currentWrapper) currentWrapper.outerHTML = buildCardHTML(card, showingFront);
      const attachFlip = () => {
        for (const input of dialog.element.querySelectorAll('[data-qv-check]')) {
          input.addEventListener('click', event => event.stopPropagation());
          input.addEventListener('keydown', event => event.stopPropagation());
          input.closest('label')?.addEventListener('click', event => event.stopPropagation());
          input.addEventListener('change', async () => {
            input.disabled = true;
            try { await setQuestObjective(card, input.dataset.qvCheck, input.checked); }
            catch (err) { input.checked = !input.checked; ui.notifications.error(err.message); }
            finally { input.disabled = !canEditQuestProgress(card); }
          });
        }
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
  if (hand.type === "deck") return game.user.isGM && getSelectedDeckIds().includes(hand.id);
  return hand.type === "hand" && (game.user.isGM || hand.testUserPermission(game.user, "OWNER"));
}

// An older asynchronous render must not add controls after a newer render.
const dealSelections = new WeakMap();
const dealingDecks = new Set();
async function dealSelectedQuests(deck, handId, ids) {
  if (!game.user.isGM || deck?.type !== 'deck' || game.cards.get(deck.id) !== deck
    || isConditionsDeck(deck) || !getSelectedDeckIds().includes(deck.id)) throw new Error('Only the GM can deal from a configured quest deck.');
  const hand = game.cards.get(handId);
  if (!hand || hand.type !== 'hand') throw new Error('Choose a destination Hand.');
  const chosen = [...new Set(ids)];
  if (!chosen.length || chosen.some(id => {
    const card = deck.cards.get(id);
    return !card || card.drawn || isConditionCard(card) || hand.cards.has(id);
  })) throw new Error('Some selected cards are unavailable or already dealt. Refresh the deck and select again.');
  if (dealingDecks.has(deck.id)) throw new Error('This deck is already dealing cards.');
  dealingDecks.add(deck.id);
  try { return await deck.pass(hand, chosen, { chatNotification: false }); }
  finally { dealingDecks.delete(deck.id); }
}
function addSelectiveDealControls(app, root, deck) {
  root.querySelectorAll('.qv-deal-select, .qv-deal-toolbar').forEach(node => node.remove());
  if (!game.user.isGM || deck.type !== 'deck' || isConditionsDeck(deck) || !getSelectedDeckIds().includes(deck.id)) return;
  let selection = dealSelections.get(app);
  if (!selection) { selection = new Set(); dealSelections.set(app, selection); }
  const eligible = id => { const card = deck.cards.get(id); return card && !card.drawn && !isConditionCard(card); };
  for (const id of selection) if (!eligible(id)) selection.delete(id);
  const toolbar = root.ownerDocument.createElement('div'); toolbar.className = 'qv-deal-toolbar';
  const deal = root.ownerDocument.createElement('button'); deal.type = 'button';
  const update = () => { deal.textContent = `Deal Selected (${selection.size})`; deal.disabled = !selection.size; };
  toolbar.append(deal); update();
  for (const row of root.querySelectorAll('li[data-card-id]')) {
    const id = row.dataset.cardId;
    if (!eligible(id)) continue;
    const input = root.ownerDocument.createElement('input'); input.type = 'checkbox'; input.className = 'qv-deal-select';
    input.checked = selection.has(id); input.setAttribute('aria-label', `Select ${deck.cards.get(id).name} to deal`);
    input.addEventListener('click', event => event.stopPropagation());
    input.addEventListener('change', event => { event.stopPropagation(); if (input.checked) selection.add(id); else selection.delete(id); update(); });
    row.prepend(input);
  }
  const header = root.querySelector('.cards-header');
  if (header) header.after(toolbar); else root.prepend(toolbar);
  deal.addEventListener('click', async event => {
    event.preventDefault(); event.stopPropagation();
    if (!game.user.isGM || !selection.size || deal.disabled) return;
    const ids = [...selection]; deal.disabled = true;
    try {
      const hands = Array.from(game.cards.values()).filter(hand => hand.type === 'hand');
      if (!hands.length) throw new Error('Create a Hand before dealing cards.');
      const handId = await foundry.applications.api.DialogV2.wait({
        window: { title: 'Deal Selected Quest Cards' },
        content: `<p>Deal these ${ids.length} selected cards to:</p><select name="hand">${hands.map(hand => `<option value="${escapeHTML(hand.id)}">${escapeHTML(hand.name)}</option>`).join('')}</select>`,
        buttons: [{ action: 'deal', label: 'Deal Cards', callback: (_e, _b, dialog) => dialog.element.querySelector('[name="hand"]').value }, { action: 'cancel', label: 'Cancel', default: true }], rejectClose: false
      });
      if (!hands.some(hand => hand.id === handId)) return;
      const created = await dealSelectedQuests(deck, handId, ids);
      if (created.length !== ids.length) throw new Error('Not all selected cards were dealt. Check the Hand before retrying.');
      for (const id of ids) selection.delete(id);
      ui.notifications.info(`Dealt ${created.length} quest card(s).`);
      app.render({ force: true });
    } catch (err) { ui.notifications.error(err.message); }
    finally { update(); }
  });
}

const handRenderTokens = new WeakMap();

async function addViewCardButtons(app, html) {
  const hand = app.document ?? app.object;
  if (hand?.documentName !== "Cards" || !["hand", "deck"].includes(hand.type)) return;
  const root = html?.querySelectorAll ? html : html?.[0];
  if (!root) return;
  addSelectiveDealControls(app, root, hand);
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

// Use server-authorized whispered ChatMessages rather than trusting socket sender IDs.
// Only the visible side is serialized; recipients never need ownership of the source.
function sharedCardContent(card, showingFront) {
  const template = document.createElement("template");
  template.innerHTML = buildCardHTML(card, showingFront);
  template.content.querySelectorAll(".qv-status-control, .qv-notes-control, .qv-card-hint").forEach(node => node.remove());
  template.content.querySelectorAll('[data-qv-check]').forEach(input => { input.disabled = true; input.removeAttribute('data-qv-check'); });
  const article = template.content.querySelector(".qv-card");
  for (const attribute of ["data-qv-flip", "role", "tabindex", "aria-label"]) article.removeAttribute(attribute);
  return `<div class="qv-shared-card">${template.innerHTML}</div>`;
}

async function shareCardToPlayers(card, showingFront, recipientIds) {
  if (!game.user.isGM) throw new Error("Only the GM can show cards to players.");
  if (card.parent?.cards.get(card.id) !== card
    || !(isConditionCard(card) || await isConfiguredQuestCard(card))) {
    throw new Error("This card is no longer available for sharing.");
  }
  const recipients = [...new Set(recipientIds)].filter(id => {
    const user = game.users.get(id);
    return user && !user.isGM && user.active;
  });
  if (!recipients.length) throw new Error("Select at least one connected player.");
  if (!game.user.isGM || card.parent.cards.get(card.id) !== card) throw new Error("This card is no longer available for sharing.");
  return ChatMessage.create({
    speaker: { alias: game.user.name },
    whisper: recipients,
    blind: false,
    content: sharedCardContent(card, showingFront),
    flags: { [MODULE_ID]: { sharedCard: true, sharedSource: {
      cardId: card.id, deckId: card.parent?.type === 'deck' ? card.parent.id : questOriginId(card),
      handId: card.parent?.type === 'hand' ? card.parent.id : null
    } } }
  });
}

async function chooseCardRecipients(card, showingFront) {
  if (!game.user.isGM) return;
  const players = Array.from(game.users.values()).filter(user => !user.isGM && user.active);
  if (!players.length) {
    ui.notifications.warn("No players are connected. Try again when a player joins.");
    return;
  }
  const choices = players.map(user => `<label class="qv-recipient"><input type="checkbox" name="recipient" value="${escapeHTML(user.id)}" checked> ${escapeHTML(user.name)}</label>`).join("");
  const selected = await foundry.applications.api.DialogV2.wait({
    window: { title: "Show Card to Players" },
    content: `<p>Show <strong>${escapeHTML(card.name)}</strong> (${isConditionCard(card) ? "reference" : showingFront ? "front" : "back"}). Only this side will be shared.</p>
      <p>All connected players are selected. Uncheck anyone who should not see it.</p>
      <fieldset class="qv-recipients"><legend>Players</legend>${choices}</fieldset>
      <p>Selected players get a popup and a private chat copy. This does not deal the card or change ownership.</p>`,
    buttons: [
      { action: "show", label: "Show Card", icon: "fa-solid fa-eye", callback: (_event, _button, dialog) =>
        Array.from(dialog.element.querySelectorAll('input[name="recipient"]:checked'), input => input.value) },
      { action: "cancel", label: "Cancel", default: true, callback: () => null }
    ],
    rejectClose: false
  });
  if (!Array.isArray(selected)) return;
  try {
    await shareCardToPlayers(card, showingFront, selected);
    ui.notifications.info("Card shared with the selected connected players.");
  } catch (err) {
    console.error(`${MODULE_ID} | Could not share card`, err);
    ui.notifications.error(err.message);
  }
}

const shownSharedMessages = new Set();
function sharedContentForPlayer(message) {
  const source = message.getFlag(MODULE_ID, 'sharedSource');
  if (!source || typeof source !== 'object') return message.content;
  const matches = Array.from(game.cards.values()).filter(hand => hand.type === 'hand'
    && hand.testUserPermission?.(game.user, 'OWNER'))
    .map(hand => hand.cards.get(source.cardId)).filter(card => card && !isConditionCard(card)
      && (source.handId ? card.parent.id === source.handId : questOriginId(card) === source.deckId));
  if (matches.length !== 1) return message.content;
  const card = matches[0];
  const template = document.createElement('template'); template.innerHTML = message.content;
  const badge = template.content.querySelector('.qv-status-badge');
  if (badge) badge.outerHTML = statusBadgeHTML(card);
  const checked = questFlag(card, 'objectiveChecks') || {};
  for (const li of template.content.querySelectorAll('[data-qv-objective]')) {
    const checkbox = li.querySelector('input[type="checkbox"]');
    if (checkbox) checkbox.toggleAttribute('checked', checked[li.dataset.qvObjective] === true);
  }
  return template.innerHTML;
}
Hooks.on("createChatMessage", message => {
  if (!message.author?.isGM || !message.getFlag(MODULE_ID, "sharedCard")
    || game.user.isGM || !message.whisper?.includes(game.user.id)
    || !message.isContentVisible || shownSharedMessages.has(message.id)) return;
  shownSharedMessages.add(message.id);
  if (shownSharedMessages.size > 100) shownSharedMessages.delete(shownSharedMessages.values().next().value);
  new foundry.applications.api.DialogV2({
    window: { title: "Card shared by the GM", resizable: true },
    content: sharedContentForPlayer(message),
    buttons: [{ action: "close", label: "Close", icon: "fa-solid fa-xmark" }]
  }).render({ force: true });
});

function renderSharedQuestMessage(message, html) {
  if (!message.author?.isGM || !message.getFlag(MODULE_ID, 'sharedCard')
    || !message.isContentVisible || game.user.isGM) return;
  const root = html?.querySelector ? html : html?.[0];
  const content = root?.querySelector('.qv-shared-card');
  if (content) content.outerHTML = sharedContentForPlayer(message);
}
Hooks.on('renderChatMessageHTML', renderSharedQuestMessage);
Hooks.on('renderChatMessage', renderSharedQuestMessage);

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
