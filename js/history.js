// ════════════════════════════════════════════════
//  BROWSER HISTORY / BACK BUTTON
// ════════════════════════════════════════════════
//
// The app is a single page: screens are shown by toggling display, pages by an
// .active class. Nothing touched browser history, so the tab held one entry and
// Back left the site entirely. navPush() records each navigation so Back walks
// Zones → Building Levels → Dashboard, and only leaves the app from the
// Dashboard.
//
// State shape: { screen: "projects" }
//              { screen: "app", page, projectId, levelId? }

let _navApplying = false;   // true while restoring a popped state — suppresses pushes

function navSameState(a, b) {
  if (!a || !b) return false;
  return a.screen === b.screen && a.page === b.page &&
         a.projectId === b.projectId && a.levelId === b.levelId;
}

function navPush(state) {
  if (_navApplying) return;                        // restoring, not navigating
  if (navSameState(history.state, state)) return;  // no duplicate entries
  // auth.js scrubs the OAuth hash with replaceState({}), so seed on a stateless
  // entry too — otherwise Back at the Dashboard lands on a blank state and
  // appears to do nothing.
  if (!history.state || !history.state.screen) { history.replaceState(state, ""); return; }
  history.pushState(state, "");
}

function navReplace(state) {
  history.replaceState(state, "");
}

// Restore the state the browser popped to. Mirrors what navPush records.
function navApply(state) {
  _navApplying = true;
  try {
    if (!state || state.screen !== "app") { showProjectList(); return; }
    // the project may have been deleted since this entry was pushed
    if (!projectStore.find(x => x.id === state.projectId)) { showProjectList(); return; }
    if (activeProjectId !== state.projectId) {
      openProject(state.projectId);   // also un-hides the app shell
    } else {
      // Same project still loaded — showPage() only toggles .active on pages, so
      // the shell has to be un-hidden here or we land on a blank Dashboard.
      document.getElementById("projectListScreen").style.display = "none";
      document.getElementById("appShell").style.display = "block";
    }
    if (state.page === "zones" && state.levelId) {
      showPage("levels");
      openZones(state.levelId);
    } else {
      showPage(state.page || "levels");
    }
  } finally {
    _navApplying = false;
  }
}

window.addEventListener("popstate", e => {
  if (!currentUser) return;   // signed out — nothing of ours to restore
  navApply(e.state);
});
