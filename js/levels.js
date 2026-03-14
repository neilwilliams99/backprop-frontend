// ════════════════════════════════════════════════
//  BUILDING LEVELS PAGE
// ════════════════════════════════════════════════
function renderLevels() {
  const body = document.getElementById('levelsBody');
  body.innerHTML = '';
  const total = levels.length;

  // Display top to bottom (roof first, ground last) — mirrors physical building
  [...levels].reverse().forEach((lev) => {
    const i = levels.indexOf(lev); // real index in levels array for callbacks
    const isBase = i === 0; // index 0 = base level
    const zoneCount = lev.zones.length;
    const rowNum = levels.length - i; // display number: 1 = highest

    const row = document.createElement('div');
    row.className = `level-row${isBase ? ' is-ground' : ''}`;
    row.innerHTML = `
      <div class="level-badge ${isBase ? 'ground' : ''}">${isBase ? '⊕' : rowNum}</div>
      <div style="display:flex;align-items:center;gap:8px">
        <input class="row-input name" value="${esc(lev.name)}"
          onchange="updateLevel(${i},'name',this.value)"
          placeholder="e.g. L4">
      </div>
      <div style="display:flex;align-items:center;justify-content:flex-start">
        ${isBase
          ? `<span style="font-size:11px;color:var(--text-dim);font-style:italic">— Base Level —</span>`
          : `<button class="level-zones-btn ${zoneCount > 0 ? 'has-zones' : ''}" onclick="openZones('${lev.id}')">
              ${zoneCount > 0 ? `${zoneCount} zone${zoneCount>1?'s':''} →` : 'Add zones →'}
            </button>`}
      </div>
      <div style="display:flex;align-items:center;justify-content:center">
        ${!isBase && total > 2 ? `<button class="del-btn" onclick="removeLevel(${i})">×</button>` : ''}
      </div>
    `;
    body.appendChild(row);
  });
  updateSummary();
}

function updateLevel(i, key, val) {
  levels[i][key] = val;
  if (key === 'name') renderLevels();
  markDirty();
  updateSummary();
}

function addLevel() {
  const newId = 'lv_' + uid();
  const newLevel = {
    id: newId,
    name: `L${levels.length}`,
    thickness: 230,
    slabCap: 2.5,
    addLoad: 3.0,
    zones: [],
  };
  levels.push(newLevel);
  renderLevels();
  markDirty();
  showToast('Level added', 'success');
}

function removeLevel(i) {
  if (i === 0) return; // base level is protected
  if (levels.length <= 2) return;
  const name = levels[i].name;
  levels.splice(i, 1);
  renderLevels();
  markDirty();
  showToast(`Level ${name} removed`, 'info');
}
