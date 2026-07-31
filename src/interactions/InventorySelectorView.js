export function createInventorySelectorView({ root = document.body } = {}) {
  const element = document.createElement("div");
  element.className = "inventory-selector";
  element.hidden = true;
  element.setAttribute("aria-hidden", "true");
  root.append(element);

  function present({ open, selectedIndex, entries }) {
    element.hidden = !open;
    element.setAttribute("aria-hidden", open ? "false" : "true");
    if (!open) return;
    element.replaceChildren(...entries.map((entry) => createSlot(entry, entry.index === selectedIndex)));
  }

  function dispose() {
    element.remove();
  }

  return { present, dispose, element };
}

function createSlot(entry, selected) {
  const slot = document.createElement("div");
  slot.className = "inventory-selector__slot";
  slot.classList.toggle("is-selected", selected);
  slot.classList.toggle("is-empty", entry.state === "empty");
  slot.dataset.icon = entry.icon;

  const icon = document.createElement("span");
  icon.className = "inventory-selector__icon";
  icon.textContent = getIcon(entry.icon);

  const label = document.createElement("span");
  label.className = "inventory-selector__label";
  label.textContent = entry.label;

  slot.append(icon, label);
  return slot;
}

function getIcon(icon) {
  if (icon === "nothing") return "⊘";
  if (icon === "brief") return "▤";
  if (icon === "flashlight") return "⌕";
  if (icon === "empty") return "·";
  return "□";
}
