const STORAGE_KEY = "theNudgeLog.entries.v1";

const state = {
  person: null,
  type: null,
  requested: null,
  keptGoing: null,
  note: ""
};

const els = {
  form: document.getElementById("nudgeForm"),
  note: document.getElementById("note"),
  noteCount: document.getElementById("noteCount"),
  message: document.getElementById("formMessage"),
  range: document.getElementById("rangeFilter"),
  total: document.getElementById("totalCount"),
  unasked: document.getElementById("unaskedCount"),
  kept: document.getElementById("keptGoingCount"),
  personBreakdown: document.getElementById("personBreakdown"),
  typeBreakdown: document.getElementById("typeBreakdown"),
  recent: document.getElementById("recentEntries"),
  clearAll: document.getElementById("clearAllBtn"),
  exportBtn: document.getElementById("exportBtn"),
  clearForm: document.getElementById("clearFormBtn"),
  quickAdd: document.getElementById("quickAddBtn"),
  personRangeLabel: document.getElementById("personRangeLabel")
};

function loadEntries() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}

function saveEntries(entries) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

function setChoice(field, value, button) {
  state[field] = value;
  document.querySelectorAll(`[data-field="${field}"]`).forEach((el) => {
    el.classList.toggle("selected", el === button);
  });
}

document.querySelectorAll("[data-field]").forEach((button) => {
  button.addEventListener("click", () => {
    setChoice(button.dataset.field, button.dataset.value, button);
  });
});

els.note.addEventListener("input", () => {
  state.note = els.note.value.trim();
  els.noteCount.textContent = els.note.value.length;
});

function resetForm() {
  state.person = null;
  state.type = null;
  state.requested = null;
  state.keptGoing = null;
  state.note = "";
  document.querySelectorAll("[data-field]").forEach((el) => el.classList.remove("selected"));
  els.note.value = "";
  els.noteCount.textContent = "0";
  els.message.textContent = "";
}

els.clearForm.addEventListener("click", resetForm);

els.form.addEventListener("submit", (event) => {
  event.preventDefault();

  const missing = [];
  if (!state.person) missing.push("who");
  if (!state.type) missing.push("what kind");
  if (!state.requested) missing.push("whether input was asked for");
  if (!state.keptGoing) missing.push("whether it kept going");

  if (missing.length) {
    els.message.textContent = "Almost there. Pick " + missing.join(", ") + ".";
    return;
  }

  const entries = loadEntries();
  entries.unshift({
    id: crypto.randomUUID ? crypto.randomUUID() : String(Date.now()),
    person: state.person,
    type: state.type,
    requested: state.requested,
    keptGoing: state.keptGoing,
    note: els.note.value.trim(),
    createdAt: new Date().toISOString()
  });

  saveEntries(entries);
  els.message.textContent = "Logged. Tiny data point captured.";
  setTimeout(resetForm, 700);
  renderDashboard();
});

function filteredEntries() {
  const all = loadEntries();
  const value = els.range.value;
  if (value === "all") return all;

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - Number(value));
  return all.filter((entry) => new Date(entry.createdAt) >= cutoff);
}

function countBy(entries, key) {
  return entries.reduce((acc, entry) => {
    const value = entry[key];
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function renderBreakdown(target, counts, order) {
  const total = Object.values(counts).reduce((sum, n) => sum + n, 0);
  if (!total) {
    target.className = "breakdown-list empty-state";
    target.textContent = "No entries yet.";
    return;
  }

  target.className = "breakdown-list";
  target.innerHTML = order
    .filter((label) => counts[label])
    .map((label) => {
      const count = counts[label];
      const pct = Math.round((count / total) * 100);
      return `
        <div class="breakdown-row">
          <div class="breakdown-label">${label}</div>
          <div class="bar-track" aria-label="${label}: ${count}">
            <div class="bar-fill" style="width:${pct}%"></div>
          </div>
          <div class="breakdown-count">${count}</div>
        </div>
      `;
    })
    .join("");
}

function formatTime(iso) {
  const d = new Date(iso);
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit"
  }).format(d);
}

function renderRecent(entries) {
  const recent = entries.slice(0, 12);
  if (!recent.length) {
    els.recent.className = "entry-list empty-state";
    els.recent.textContent = "Nothing logged yet.";
    return;
  }

  els.recent.className = "entry-list";
  els.recent.innerHTML = recent.map((entry) => `
    <article class="entry">
      <div>
        <div class="entry-title">${escapeHtml(entry.person)} · ${escapeHtml(entry.type)}</div>
        <div class="entry-meta">
          ${formatTime(entry.createdAt)} · input asked for: ${entry.requested} · kept going: ${entry.keptGoing}
        </div>
        ${entry.note ? `<div class="entry-note">${escapeHtml(entry.note)}</div>` : ""}
      </div>
      <button class="entry-delete" type="button" data-delete-id="${entry.id}" aria-label="Delete entry">×</button>
    </article>
  `).join("");

  els.recent.querySelectorAll("[data-delete-id]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = loadEntries().filter((entry) => entry.id !== button.dataset.deleteId);
      saveEntries(next);
      renderDashboard();
    });
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderDashboard() {
  const entries = filteredEntries();
  els.total.textContent = entries.length;
  els.unasked.textContent = entries.filter((entry) => entry.requested === "no").length;
  els.kept.textContent = entries.filter((entry) => entry.keptGoing === "yes").length;

  renderBreakdown(els.personBreakdown, countBy(entries, "person"), ["Jen", "Blake", "Porter"]);
  renderBreakdown(els.typeBreakdown, countBy(entries, "type"), ["Direct", "Correct", "Justify", "Monitor", "Handoff"]);
  renderRecent(entries);

  const label = els.range.options[els.range.selectedIndex].text;
  els.personRangeLabel.textContent = label;
}

els.range.addEventListener("change", renderDashboard);

els.clearAll.addEventListener("click", () => {
  if (!loadEntries().length) return;
  const confirmed = window.confirm("Clear every Nudge Log entry stored in this browser?");
  if (!confirmed) return;
  localStorage.removeItem(STORAGE_KEY);
  renderDashboard();
});

els.exportBtn.addEventListener("click", () => {
  const entries = loadEntries();
  if (!entries.length) {
    window.alert("Nothing to export yet.");
    return;
  }

  const rows = [
    ["date_time", "person", "type", "input_asked_for", "kept_going", "note"],
    ...entries.map((entry) => [
      entry.createdAt,
      entry.person,
      entry.type,
      entry.requested,
      entry.keptGoing,
      entry.note || ""
    ])
  ];

  const csv = rows
    .map((row) => row.map(csvCell).join(","))
    .join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `nudge-log-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
});

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function switchTab(tabId) {
  document.querySelectorAll(".tab-panel").forEach((panel) => {
    panel.classList.toggle("active", panel.id === tabId);
  });
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.tab === tabId);
  });
  if (tabId === "dashboardTab") renderDashboard();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

document.querySelectorAll(".nav-button").forEach((button) => {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
});

els.quickAdd.addEventListener("click", () => switchTab("logTab"));

renderDashboard();
