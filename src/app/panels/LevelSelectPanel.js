export function createLevelSelectPanel({ levels, progress, translate = (key) => key, root = document, onStartLevel, onClose }) {
  const panel = root.querySelector("#levelSelectPanel");
  const startButtons = [...root.querySelectorAll("[data-start-selected-shift]")];
  const detailEmpty = root.querySelector("[data-assignment-empty]");
  const detailContent = root.querySelector("[data-assignment-details]");
  const detailTitle = root.querySelector("[data-assignment-detail-title]");
  const detailSubject = root.querySelector("[data-assignment-detail-subject]");
  const detailSummary = root.querySelector("[data-assignment-detail-summary]");
  const inboxCount = root.querySelector("[data-mail-inbox-count]");
  const archiveCount = root.querySelector("[data-mail-archive-count]");
  const mailboxEmpty = root.querySelector("[data-mailbox-empty]");
  const mailboxFooter = root.querySelector("[data-mailbox-footer]");
  const mailboxButtons = [...root.querySelectorAll("[data-mailbox-view]")];
  const detailReference = root.querySelector("[data-assignment-detail-reference]");
  const detailStatus = root.querySelector("[data-assignment-detail-status]");
  const detailFacility = root.querySelector("[data-assignment-detail-facility]");
  const detailSector = root.querySelector("[data-assignment-detail-sector]");
  const detailClearance = root.querySelector("[data-assignment-detail-clearance]");
  const view = root.defaultView ?? globalThis.window;
  let selectedLevelId = null;
  let mailboxView = "inbox";
  let wired = false;
  let viewportObserver = null;

  function updateScale() {
    if (!panel || !view) return;
    panel.style.setProperty("--operations-mail-scale", String(getTerminalScale(view.innerWidth, view.innerHeight)));
  }

  function handleKeyDown(event) {
    if (event.repeat || panel.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      onClose?.();
    } else if (event.key === "Enter" && selectedLevelId) {
      event.preventDefault();
      if (isUnlocked(selectedLevelId)) onStartLevel?.(selectedLevelId);
    }
  }

  function wire() {
    if (wired || !panel) return;
    wired = true;
    panel.addEventListener("click", (event) => {
      const card = event.target.closest("[data-level-id]");
      if (card && !card.disabled) {
        select(card.dataset.levelId);
        return;
      }
      const mailboxButton = event.target.closest("[data-mailbox-view]");
      if (mailboxButton) {
        setMailboxView(mailboxButton.dataset.mailboxView);
        return;
      }
      if (shouldClearMailSelection({
        insidePane: Boolean(event.target.closest(".operations-inbox, .assignment-detail")),
        insideLetter: Boolean(event.target.closest(".mail-letter")),
        insideAction: Boolean(event.target.closest("button")),
      })) clearSelection();
    });
    startButtons.forEach((button) => button.addEventListener("click", () => {
      startSelectedLevel();
    }));
    root.addEventListener("keydown", handleKeyDown);
    view?.addEventListener("resize", updateScale);
    if (view?.ResizeObserver && root.documentElement) {
      viewportObserver = new view.ResizeObserver(updateScale);
      viewportObserver.observe(root.documentElement);
    }
    updateScale();
  }

  function startSelectedLevel() {
    if (selectedLevelId && isUnlocked(selectedLevelId)) onStartLevel?.(selectedLevelId);
  }

  function show() {
    updateScale();
    mailboxView = "inbox";
    clearSelection();
    refresh();
  }

  function setStartActionsEnabled(enabled) {
    startButtons.forEach((button) => {
      button.disabled = !enabled;
    });
  }

  function refresh() {
    const counts = { inbox: 0, archive: 0 };
    root.querySelectorAll("[data-level-id]").forEach((node) => {
      const levelId = node.dataset.levelId;
      const level = levels[levelId];
      const completed = Boolean(progress.completedLevels[levelId]);
      const finished = Boolean(progress.finishedLevels[levelId]);
      const assigned = isUnlocked(levelId);
      const mailbox = getAssignmentMailbox(level, progress);
      if (assigned) counts[mailbox] += 1;
      const visible = assigned && mailbox === mailboxView;
      node.hidden = !visible;
      node.classList.toggle("is-selected", levelId === selectedLevelId);
      node.classList.toggle("is-complete", completed);
      node.classList.toggle("is-finished", finished && !completed);
      node.classList.toggle("is-assigned", assigned);
      node.classList.toggle("is-locked", !assigned);
      node.dataset.completion = completed ? "complete" : finished ? "attempted" : "";
      if ("disabled" in node) node.disabled = !visible;
      const status = node.querySelector("[data-assignment-status]");
      if (status) status.textContent = translate(completed ? "assignments.completed" : assigned ? "assignments.assigned" : "assignments.notAssigned");
      const subject = node.querySelector("[data-assignment-subject]");
      if (subject) subject.textContent = translate(level?.assignment?.subjectKey ?? "assignments.operationsSubject");
      const title = node.querySelector("[data-assignment-title]");
      if (title) title.textContent = translate(level?.assignment?.titleKey) || level?.title || levelId;
      const date = node.querySelector("[data-assignment-date]");
      if (date) date.textContent = formatAssignmentDate(level?.assignment, translate);
      node.setAttribute("aria-label", `${translate(level?.assignment?.titleKey) || level?.title || levelId} — ${status?.textContent ?? ""}`);
    });
    if (inboxCount) inboxCount.textContent = String(counts.inbox).padStart(2, "0");
    if (archiveCount) archiveCount.textContent = String(counts.archive).padStart(2, "0");
    if (mailboxEmpty) mailboxEmpty.textContent = translate(mailboxView === "archive" ? "assignments.archiveEmpty" : "assignments.noMore");
    if (mailboxFooter) mailboxFooter.textContent = `OPERATIONS MAIL / ${mailboxView.toUpperCase()} ${String(counts[mailboxView]).padStart(2, "0")}`;
    mailboxButtons.forEach((button) => {
      const active = button.dataset.mailboxView === mailboxView;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-pressed", String(active));
    });
    if (selectedLevelId) {
      const selected = levels[selectedLevelId];
      if (!isUnlocked(selectedLevelId) || getAssignmentMailbox(selected, progress) !== mailboxView) clearSelection();
    }
  }

  function setMailboxView(nextView) {
    if (!["inbox", "archive"].includes(nextView) || nextView === mailboxView) return false;
    mailboxView = nextView;
    clearSelection();
    refresh();
    return true;
  }

  function select(levelId) {
    const level = levels[levelId];
    if (!level?.assignment || !isUnlocked(levelId) || getAssignmentMailbox(level, progress) !== mailboxView) return false;
    selectedLevelId = levelId;
    root.querySelectorAll("[data-level-id]").forEach((node) => {
      node.classList.toggle("is-selected", node.dataset.levelId === levelId);
    });
    if (detailEmpty) detailEmpty.hidden = true;
    if (detailContent) detailContent.hidden = false;
    if (detailTitle) detailTitle.textContent = translate(level.assignment.documentTitleKey ?? level.assignment.titleKey);
    if (detailSubject) detailSubject.textContent = translate(level.assignment.subjectKey ?? "assignments.operationsSubject");
    if (detailSummary) detailSummary.textContent = translate(level.assignment.summaryKey);
    if (detailReference) detailReference.textContent = level.assignment.reference;
    if (detailStatus) detailStatus.textContent = translate("assignments.approved");
    if (detailFacility) detailFacility.textContent = level.assignment.facility;
    if (detailSector) detailSector.textContent = translate(level.assignment.sectorKey);
    if (detailClearance) detailClearance.textContent = translate(level.assignment.clearanceKey);
    setStartActionsEnabled(true);
    return true;
  }

  function clearSelection() {
    selectedLevelId = null;
    root.querySelectorAll("[data-level-id]").forEach((node) => node.classList.remove("is-selected"));
    if (detailEmpty) detailEmpty.hidden = false;
    if (detailContent) detailContent.hidden = true;
    setStartActionsEnabled(false);
  }

  function isUnlocked(levelId) {
    return isAssignedShift(levels[levelId], progress);
  }

  function validate() {
    const menuIds = new Set([...root.querySelectorAll("[data-level-id]")].map((node) => node.dataset.levelId));
    getAssignedLevels(levels).forEach((level) => {
      if (!menuIds.has(level.id)) throw new Error(`[LevelSelectPanel] Assigned shift is missing from menu: ${level.id}`);
    });
  }

  function dispose() {
    root.removeEventListener("keydown", handleKeyDown);
    view?.removeEventListener("resize", updateScale);
    viewportObserver?.disconnect();
    viewportObserver = null;
  }

  return { wire, show, refresh, select, clearSelection, isUnlocked, setMailboxView, validate, updateScale, dispose, getSelectedLevelId: () => selectedLevelId, getMailboxView: () => mailboxView };
}

export function getTerminalScale(viewportWidth, viewportHeight) {
  const width = Number.isFinite(viewportWidth) ? Math.max(0, viewportWidth) : 0;
  const height = Number.isFinite(viewportHeight) ? Math.max(0, viewportHeight) : 0;
  return Math.min(width / 1920, height / 1080);
}

export function shouldClearMailSelection({ insidePane, insideLetter = false, insideAction = false }) {
  return Boolean(insidePane && !insideLetter && !insideAction);
}

export function getAssignedLevels(levels) {
  return Object.values(levels)
    .filter((level) => level.playable && level.assignment && level.assignment.public !== false)
    .sort((a, b) => a.assignment.order - b.assignment.order);
}

export function isAssignedShift(level, progress) {
  if (!level?.playable || !level.assignment || level.assignment.public === false) return false;
  const requirements = level.assignment.unlockAfter ?? [];
  return requirements.length === 0 || requirements.every((levelId) => Boolean(progress.completedLevels[levelId]));
}

export function getAssignmentMailbox(level, progress) {
  return progress?.completedLevels?.[level?.id] ? "archive" : "inbox";
}

export function formatAssignmentDate(assignment, translate = (key) => key) {
  if (assignment?.dateKey) return translate(assignment.dateKey);
  return [assignment?.date, assignment?.time].filter(Boolean).join(" / ") || "—";
}
