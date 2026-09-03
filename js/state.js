// ════════════════════════════════════════════════
//  STATE
// ════════════════════════════════════════════════
let project = {
  name: 'Project 10354',
  jobNo: '10354',
  prepBy: '',
  concDensity: 24,
  maxSpacing: 3.0,
  props: [],
};

// Levels: bottom to top
// Each level: { id, name, thickness, slabCap, addLoad, zones: [...] }
// Zone: { id, name, thickness, levelsBelow: [{levelId, active, slabCap, addLoad, propId, propSnapshot:{type,capacity}, propCapOverride}] }
// Global working state — loaded from projectStore when a project is opened
let levels = [];
// props is now per-project — always access via current project.props
function getProps() { return (project && project.props) ? project.props : []; }
let calcResults = null;
let currentZoneLevelId = null;
let selectedBuilderPour = 0;
let _nextId = 100;
let _cachedAccessReason = 'trial'; // set on login by showDashboardWithAccessCheck
let _matrixRO = null;

function uid() { return 'id_' + (_nextId++); }

// Base level is always index 0 in the levels array
function isBaseLevel(lev) {
  return levels.indexOf(lev) === 0 || lev.isBase === true;
}
function isBaseLevelById(levelId) {
  const lev = levels.find(l => l.id === levelId);
  return lev ? isBaseLevel(lev) : false;
}

function getDefaultPropId() {
  const p_list = getProps();
  const def = p_list.find(p => p.isDefault);
  return def ? def.id : (p_list.length > 0 ? p_list[0].id : null);
}

function makeBlEntry(levelId, active, slabCap, addLoad) {
  const propId = getDefaultPropId();
  const libProp = propId ? getProps().find(p => p.id === propId) : null;
  return {
    levelId,
    active,
    slabCap,
    addLoad,
    sm: 0.95,
    distPct: 0,   // % load share (Load Sharing method)
    propId,
    propSnapshot: libProp ? { type: libProp.type, capacity: libProp.capacity } : null,
    propCapOverride: null,
  };
}

function makeDefaultZone(lev, levelIdx) {
  // Build levelsBelow array: levels below this one in reverse (nearest first)
  const DEFAULT_PCTS = [40, 35, 25]; // top 3 active levels
  const below = [];
  for (let j = levelIdx - 1; j >= 0; j--) {
    const depthBelow = levelIdx - 1 - j; // 0 = immediately below, 1 = two levels down, etc.
    const isActive = (levelIdx - j) <= 3;
    const bl = makeBlEntry(
      levels[j].id,
      isActive,
      levels[j].slabCap,
      depthBelow === 0 ? 0.3 : 0.1
    );
    bl.distPct = isActive && depthBelow < DEFAULT_PCTS.length ? DEFAULT_PCTS[depthBelow] : 0;
    below.push(bl);
  }
  return {
    id: 'z_' + lev.id + '_' + Date.now() + '_' + Math.random().toString(36).slice(2,5),
    name: nextZoneName(lev),
    thickness: lev.thickness,
    addLoad: 3.0,
    levelsBelow: below,
  };
}

function nextZoneName(lev) {
  // Find the highest Zone N number used, suggest next
  let max = 0;
  lev.zones.forEach(z => {
    const m = z.name.match(/^Zone (\d+)$/i);
    if (m) max = Math.max(max, parseInt(m[1]));
  });
  return `Zone ${max + 1}`;
}

function updateCalcBtn() {
  const btn = document.getElementById('calcBtn');
  if (!btn) return;
  btn.classList.remove('btn-calc-stale', 'btn-calc-ok');
  if (!calcResults) {
    btn.classList.add('btn-calc-stale');
    btn.textContent = '▶ Calculate';
  } else {
    btn.classList.add('btn-calc-ok');
    btn.textContent = '✓ Calculated';
  }
}

function markDirty() {
  calcResults = null;
  updateCalcBtn();
  scheduleSave();
}

function getPropCap(propId, snapshot) {
  // Always prefer the snapshot — protects against library edits/deletes
  if (snapshot && snapshot.capacity != null) return snapshot.capacity;
  if (!propId) return null;
  const p = getProps().find(pr => pr.id === propId);
  return p ? p.capacity : null;
}
