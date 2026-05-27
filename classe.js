(function () {
  const allQuestions = window.CCNA_QUESTIONS || [];
  const SESSION_SIZE = 70;
  const DURATION_MS = 75 * 60 * 1000;

  const state = {
    items: [],
    current: 0,
    answers: new Map(),
  };

  const els = {
    themeSelect: document.querySelector("#themeSelect"),
    sessionMode: document.querySelector("#sessionMode"),
    bankInfo: document.querySelector("#bankInfo"),
    start: document.querySelector("#startClassQuiz"),
    quiz: document.querySelector("#quizView"),
    results: document.querySelector("#resultView"),
    counter: document.querySelector("#questionCounter"),
    answered: document.querySelector("#answeredCounter"),
    timer: document.querySelector("#timer"),
    fill: document.querySelector("#progressFill"),
    theme: document.querySelector("#questionTheme"),
    text: document.querySelector("#questionText"),
    images: document.querySelector("#questionImages"),
    answers: document.querySelector("#answerList"),
    prev: document.querySelector("#prevQuestion"),
    next: document.querySelector("#nextQuestion"),
    submit: document.querySelector("#submitQuiz"),
    finalScore: document.querySelector("#finalScore"),
    finalPercent: document.querySelector("#finalPercent"),
    correction: document.querySelector("#correctionList"),
    retry: document.querySelector("#retryQuiz"),
    backToStart: document.querySelector("#backToStart"),
  };

  let deadline = 0;
  let timerId = null;

  function shuffle(values) {
    const copy = [...values];
    for (let index = copy.length - 1; index > 0; index -= 1) {
      const swap = Math.floor(Math.random() * (index + 1));
      [copy[index], copy[swap]] = [copy[swap], copy[index]];
    }
    return copy;
  }

  function themes() {
    return [...new Set(allQuestions.map((question) => question.theme || "Autres"))].sort();
  }

  function setup() {
    themes().forEach((theme) => {
      const option = document.createElement("option");
      option.value = theme;
      option.textContent = theme;
      els.themeSelect.append(option);
    });
    els.bankInfo.textContent = `${allQuestions.length} questions disponibles.`;
    els.start.addEventListener("click", startQuiz);
    els.prev.addEventListener("click", () => goTo(state.current - 1));
    els.next.addEventListener("click", () => goTo(state.current + 1));
    els.submit.addEventListener("click", showResults);
    els.retry.addEventListener("click", startQuiz);
    els.backToStart.addEventListener("click", showHome);
    updateTimerLabel(false);
  }

  function showHome() {
    clearInterval(timerId);
    els.quiz.classList.add("hidden");
    els.results.classList.add("hidden");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startQuiz() {
    const theme = els.themeSelect.value;
    const pool = theme ? allQuestions.filter((question) => question.theme === theme) : allQuestions;
    const count = els.sessionMode.value === "all" ? pool.length : Math.min(SESSION_SIZE, pool.length);
    state.items = shuffle(pool).slice(0, count).map((question) => ({
      question,
      order: shuffle((question.options || []).map((_, index) => index)),
    }));
    state.current = 0;
    state.answers = new Map();
    deadline = Date.now() + DURATION_MS;
    startTimer();
    els.quiz.classList.remove("hidden");
    els.results.classList.add("hidden");
    renderQuestion();
    window.scrollTo({ top: els.quiz.offsetTop - 8, behavior: "smooth" });
  }

  function current() {
    return state.items[state.current];
  }

  function selectedFor(questionId) {
    return state.answers.get(questionId) || [];
  }

  function renderQuestion() {
    const item = current();
    if (!item) return;
    const question = item.question;
    const selected = selectedFor(question.id);

    els.counter.textContent = `${state.current + 1} / ${state.items.length}`;
    updateProgress();
    els.theme.textContent = question.theme || "CCNA";
    els.text.textContent = question.question;
    els.prev.disabled = state.current === 0;
    els.next.disabled = state.current === state.items.length - 1;

    els.images.innerHTML = "";
    (question.images || []).forEach((src, index) => {
      const image = document.createElement("img");
      image.src = src;
      image.alt = `Illustration ${index + 1}`;
      els.images.append(image);
    });

    renderAnswers(item);
  }

  function renderAnswers(item) {
    const question = item.question;
    const selected = selectedFor(question.id);
    els.answers.innerHTML = "";

    if (question.type === "matching") {
      const wrap = document.createElement("div");
      wrap.className = "matching-list";
      const prompts = question.matching?.prompts || [];
      const answers = question.matching?.answers || [];
      prompts.forEach((prompt, index) => {
        const currentAnswers = state.answers.get(question.id) || {};
        const row = document.createElement("label");
        row.className = "matching-row";
        const select = document.createElement("select");
        select.innerHTML = `<option value="">Choisir...</option>${answers.map((answer) => `<option>${escapeHtml(answer)}</option>`).join("")}`;
        select.value = currentAnswers[index] || "";
        select.addEventListener("change", () => {
          const latest = state.answers.get(question.id) || {};
          state.answers.set(question.id, { ...latest, [index]: select.value });
          renderQuestion();
        });
        row.append(document.createTextNode(prompt), select);
        wrap.append(row);
      });
      els.answers.append(wrap);
      return;
    }

    if (question.type === "study") {
      const textarea = document.createElement("textarea");
      textarea.className = "study-note";
      textarea.placeholder = "Ecris ta reponse ici. La correction apparaitra a la fin.";
      textarea.value = state.answers.get(question.id) || "";
      textarea.addEventListener("input", () => {
        state.answers.set(question.id, textarea.value);
        updateProgress();
      });
      els.answers.append(textarea);
      return;
    }

    item.order.forEach((originalIndex, displayIndex) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `answer ${selected.includes(originalIndex) ? "selected" : ""}`;
      button.innerHTML = `<span class="letter">${String.fromCharCode(65 + displayIndex)}</span><span>${escapeHtml(question.options[originalIndex])}</span>`;
      button.addEventListener("click", () => toggleAnswer(question, originalIndex));
      els.answers.append(button);
    });
  }

  function toggleAnswer(question, originalIndex) {
    const selected = selectedFor(question.id);
    if (question.type === "single") {
      state.answers.set(question.id, [originalIndex]);
    } else if (selected.includes(originalIndex)) {
      state.answers.set(question.id, selected.filter((value) => value !== originalIndex));
    } else {
      state.answers.set(question.id, [...selected, originalIndex].slice(-question.correct.length));
    }
    renderQuestion();
  }

  function goTo(index) {
    if (index < 0 || index >= state.items.length) return;
    state.current = index;
    renderQuestion();
  }

  function isCorrect(question) {
    if (question.type === "matching") {
      const answers = state.answers.get(question.id) || {};
      const expected = question.matching?.correct || [];
      return expected.length > 0 && expected.every((value, index) => answers[index] === value);
    }
    if (question.type === "study") return false;
    const selected = [...selectedFor(question.id)].sort((a, b) => a - b);
    const correct = [...question.correct].sort((a, b) => a - b);
    return selected.length === correct.length && selected.every((value, index) => value === correct[index]);
  }

  function showResults() {
    clearInterval(timerId);
    const gradable = state.items.filter((item) => item.question.type !== "study");
    const correctCount = gradable.filter((item) => isCorrect(item.question)).length;
    const percent = gradable.length ? Math.round((correctCount / gradable.length) * 100) : 0;
    els.quiz.classList.add("hidden");
    els.results.classList.remove("hidden");
    els.finalScore.textContent = `${correctCount} / ${gradable.length}`;
    els.finalPercent.textContent = `${percent}% de reussite (${state.items.length} questions vues)`;
    els.correction.innerHTML = "";

    state.items.forEach((item, index) => {
      const question = item.question;
      const selected = selectedFor(question.id);
      const correct = isCorrect(question);
      const card = document.createElement("article");
      card.className = `correction-card ${correct ? "good" : "bad"}`;
      card.innerHTML = `
        <p class="theme-pill">${escapeHtml(question.theme || "CCNA")}</p>
        <h3>${index + 1}. ${escapeHtml(question.question)}</h3>
        <div class="line ${correct ? "correct" : "wrong"}">Ta reponse : ${answerText(question, selected) || "aucune"}</div>
        <div class="line correct">Bonne reponse : ${correctAnswerText(question)}</div>
        ${question.explanation ? `<p>${escapeHtml(question.explanation)}</p>` : ""}
      `;
      els.correction.append(card);
    });
    window.scrollTo({ top: els.results.offsetTop - 8, behavior: "smooth" });
  }

  function answerText(question, indexes) {
    if (question.type === "matching") {
      const prompts = question.matching?.prompts || [];
      return prompts.map((prompt, index) => `${prompt} -> ${indexes?.[index] || "aucune"}`).join(" ; ");
    }
    if (question.type === "study") return String(indexes || "").trim();
    return (indexes || []).map((index) => question.options[index]).filter(Boolean).join(" ; ");
  }

  function correctAnswerText(question) {
    if (question.type === "matching") {
      const prompts = question.matching?.prompts || [];
      const correct = question.matching?.correct || [];
      return prompts.map((prompt, index) => `${prompt} -> ${correct[index] || ""}`).join(" ; ");
    }
    if (question.type === "study") {
      return (question.options || []).join(" ; ") || question.explanation || "Voir la correction du document.";
    }
    return answerText(question, question.correct);
  }

  function isAnswered(question) {
    const answer = state.answers.get(question.id);
    if (question.type === "matching") {
      const prompts = question.matching?.prompts || [];
      return prompts.length > 0 && prompts.every((_, index) => Boolean(answer?.[index]));
    }
    if (question.type === "study") return Boolean(String(answer || "").trim());
    return Boolean(answer?.length);
  }

  function updateProgress() {
    const answeredCount = state.items.filter((entry) => isAnswered(entry.question)).length;
    els.answered.textContent = `${answeredCount} reponse${answeredCount > 1 ? "s" : ""}`;
    els.fill.style.width = `${state.items.length ? (answeredCount / state.items.length) * 100 : 0}%`;
  }

  function startTimer() {
    clearInterval(timerId);
    updateTimerLabel(true);
    timerId = setInterval(() => {
      updateTimerLabel(true);
      if (Date.now() >= deadline) showResults();
    }, 1000);
  }

  function updateTimerLabel(active) {
    const remaining = active ? Math.max(0, deadline - Date.now()) : DURATION_MS;
    const total = Math.ceil(remaining / 1000);
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    els.timer.textContent = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  function escapeHtml(value) {
    return String(value || "").replace(/[&<>"']/g, (char) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[char]));
  }

  setup();
})();
