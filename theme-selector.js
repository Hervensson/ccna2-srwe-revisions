(function () {
  const BANK = window.CCNA_QUESTIONS || [];
  const VERSION = `ccna-srwe-${BANK.length}-v5`;
  const SESSION_KEY = "ccnaSrweExamSession";
  const RESUME_KEY = "ccnaSrweOpenSession";
  const DURATION_MS = 75 * 60 * 1000;
  const groups = [
    { label: "VLAN", tests: ["vlan", "trunk", "inter-vlan"] },
    { label: "STP", tests: ["stp", "spanning"] },
    { label: "EtherChannel", tests: ["etherchannel", "lacp", "pagp"] },
    { label: "WLAN", tests: ["wlan", "sans fil", "wireless"] },
    { label: "Routage IPv6", tests: ["ipv6", "routage"] },
    { label: "Securite LAN", tests: ["securite", "port security", "dhcp snooping"] },
    { label: "DHCP", tests: ["dhcp"] },
  ];

  function normalize(value) {
    return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  }

  function shuffled(values) {
    const copy = [...values];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const random = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[random]] = [copy[random], copy[index]];
    }
    return copy;
  }

  function matches(question, group) {
    const text = normalize(`${question.theme || ""} ${question.question || ""}`);
    return group.tests.some((test) => text.includes(normalize(test)));
  }

  function questionItem(question) {
    return {
      id: question.id,
      optionOrder: question.type === "study" ? [] : shuffled((question.options || []).map((_, index) => index)),
      answer: [],
      matchingAnswer: {},
      note: "",
    };
  }

  function launch(selectedLabels, requestedSize) {
    const selectedGroups = groups.filter((group) => selectedLabels.includes(group.label));
    const pool = selectedGroups.length
      ? BANK.filter((question) => selectedGroups.some((group) => matches(question, group)))
      : BANK;
    if (!pool.length) {
      alert("Aucune question trouvee pour cette selection.");
      return;
    }
    const picked = shuffled(pool).slice(0, Math.min(requestedSize, pool.length));
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      version: VERSION,
      mode: selectedGroups.length ? "theme" : "normal",
      theme: selectedGroups.map((group) => group.label).join(" + ") || "Tout melanger",
      createdAt: Date.now(),
      deadline: Date.now() + DURATION_MS,
      current: 0,
      submitted: false,
      submittedAt: null,
      historySaved: false,
      items: picked.map(questionItem),
    }));
    try {
      sessionStorage.setItem(RESUME_KEY, "1");
    } catch {}
    location.href = `${location.pathname}?v=25&resume=1`;
  }

  function render() {
    const menu = document.querySelector("#themeQuickMenu");
    if (!menu || menu.dataset.multiThemeReady) return;
    menu.dataset.multiThemeReady = "true";
    menu.innerHTML = `
      <div class="theme-menu-head">
        <div><span>Revision ciblee</span><h2>Choisis un ou plusieurs themes</h2></div>
        <button type="button" class="theme-reset" data-theme-reset>Tout deselectionner</button>
      </div>
      <div class="theme-choices">
        ${groups.map((group) => `
          <label class="theme-choice">
            <input type="checkbox" value="${group.label}" data-theme-choice>
            <span>${group.label}</span>
          </label>
        `).join("")}
      </div>
      <div class="theme-launcher">
        <label>Questions
          <select data-theme-size>
            <option value="10">10</option>
            <option value="20" selected>20</option>
            <option value="40">40</option>
            <option value="70">70</option>
            <option value="999">Toutes</option>
          </select>
        </label>
        <p data-theme-summary></p>
        <button type="button" class="primary-action" data-theme-launch>Lancer la revision</button>
        <button type="button" data-theme-all>Tout melanger</button>
      </div>
    `;

    const choices = [...menu.querySelectorAll("[data-theme-choice]")];
    const size = menu.querySelector("[data-theme-size]");
    const summary = menu.querySelector("[data-theme-summary]");
    const selectedLabels = () => choices.filter((input) => input.checked).map((input) => input.value);
    const updateSummary = () => {
      const labels = selectedLabels();
      const selectedGroups = groups.filter((group) => labels.includes(group.label));
      const count = selectedGroups.length
        ? BANK.filter((question) => selectedGroups.some((group) => matches(question, group))).length
        : BANK.length;
      summary.textContent = labels.length
        ? `${labels.length} theme${labels.length > 1 ? "s" : ""} - ${count} questions disponibles.`
        : `${BANK.length} questions disponibles si tu melanges tout.`;
    };

    choices.forEach((input) => input.addEventListener("change", updateSummary));
    menu.querySelector("[data-theme-reset]").addEventListener("click", () => {
      choices.forEach((input) => { input.checked = false; });
      updateSummary();
    });
    menu.querySelector("[data-theme-launch]").addEventListener("click", () => {
      const labels = selectedLabels();
      if (!labels.length) {
        alert("Choisis au moins un theme ou utilise Tout melanger.");
        return;
      }
      launch(labels, Number(size.value) || 20);
    });
    menu.querySelector("[data-theme-all]").addEventListener("click", () => launch([], Number(size.value) || 20));
    updateSummary();
  }

  document.addEventListener("DOMContentLoaded", render);
  render();
  setTimeout(render, 250);
  setTimeout(render, 900);
})();
