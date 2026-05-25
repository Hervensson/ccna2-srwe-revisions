(function () {
  const RESUME_KEY = "ccnaSrweOpenSession";

  function shouldKeepSessionOpen() {
    const params = new URLSearchParams(window.location.search);
    if (params.get("resume") === "1") return true;
    try {
      if (sessionStorage.getItem(RESUME_KEY) === "1") {
        sessionStorage.removeItem(RESUME_KEY);
        return true;
      }
    } catch {}
    return false;
  }

  function showHomeOnLaunch() {
    if (shouldKeepSessionOpen()) return;
    const start = document.querySelector("#startScreen");
    const exam = document.querySelector("#examShell");
    const result = document.querySelector("#resultScreen");
    if (!start || !exam || !result) return;

    start.classList.remove("hidden");
    exam.classList.add("hidden");
    result.classList.add("hidden");
  }

  showHomeOnLaunch();
  document.addEventListener("DOMContentLoaded", showHomeOnLaunch);
  setTimeout(showHomeOnLaunch, 80);
  setTimeout(showHomeOnLaunch, 350);
})();
