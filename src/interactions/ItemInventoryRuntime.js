const ITEM_STATES = Object.freeze({
  WORLD: "world",
  GRABBED: "grabbed",
  INVENTORY: "inventory",
  EQUIPPED: "equipped",
  SPECIAL_VIEW: "specialView",
});

const NOTHING_SLOT = Object.freeze({
  index: 0,
  id: "nothing",
  label: "Nothing",
  icon: "nothing",
  state: "nothing",
});

export class ItemInventoryRuntime {
  constructor({
    capacity = 2,
    feedbackDelaySeconds = 0.18,
    takeSeconds = 0.5,
    applyItemState = () => {},
    updateHandledItem = () => {},
    activateItem = () => false,
    openSpecialView = () => false,
    setHoldProgress = () => {},
    presentSelector = () => {},
    onStored = () => {},
    onSpecialViewOpened = () => {},
  } = {}) {
    this.capacity = Math.max(1, Math.trunc(capacity));
    this.feedbackDelaySeconds = Math.max(0, Number(feedbackDelaySeconds) || 0);
    this.takeSeconds = Math.max(this.feedbackDelaySeconds + 0.01, Number(takeSeconds) || 0.5);
    this.applyItemState = applyItemState;
    this.updateHandledItem = updateHandledItem;
    this.activateItem = activateItem;
    this.openSpecialView = openSpecialView;
    this.setHoldProgress = setHoldProgress;
    this.presentSelector = presentSelector;
    this.onStored = onStored;
    this.onSpecialViewOpened = onSpecialViewOpened;

    this.itemsByTarget = new Map();
    this.itemsById = new Map();
    this.slots = Array.from({ length: this.capacity }, () => null);
    this.grabbedItem = null;
    this.activeItem = null;
    this.activeSlotIndex = 0;
    this.selectorIndex = 0;
    this.selectorOpen = false;
    this.selectionClock = 0;
    this.primary = null;
  }

  register(item) {
    if (!item?.id || !item.target) return null;
    const record = {
      state: ITEM_STATES.WORLD,
      portable: false,
      activationMode: "none",
      label: item.id,
      icon: "item",
      selectedAt: 0,
      ...item,
    };
    this.itemsById.set(record.id, record);
    this.itemsByTarget.set(record.target, record);
    return record;
  }

  unregister(itemOrId) {
    const item = this.resolveItem(itemOrId);
    if (!item) return false;
    this.cancelPrimary();
    this.removeFromInventory(item);
    if (this.grabbedItem === item) this.grabbedItem = null;
    if (this.activeItem === item) this.clearActiveItem();
    this.itemsById.delete(item.id);
    this.itemsByTarget.delete(item.target);
    this.publishSelector();
    return true;
  }

  beginPrimary(target) {
    const item = this.itemsByTarget.get(target) ?? this.grabbedItem;
    if (!item || ![ITEM_STATES.WORLD, ITEM_STATES.GRABBED].includes(item.state)) return false;
    this.primary = { item, elapsed: 0, feedbackVisible: false, completed: false };
    return true;
  }

  releasePrimary() {
    const press = this.primary;
    if (!press) return false;
    this.primary = null;
    this.setHoldProgress(0, false);
    if (press.completed) return true;
    if (press.item.state === ITEM_STATES.GRABBED) this.releaseGrabbed();
    else if (press.item.state === ITEM_STATES.WORLD) this.grab(press.item);
    return true;
  }

  cancelPrimary() {
    if (!this.primary) return false;
    this.primary = null;
    this.setHoldProgress(0, false);
    return true;
  }

  update(dt) {
    const delta = Math.max(0, Number(dt) || 0);
    if (this.grabbedItem) this.updateHandledItem(this.grabbedItem, ITEM_STATES.GRABBED, delta);
    if (this.activeItem?.state === ITEM_STATES.EQUIPPED) {
      this.updateHandledItem(this.activeItem, ITEM_STATES.EQUIPPED, delta);
    }
    const press = this.primary;
    if (!press || press.completed || !press.item.portable) return;
    press.elapsed += delta;
    if (press.elapsed >= this.feedbackDelaySeconds) {
      press.feedbackVisible = true;
      const feedbackDuration = this.takeSeconds - this.feedbackDelaySeconds;
      this.setHoldProgress(
        Math.min(1, (press.elapsed - this.feedbackDelaySeconds) / feedbackDuration),
        true,
      );
    }
    if (press.elapsed < this.takeSeconds) return;
    press.completed = true;
    this.setHoldProgress(1, true);
    this.store(press.item);
  }

  grab(itemOrId) {
    const item = this.resolveItem(itemOrId);
    if (!item || item.state !== ITEM_STATES.WORLD) return false;
    if (this.grabbedItem && this.grabbedItem !== item) this.releaseGrabbed();
    this.unequipActive();
    this.grabbedItem = item;
    this.transition(item, ITEM_STATES.GRABBED);
    return true;
  }

  releaseGrabbed(options = {}) {
    const item = this.grabbedItem;
    if (!item) return false;
    this.grabbedItem = null;
    this.transition(item, ITEM_STATES.WORLD, { reason: options.reason ?? "release", ...options });
    return true;
  }

  store(itemOrId) {
    const item = this.resolveItem(itemOrId);
    if (!item?.portable || ![ITEM_STATES.WORLD, ITEM_STATES.GRABBED].includes(item.state)) return false;
    if (this.grabbedItem === item) this.grabbedItem = null;
    let slotIndex = this.slots.findIndex((entry) => entry == null);
    if (slotIndex < 0) {
      slotIndex = this.findLeastRecentlySelectedSlot();
      const displaced = this.slots[slotIndex];
      this.slots[slotIndex] = null;
      if (this.activeItem === displaced) this.clearActiveItem();
      this.transition(displaced, ITEM_STATES.WORLD, { reason: "inventory-replaced" });
    }
    this.slots[slotIndex] = item;
    this.transition(item, ITEM_STATES.INVENTORY, { slotIndex: slotIndex + 1 });
    this.onStored(item, slotIndex + 1);
    this.publishSelector();
    return true;
  }

  beginSelection() {
    if (this.selectorOpen) return false;
    this.selectorOpen = true;
    this.selectorIndex = this.activeSlotIndex;
    this.publishSelector();
    return true;
  }

  moveSelection(direction) {
    if (!this.selectorOpen) return false;
    const entries = this.getSelectorEntries();
    const step = Math.sign(Number(direction) || 0);
    if (!step) return false;
    this.selectorIndex = Math.min(entries.length - 1, Math.max(0, this.selectorIndex + step));
    this.publishSelector();
    return true;
  }

  commitSelection() {
    if (!this.selectorOpen) return false;
    this.selectorOpen = false;
    const index = this.selectorIndex;
    if (this.grabbedItem) this.releaseGrabbed({ reason: "inventory-selection" });
    this.unequipActive();
    if (index === 0) {
      this.activeSlotIndex = 0;
      this.publishSelector();
      return true;
    }
    const item = this.slots[index - 1];
    if (!item) {
      this.activeSlotIndex = 0;
      this.publishSelector();
      return true;
    }
    item.selectedAt = ++this.selectionClock;
    this.activeSlotIndex = index;
    this.activeItem = item;
    if (item.activationMode === "specialView") {
      const opened = this.openSpecialView(item);
      if (opened === false) {
        this.activeItem = null;
        this.activeSlotIndex = 0;
      } else {
        this.transition(item, ITEM_STATES.SPECIAL_VIEW, { slotIndex: index });
        this.onSpecialViewOpened(item);
      }
    } else {
      this.transition(item, ITEM_STATES.EQUIPPED, { slotIndex: index });
    }
    this.publishSelector();
    return true;
  }

  cancelSelection() {
    if (!this.selectorOpen) return false;
    this.selectorOpen = false;
    this.selectorIndex = this.activeSlotIndex;
    this.publishSelector();
    return true;
  }

  activateRelevant(target = null) {
    const targeted = this.itemsByTarget.get(target);
    const item = this.activeItem?.state === ITEM_STATES.EQUIPPED
      ? this.activeItem
      : this.grabbedItem ?? targeted;
    if (!item || item.activationMode === "none") return false;
    return this.activateItem(item) !== false;
  }

  dropHandled(options = {}) {
    if (this.activeItem?.state === ITEM_STATES.SPECIAL_VIEW) {
      return this.closeSpecialView({ drop: true, ...options });
    }
    if (this.activeItem?.state === ITEM_STATES.EQUIPPED) {
      const item = this.activeItem;
      this.removeFromInventory(item);
      this.clearActiveItem();
      this.transition(item, ITEM_STATES.WORLD, { reason: "drop-equipped", ...options });
      this.publishSelector();
      return true;
    }
    return this.releaseGrabbed({ reason: "drop-grabbed", ...options });
  }

  closeSpecialView({ drop = false, ...options } = {}) {
    const item = this.activeItem;
    if (!item || item.state !== ITEM_STATES.SPECIAL_VIEW) return false;
    this.clearActiveItem();
    if (drop) {
      this.removeFromInventory(item);
      this.transition(item, ITEM_STATES.WORLD, { reason: "drop-special-view", ...options });
    } else {
      this.transition(item, ITEM_STATES.INVENTORY, { reason: "close-special-view" });
    }
    this.publishSelector();
    return true;
  }

  getSnapshot() {
    return {
      selectorOpen: this.selectorOpen,
      selectorIndex: this.selectorIndex,
      activeSlotIndex: this.activeSlotIndex,
      grabbedItemId: this.grabbedItem?.id ?? null,
      activeItemId: this.activeItem?.id ?? null,
      slots: this.slots.map((item, index) => item ? this.toEntry(item, index + 1) : null),
    };
  }

  getSelectorEntries() {
    return [NOTHING_SLOT, ...this.slots.map((item, index) => item
      ? this.toEntry(item, index + 1)
      : { index: index + 1, id: `empty-${index + 1}`, label: "Empty", icon: "empty", state: "empty" })];
  }

  findLeastRecentlySelectedSlot() {
    let candidate = 0;
    for (let index = 1; index < this.slots.length; index += 1) {
      if ((this.slots[index]?.selectedAt ?? 0) < (this.slots[candidate]?.selectedAt ?? 0)) candidate = index;
    }
    return candidate;
  }

  unequipActive() {
    const item = this.activeItem;
    if (!item) return false;
    if ([ITEM_STATES.EQUIPPED, ITEM_STATES.SPECIAL_VIEW].includes(item.state)) {
      this.transition(item, ITEM_STATES.INVENTORY, { reason: "unequip" });
    }
    this.clearActiveItem();
    return true;
  }

  clearActiveItem() {
    this.activeItem = null;
    this.activeSlotIndex = 0;
  }

  removeFromInventory(item) {
    const slotIndex = this.slots.indexOf(item);
    if (slotIndex < 0) return false;
    this.slots[slotIndex] = null;
    return true;
  }

  transition(item, state, context = {}) {
    const previousState = item.state;
    item.state = state;
    this.applyItemState(item, state, { ...context, previousState });
  }

  resolveItem(itemOrId) {
    if (!itemOrId) return null;
    if (typeof itemOrId === "string") return this.itemsById.get(itemOrId) ?? null;
    return itemOrId.id ? this.itemsById.get(itemOrId.id) ?? itemOrId : null;
  }

  toEntry(item, index) {
    return { index, id: item.id, label: item.label, icon: item.icon, state: item.state };
  }

  publishSelector() {
    this.presentSelector({
      open: this.selectorOpen,
      selectedIndex: this.selectorOpen ? this.selectorIndex : this.activeSlotIndex,
      entries: this.getSelectorEntries(),
    });
  }
}

export { ITEM_STATES };
