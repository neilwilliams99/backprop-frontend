// ════════════════════════════════════════════════
//  MULTI-PROJECT STATE
// ════════════════════════════════════════════════

// Each project stored as: { id, project, levels, props, calcResults }
let projectStore = [];
let activeProjectId = null;

function makeNewProjectData(name, jobNo) {
  const id = 'proj_' + Date.now() + '_' + Math.random().toString(36).slice(2,5);
  return {
    id,
    project: { name: name || 'New Project', jobNo: jobNo || '', prepBy: '', concDensity: 24, maxSpacing: 3.0, props: [], calcMethod: 'balancing' },
    // Always seed with base level at index 0 — infinite capacity, not deletable
    levels: [
      { id: 'base_' + id, name: 'Ground', thickness: 0, slabCap: 100000, addLoad: 0, zones: [], isBase: true }
    ],
    calcResults: null,
  };
}

function renderProjectList() {
  const grid = document.getElementById('projGrid');
  grid.innerHTML = '';
  projectStore.forEach(p => {
    const totalZones = p.levels.reduce((a,l) => a + l.zones.length, 0);
    const npCount = p.calcResults ? p.calcResults.filter(r=>r.isNP).length : 0;
    const statusColor = !p.calcResults ? 'var(--text-muted)' : npCount > 0 ? 'var(--np)' : 'var(--tg)';
    const statusTxt = !p.calcResults ? 'Not calculated' : npCount > 0 ? `${npCount} Fail` : 'All pass';
    const card = document.createElement('div');
    card.className = 'proj-card';
    card.innerHTML = `
      <button class="proj-card-del" onclick="event.stopPropagation();deleteProject('${p.id}')" title="Delete project">×</button>
      <div class="proj-card-name">${esc(p.project.name)}</div>
      <div class="proj-card-meta">Job No. ${esc(p.project.jobNo || '—')}${p.project.prepBy ? ' · ' + esc(p.project.prepBy) : ''}</div>
      <div class="proj-card-stats">
        <div class="proj-card-stat"><span class="proj-card-stat-val">${p.levels.length}</span>Levels</div>
        <div class="proj-card-stat"><span class="proj-card-stat-val">${totalZones}</span>Zones</div>
        <div class="proj-card-stat"><span class="proj-card-stat-val">${(p.project.props||[]).length}</span>Props</div>
        <div class="proj-card-stat"><span class="proj-card-stat-val" style="color:${statusColor};font-size:11px">${statusTxt}</span>Status</div>
      </div>`;
    card.onclick = () => openProject(p.id);
    grid.appendChild(card);
  });
  const newCard = document.createElement('div');
  newCard.className = 'proj-card proj-card-new';
  newCard.innerHTML = `<div class="proj-new-icon">+</div><div class="proj-new-label">New Project</div>`;
  newCard.onclick = createProject;
  grid.appendChild(newCard);
}

// ── Supabase save/load ──
let saveTimer = null;
function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const p = projectStore.find(x => x.id === activeProjectId);
    if (p) { saveActiveProject(); dbSaveProject(p); }
  }, 2000);
}

async function dbLoadProjects() {
  if (!currentUser) return;
  const { data, error } = await supa.from('projects').select('*').order('updated_at', { ascending: false });
  if (error) { console.error('Load error:', error); return; }
  projectStore = (data || []).map(row => ({
    id:          row.id,
    _supaId:     row.id,
    project:     { name: row.name, jobNo: row.job_no || '', prepBy: row.prep_by || '', concDensity: 24, maxSpacing: 3.0, props: [], calcMethod: 'balancing', ...(row.data.project || {}) },
    levels:      row.data.levels      || [],
    calcResults: row.data.calcResults || null,
  }));

}

async function dbSaveProject(p) {
  if (!currentUser) return;
  const payload = {
    user_id: currentUser.id,
    name:    p.project.name,
    job_no:  p.project.jobNo  || '',
    prep_by: p.project.prepBy || '',
    data:    { project: p.project, levels: p.levels, calcResults: p.calcResults },
  };
  if (p._supaId) {
    const { error } = await supa.from('projects').update(payload).eq('id', p._supaId);
    if (error) console.error('Save error:', error);
    // silent save
  } else {
    const { data, error } = await supa.from('projects').insert(payload).select().single();
    if (error) { console.error('Insert error:', error); return; }
    p._supaId = data.id;
    p.id      = data.id;
    // silent save
  }
}

async function createProject() {
  // Trial limit: check cached access reason rather than re-hitting the API
  if (_cachedAccessReason === 'trial' && projectStore.length >= 1) {
    await dlgAlert(
      'Trial Limit Reached',
      'Free trial accounts are limited to 1 project. Subscribe to create unlimited projects.',
      'OK'
    );
    showPaywall('trial_limit');
    return;
  }
  openNewProjModal();
}

let _newProjMethod = 'balancing';
let _newProjPropVisible = false;

function openNewProjModal() {
  _newProjMethod = 'balancing';
  _newProjPropVisible = false;
  const n = projectStore.length + 1;
  document.getElementById('npName').value = 'Project ' + n;
  document.getElementById('npJobNo').value = '';
  document.getElementById('npPrepBy').value = '';
  document.getElementById('npPropType').value = '';
  document.getElementById('npPropExtension').value = '';
  document.getElementById('npPropCapacity').value = '';
  document.getElementById('npPropNotes').value = '';
  document.getElementById('npPropFormWrap').style.display = 'none';
  document.getElementById('npPropToggleBtn').textContent = '+ Add a Prop';
  setNpMethod('balancing');
  document.getElementById('newProjModal').classList.add('open');
  setTimeout(() => document.getElementById('npName').focus(), 50);
}

function closeNewProjModal() {
  document.getElementById('newProjModal').classList.remove('open');
}

function setNpMethod(method) {
  _newProjMethod = method;
  const balBtn = document.getElementById('npMethodBalancingBtn');
  const sharBtn = document.getElementById('npMethodSharingBtn');
  const desc = document.getElementById('npMethodDesc');
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
    sharBtn.style.background = 'rgba(77,168,255,0.1)';
    sharBtn.style.color = 'var(--accent2)';
    balBtn.style.border = '2px solid var(--border)';
    balBtn.style.background = 'transparent';
    balBtn.style.color = 'var(--text-muted)';
    desc.textContent = 'Load is distributed based on nominated % share at each slab level. Reflects relative stiffness. Set % distribution in each zone.';
  }
}

function toggleNpPropForm() {
  _newProjPropVisible = !_newProjPropVisible;
  document.getElementById('npPropFormWrap').style.display = _newProjPropVisible ? 'block' : 'none';
  document.getElementById('npPropToggleBtn').textContent = _newProjPropVisible ? '− Remove Prop' : '+ Add a Prop';
}

async function submitNewProject() {
  const name  = document.getElementById('npName').value.trim() || ('Project ' + (projectStore.length + 1));
  const jobNo = document.getElementById('npJobNo').value.trim();
  const prepBy = document.getElementById('npPrepBy').value.trim();

  const p = makeNewProjectData(name, jobNo);
  p.project.prepBy = prepBy;
  p.project.calcMethod = _newProjMethod;

  // Optional prop
  if (_newProjPropVisible) {
    const propType = document.getElementById('npPropType').value.trim();
    const propCap  = parseFloat(document.getElementById('npPropCapacity').value);
    if (propType && !isNaN(propCap) && propCap > 0) {
      const newProp = {
        id: 'p_' + uid(),
        type: propType,
        extension: document.getElementById('npPropExtension').value.trim(),
        capacity: propCap,
        notes: document.getElementById('npPropNotes').value.trim(),
        isDefault: true,
      };
      p.project.props = [newProp];
    } else if (propType || document.getElementById('npPropCapacity').value) {
      showToast('Prop not saved — enter both type and a valid capacity, or remove the prop section.', 'error');
      return;
    }
  }

  closeNewProjModal();
  p._supaId = null;
  projectStore.unshift(p);
  await dbSaveProject(p);
  openProject(p.id);
}

function openProject(id) {
  const p = projectStore.find(x => x.id === id);
  if (!p) return;
  if (activeProjectId) saveActiveProject();
  activeProjectId = id;
  project     = p.project;
  levels      = p.levels;
  calcResults = null; // always start fresh — recalculate below rather than rendering stale saved results
  document.getElementById('headerProjName').textContent = project.name;
  document.getElementById('headerJobNo').textContent    = project.jobNo;
  document.getElementById('projectListScreen').style.display = 'none';
  document.getElementById('appShell').style.display = 'block';
  showPage('levels');
  if (p.calcResults) {
    // Project had prior results — silently recalculate from inputs so the
    // display always reflects the current calculation logic, not saved data.
    runCalc({ silent: true });
  } else {
    updateCalcBtn();
  }
}

function saveActiveProject() {
  const p = projectStore.find(x => x.id === activeProjectId);
  if (p) { p.project = project; p.levels = levels; p.calcResults = calcResults; }
}

function showProjectList() {
  saveActiveProject();
  document.getElementById('appShell').style.display = 'none';
  document.getElementById('projectListScreen').style.display = 'flex';
  updateDashWelcome();
  renderProjectList();
}

async function deleteProject(id) {
  const ok = await dlgConfirm('Delete project?', 'This cannot be undone.', 'Delete');
  if (!ok) return;
  const p = projectStore.find(x => x.id === id);
  if (p && p._supaId) await supa.from('projects').delete().eq('id', p._supaId);
  projectStore = projectStore.filter(x => x.id !== id);
  if (activeProjectId === id) {
    activeProjectId = null;
    document.getElementById('projectListScreen').style.display = 'flex';
  }
  renderProjectList();
  showToast('Project deleted', 'info');
}
