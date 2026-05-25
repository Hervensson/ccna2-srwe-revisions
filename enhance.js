(function () {
  if (window.CCNA_ENHANCED_APP) return;

  const BANK = window.CCNA_QUESTIONS || [];
  const byId = new Map(BANK.map((question) => [question.id, question]));
  const keys = {
    difficult: "ccnaSrweDifficultQuestions",
    history: "ccnaSrweScoreHistory",
    errors: "ccnaSrweLastErrors",
  };

  const read = (key, fallback) => {
    try {
      return JSON.parse(localStorage.getItem(key) || JSON.stringify(fallback));
    } catch {
      return fallback;
    }
  };

  const write = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Ignore storage failures.
    }
  };

  const difficultIds = () => read(keys.difficult, []).filter((id) => byId.has(id));
  const lastErrors = () => read(keys.errors, []).filter((id) => byId.has(id));
  const history = () => read(keys.history, []);

  function aggregateThemes() {
    const totals = new Map();
    history().forEach((session) => {
      (session.themes || []).forEach((row) => {
        if (!totals.has(row.theme)) totals.set(row.theme, { theme: row.theme, total: 0, correct: 0, wrong: 0, percent: 0 });
        const target = totals.get(row.theme);
        target.total += row.total || 0;
        target.correct += row.correct || 0;
        target.wrong += row.wrong || 0;
        target.percent = target.total ? Math.round((target.correct / target.total) * 100) : 0;
      });
    });
    return [...totals.values()].sort((a, b) => a.percent - b.percent || b.total - a.total);
  }

  function weakestTheme() {
    return aggregateThemes().find((row) => row.total >= 2 && row.wrong > 0)?.theme || "";
  }

  function renderDashboard() {
    const panel = document.querySelector("#learningDashboard");
    if (!panel) return;
    const sessions = history();
    const avg = sessions.length ? Math.round(sessions.reduce((sum, item) => sum + item.percent, 0) / sessions.length) : 0;
    const best = sessions.length ? Math.max(...sessions.map((item) => item.percent)) : 0;
    const weak = aggregateThemes()[0];
    const advice = !sessions.length
      ? "Fais une première session pour débloquer ton bilan personnalisé."
      : weak
        ? `Priorité : retravailler ${weak.theme}, actuellement à ${weak.percent}%.`
        : "Bon rythme : continue avec une session normale ou tes erreurs.";

    panel.innerHTML = `
      <div class="dashboard-card wide"><span>Bilan de progression</span><strong>${advice}</strong></div>
      <div class="dashboard-card"><span>Sessions</span><strong>${sessions.length}</strong></div>
      <div class="dashboard-card"><span>Moyenne</span><strong>${avg}%</strong></div>
      <div class="dashboard-card"><span>Meilleur</span><strong>${best}%</strong></div>
      <div class="dashboard-card"><span>À refaire</span><strong>${lastErrors().length}</strong></div>
      <div class="dashboard-card"><span>Difficiles</span><strong>${difficultIds().length}</strong></div>
    `;
  }

  function deleteHistoryEntry(id) {
    write(keys.history, history().filter((entry) => entry.id !== id));
    renderDashboard();
    renderGlobalStats();
    renderEnhancedHistory();
  }

  function sectionTitle(text) {
    const title = document.createElement("h2");
    title.className = "section-title";
    title.textContent = text;
    return title;
  }

  function statRows(rows) {
    return rows.map((row) => {
      const percent = row.total ? Math.round((row.correct / row.total) * 100) : 0;
      return `
        <div class="theme-row">
          <strong>${row.theme}</strong>
          <span class="mini-bar"><i style="width:${percent}%"></i></span>
          <span>${row.correct}/${row.total} - ${percent}%</span>
        </div>
      `;
    }).join("");
  }

  function renderGlobalStats() {
    const panel = document.querySelector("#globalStats");
    if (!panel) return;
    const rows = aggregateThemes().filter((row) => row.total > 0);
    panel.innerHTML = "";
    panel.append(sectionTitle("Bilan global par thème"));
    if (!rows.length) {
      const empty = document.createElement("p");
      empty.className = "muted";
      empty.textContent = "Ton bilan global apparaîtra après tes premières sessions terminées.";
      panel.append(empty);
      return;
    }
    panel.insertAdjacentHTML("beforeend", statRows(rows));
  }

  function addSectionTitle(panel, text) {
    if (!panel || panel.querySelector(".section-title")) return;
    panel.prepend(sectionTitle(text));
  }

  function renderEnhancedHistory() {
    document.querySelectorAll(".history-panel").forEach((panel) => {
      addSectionTitle(panel, "Historique des sessions");
      const rows = [...panel.querySelectorAll(".history-row")];
      rows.forEach((row) => {
        if (row.querySelector(".delete-history")) return;
        const entry = history().find((item) => (row.textContent || "").includes(formatDate(item.date)));
        if (!entry) return;
        const button = document.createElement("button");
        button.className = "delete-history";
        button.type = "button";
        button.textContent = "Supprimer";
        button.addEventListener("click", () => {
          deleteHistoryEntry(entry.id);
          row.remove();
        });
        row.append(button);
      });
    });
  }

  function decorateResults() {
    renderGlobalStats();
    addSectionTitle(document.querySelector("#themeStats"), "Cette session par thème");
    renderEnhancedHistory();
  }

  function patchResultsRenderer() {
    if (typeof window.renderResults !== "function" || window.renderResults.__enhanced) return;
    const original = window.renderResults;
    window.renderResults = function (...args) {
      const output = original.apply(this, args);
      setTimeout(decorateResults, 0);
      return output;
    };
    window.renderResults.__enhanced = true;
  }

  function formatDate(value) {
    return new Intl.DateTimeFormat("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));
  }

  function startIds(ids) {
    if (!ids.length || typeof window.createSession !== "function" || typeof window.renderExam !== "function") return;
    window.createSession(ids, "targeted");
    window.renderExam();
  }

  function bindStartButtons() {
    const hard = document.querySelector("#difficultStartBtn");
    const weak = document.querySelector("#weakThemeStartBtn");
    const hardIds = difficultIds();
    const theme = weakestTheme();

    if (hard) {
      hard.disabled = hardIds.length === 0;
      hard.textContent = hardIds.length ? `Questions difficiles (${hardIds.length})` : "Questions difficiles";
      hard.addEventListener("click", () => startIds(difficultIds()));
    }

    if (weak) {
      weak.disabled = !theme;
      weak.textContent = theme ? `Travailler ${theme}` : "Thème faible";
      weak.addEventListener("click", () => startIds(BANK.filter((question) => question.theme === theme).map((question) => question.id)));
    }
  }

  function bindImageZoom() {
    const modal = document.querySelector("#imageModal");
    const modalImg = document.querySelector("#imageModalImg");
    const close = document.querySelector("#imageModalClose");
    if (!modal || !modalImg || !close) return;

    document.addEventListener("click", (event) => {
      const image = event.target.closest?.(".question-image");
      if (!image) return;
      modalImg.src = image.src;
      modal.classList.remove("hidden");
    });

    const hide = () => {
      modal.classList.add("hidden");
      modalImg.removeAttribute("src");
    };
    close.addEventListener("click", hide);
    modal.addEventListener("click", (event) => {
      if (event.target === modal) hide();
    });
  }

  renderDashboard();
  bindStartButtons();
  bindImageZoom();
  patchResultsRenderer();
  decorateResults();
})();
