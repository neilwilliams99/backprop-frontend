// ════════════════════════════════════════════════
//  PROJECT SETTINGS
// ════════════════════════════════════════════════
function openProjModal() {
  renderModalPropTable();
  clearModalPropForm();
  document.getElementById('projName').value = project.name;
  document.getElementById('jobNo').value = project.jobNo;
  document.getElementById('prepBy').value = project.prepBy;
  document.getElementById('concDensity').value = project.concDensity;
  document.getElementById('maxSpacing').value = project.maxSpacing;
  document.getElementById('projModal').classList.add('open');
  // Seed pending method and update UI
  const initMethod = project.calcMethod || 'balancing';
  document.getElementById('methodBalancingBtn').dataset.pending = initMethod;
  setTimeout(() => setCalcMethod(initMethod), 0);
}

function closeProjModal() {
  document.getElementById('projModal').classList.remove('open');
}

function saveProjSettings() {
  project.name = document.getElementById('projName').value;
  project.jobNo = document.getElementById('jobNo').value;
  project.prepBy = document.getElementById('prepBy').value;
  project.concDensity = +document.getElementById('concDensity').value;
  project.maxSpacing = +document.getElementById('maxSpacing').value;
  // Apply pending calcMethod — auto-recalc if method changed
  const pendingMethod = document.getElementById('methodBalancingBtn').dataset.pending;
  const methodChanged = pendingMethod && pendingMethod !== project.calcMethod;
  if (pendingMethod) project.calcMethod = pendingMethod;
  // Sync sidebar inputs
  if (document.getElementById('engDensity')) document.getElementById('engDensity').value = project.concDensity;
  if (document.getElementById('engSpacing')) document.getElementById('engSpacing').value = project.maxSpacing;
  document.getElementById('headerProjName').textContent = project.name;
  document.getElementById('headerJobNo').textContent = project.jobNo;
  calcResults = null;
  markDirty();
  closeProjModal();
  if (methodChanged && levels.some(l => !isBaseLevel(l) && l.zones.length > 0)) {
    setTimeout(() => runCalc(), 100);
  }
  // Refresh zone dropdowns in case props changed
  if (currentZoneLevelId) {
    const lev = levels.find(l => l.id === currentZoneLevelId);
    if (lev) renderZones(lev);
  }
}

function setCalcMethod(method) {
  // Store as pending — applied and dirtied on Save
  const balBtn = document.getElementById('methodBalancingBtn');
  const sharBtn = document.getElementById('methodSharingBtn');
  const desc = document.getElementById('methodDescription');
  if (!balBtn || !sharBtn || !desc) return;
  balBtn.dataset.pending = method;
  if (method === 'balancing') {
    balBtn.style.border = '2px solid var(--accent)';
    balBtn.style.background = 'rgba(232,160,32,0.1)';
    balBtn.style.color = 'var(--accent)';
    sharBtn.style.border = '2px solid var(--border)';
    sharBtn.style.background = 'transparent';
    sharBtn.style.color = 'var(--text-muted)';
    desc.textContent = 'Load is distributed across slabs based on individual slab capacities. Traditional method.';
  } else {
    sharBtn.style.border = '2px solid var(--accent2)';
    sharBtn.style.background = 'rgba(196,125,255,0.1)';
    sharBtn.style.color = 'var(--accent2)';
    balBtn.style.border = '2px solid var(--border)';
    balBtn.style.background = 'transparent';
    balBtn.style.color = 'var(--text-muted)';
    desc.textContent = 'Load is distributed based on nominated % share at each slab level. Reflects relative stiffness. Set % distribution in each zone.';
  }
}

// ════════════════════════════════════════════════
//  SUMMARY
// ════════════════════════════════════════════════
function updateSummary() {
  const totalZones = levels.reduce((a,l) => a + l.zones.length, 0);
  document.getElementById('sumLevels').textContent = levels.length;
  document.getElementById('sumZones').textContent = totalZones;
  document.getElementById('sumProps').textContent = getProps().length;
  if (!calcResults) {
    document.getElementById('sumStatus').innerHTML = `<span class="chip chip-warn">Not calculated</span>`;
  } else {
    const np = calcResults.filter(r=>r.isNP).length;
    if (np > 0) {
      document.getElementById('sumStatus').innerHTML = `<span class="chip" style="background:rgba(240,80,80,0.1);color:var(--np);border-color:rgba(240,80,80,0.2)">${np} Fail</span>`;
    } else {
      document.getElementById('sumStatus').innerHTML = `<span class="chip chip-green">All pass</span>`;
    }
  }
}

// ════════════════════════════════════════════════
//  PAGE NAVIGATION
// ════════════════════════════════════════════════
function showPage(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page-' + page).classList.add('active');
  const tab = document.getElementById('tab-' + page);
  if (tab) tab.classList.add('active');

  if (page === 'levels') renderLevels();
  if (page === 'engineer') renderEngineerView();
  if (page === 'builder') renderBuilderView();
  updateSummary();
  navPush({ screen: 'app', page, projectId: activeProjectId });
}
