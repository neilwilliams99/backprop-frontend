// ════════════════════════════════════════════════
//  ZONES PAGE
// ════════════════════════════════════════════════
function openZones(levelId) {
  currentZoneLevelId = levelId;
  const lev = levels.find(l => l.id === levelId);
  if (!lev) return;

  document.getElementById('zonesBreadcrumbLevel').textContent = lev.name;
  document.getElementById('zonesPageTitle').textContent = `${lev.name} — Zones`;

  // Ensure zones have up-to-date levelsBelow
  lev.zones.forEach(zone => refreshZoneLevelsBelow(zone, lev));

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('page-zones').classList.add('active');
  renderZones(lev);
}

function refreshZoneLevelsBelow(zone, lev) {
  const levIdx = levels.indexOf(lev);
  // Add any new levels below that don't exist in zone.levelsBelow
  for (let j = levIdx - 1; j >= 0; j--) {
    const blev = levels[j];
    if (!zone.levelsBelow.find(b => b.levelId === blev.id)) {
      const depthBelow = levIdx - 1 - j;
      zone.levelsBelow.push(makeBlEntry(
        blev.id,
        (levIdx - j) <= 3,
        blev.slabCap,
        depthBelow === 0 ? 0.3 : 0.1
      ));
    }
  }
  // Remove deleted levels
  zone.levelsBelow = zone.levelsBelow.filter(b => levels.find(l => l.id === b.levelId));
}

function renderZones(lev) {
  const grid = document.getElementById('zonesGrid');
  grid.innerHTML = '';
  const levIdx = levels.indexOf(lev);

  lev.zones.forEach((zone, zi) => {
    const card = document.createElement('div');
    card.className = 'zone-card';

    // Build levels-below table rows
    let levBelowRows = '';
    zone.levelsBelow.forEach((bl, bli) => {
      const blev = levels.find(l => l.id === bl.levelId);
      if (!blev) return;
      const isGnd = isBaseLevel(blev);
      const disabledAttr = bl.active ? '' : 'disabled';

      // Prop selector options
      let propOpts = getProps().length === 0 ? `<option value="">— add props to library —</option>` : "";
      getProps().forEach(p => {
        propOpts += `<option value="${p.id}" ${bl.propId === p.id ? 'selected' : ''}>${p.type} (${p.capacity}kN)</option>`;
      });

      // Prop capacity display
      let propCapVal = bl.propCapOverride !== null ? bl.propCapOverride : getPropCap(bl.propId, bl.propSnapshot);

      const isSharing = (project.calcMethod === 'sharing');
      // T/G: check if the lowest active entry is the base level
      const activeBl_list = zone.levelsBelow.filter(b => b.active);
      const isTG_zone = activeBl_list.length > 0 && isBaseLevel(levels.find(l => l.id === activeBl_list[activeBl_list.length - 1].levelId));
      const col3 = isSharing
        ? (isGnd
          ? `<div class="zone-lvl-input" style="opacity:0.3;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--text-muted)">0%</div>`
          : isTG_zone
            ? `<div class="zone-lvl-input" style="opacity:0.3;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--text-muted)">0%</div>`
            : `<input class="zone-lvl-input" type="number" value="${bl.distPct ?? 0}" step="1" min="0" max="100" ${disabledAttr}
                title="% of total load this slab carries"
                onchange="setZoneLevelField('${lev.id}',${zi},${bli},'distPct',+this.value);updateDistPctSum('${lev.id}',${zi})" style="font-weight:700;color:var(--accent2)">`)
        : (isGnd
          ? `<div class="zone-lvl-input" style="opacity:0.3;display:flex;align-items:center;justify-content:center;font-size:10px;color:var(--text-muted)">—</div>`
          : `<input class="zone-lvl-input" type="number" value="${(bl.sm ?? 1.00).toFixed(2)}" step="0.05" min="0.1" max="1.0" ${disabledAttr}
              title="Slab stiffness modifier (multiplies slab capacity)"
              onchange="setZoneLevelField('${lev.id}',${zi},${bli},'sm',+this.value)">`);

      levBelowRows += `
        <div class="zone-level-row ${bl.active ? 'checked' : 'disabled'}">
          <input type="checkbox" class="zone-check" ${bl.active ? 'checked' : ''}
            onchange="setZoneLevelActive('${lev.id}',${zi},${bli},this.checked)">
          <div class="zone-lvl-name">${esc(blev.name)}</div>
          ${isGnd
            ? `<div class="zone-lvl-input" style="display:flex;align-items:center;justify-content:center;font-size:16px;color:var(--tg);opacity:${bl.active?1:0.3}">∞</div>`
            : `<input class="zone-lvl-input" type="number" value="${bl.slabCap}" step="0.5" ${disabledAttr}
                title="Slab capacity (kPa)"
                onchange="setZoneLevelField('${lev.id}',${zi},${bli},'slabCap',+this.value)">`}
          ${col3}
          <input class="zone-lvl-input" type="number" value="${bl.addLoad}" step="0.5" ${disabledAttr}
            title="Additional construction load (kPa)"
            onchange="setZoneLevelField('${lev.id}',${zi},${bli},'addLoad',+this.value)">
          <div class="prop-selector-row" style="${bl.active ? '' : 'opacity:0.3;pointer-events:none'}">
            <select class="prop-select" onchange="setZoneProp('${lev.id}',${zi},${bli},this.value)">
              ${propOpts}
            </select>
          </div>
        </div>
      `;
    });

    // Calculate % sum for Load Sharing validation display
    const isSharing = (project.calcMethod === 'sharing');
    const activeBls = zone.levelsBelow.filter(b => b.active);
    // T/G: lowest active entry is base level
    const isTGZone = activeBls.length > 0 && isBaseLevel(levels.find(l => l.id === activeBls[activeBls.length - 1].levelId));
    const pctSum = isSharing && !isTGZone ? activeBls.reduce((s, b) => {
      const bl = levels.find(l => l.id === b.levelId);
      return isBaseLevel(bl) ? s : s + (b.distPct ?? 0);
    }, 0) : 100;
    const pctOk = isTGZone || Math.abs(pctSum - 100) < 0.01;
    const pctSumWarning = (isSharing && !isTGZone) ? `<div id="pctWarn_${lev.id}_${zi}" style="margin-top:6px;padding:6px 10px;border-radius:5px;font-size:10px;font-family:'DM Mono',monospace;${pctOk ? 'color:var(--tg);background:rgba(56,201,110,0.08);border:1px solid rgba(56,201,110,0.2)' : 'color:var(--np);background:rgba(240,80,80,0.08);border:1px solid rgba(240,80,80,0.2)'}">
      Σ distribution = ${pctSum.toFixed(0)}% ${pctOk ? '✓' : '— must equal 100%'}
    </div>` : '';

    card.innerHTML = `
      <div class="zone-card-header">
        <div class="zone-card-title">
          <span>${esc(lev.name)}</span>
          <span style="color:var(--text-muted)">·</span>
          <input style="background:transparent;border:none;border-bottom:1px dashed var(--border);color:var(--accent);font-family:'Syne',sans-serif;font-weight:700;font-size:12px;width:140px;outline:none;padding-bottom:1px"
            value="${esc(zone.name)}"
            title="Click to rename zone"
            onchange="setZoneName('${lev.id}',${zi},this.value)">
          <span class="zone-thickness-badge" id="zoneBadge_${lev.id}_${zi}">${zone.thickness} mm</span>
        </div>
        <button class="del-btn" onclick="removeZone('${lev.id}',${zi})">×</button>
      </div>
      <div class="zone-body">
        <div style="display:flex;gap:12px">
          <div class="zone-field" style="flex:1">
            <label>Wet concrete thickness (mm)</label>
            <input class="zone-input" type="number" value="${zone.thickness}" step="10"
              onchange="setZoneThickness('${lev.id}',${zi},+this.value)">
          </div>
          <div class="zone-field" style="flex:1">
            <label>Construction load — wet level (kPa)</label>
            <input class="zone-input" type="number" value="${zone.addLoad ?? 3.0}" step="0.1" min="0"
              title="Additional construction load applied at the wet slab level (formwork, equipment, workers)"
              onchange="setZoneAddLoad('${lev.id}',${zi},+this.value)">
          </div>
        </div>

        <div style="margin-top:10px">
          <div style="font-size:10px;color:var(--text-muted);margin-bottom:5px;display:flex;align-items:center;gap:8px">
            LOAD-BEARING LEVELS BELOW
            <span class="chip" style="font-size:9px">✓ = In Back-Prop Stack</span>
          </div>
          <div class="zone-levels-table">
            <div class="zone-levels-table-header">
              <div class="zone-col-head"></div>
              <div class="zone-col-head">Level</div>
              <div class="zone-col-head">Slab Cap<br><span style="font-weight:400;text-transform:none;font-size:8px">kPa</span></div>
              <div class="zone-col-head" id="zoneColHead3_${lev.id}_${zi}">${isSharing ? 'Dist %<br><span style=\"font-weight:400;text-transform:none;font-size:8px\">%</span>' : 'SM<br><span style=\"font-weight:400;text-transform:none;font-size:8px\">×</span>'}</div>
              <div class="zone-col-head">Add Load<br><span style="font-weight:400;text-transform:none;font-size:8px">kPa</span></div>
              <div class="zone-col-head">Prop Selection</div>
            </div>
            ${zone.levelsBelow.length > 0 ? levBelowRows : '<div style="padding:12px;font-size:11px;color:var(--text-muted);text-align:center">No levels below this one</div>'}
            ${isSharing ? pctSumWarning : ''}
          </div>
        </div>
      </div>
    `;
    grid.appendChild(card);
  });

  if (lev.zones.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="height:200px"><div class="empty-icon">📐</div><div class="empty-text">No zones defined yet</div><div class="empty-hint">Click Add Zone to start</div></div>`;
  }
}


function addZone() {
  const lev = levels.find(l => l.id === currentZoneLevelId);
  if (!lev) return;
  const levIdx = levels.indexOf(lev);
  const newZone = {
    id: 'z_' + uid(),
    name: nextZoneName(lev),
    thickness: lev.thickness,
    addLoad: 3.0,
    levelsBelow: [],
  };
  const DEFAULT_PCTS2 = [40, 35, 25];
  for (let j = levIdx - 1; j >= 0; j--) {
    const depthBelow = levIdx - 1 - j;
    const isActive = (levIdx - j) <= 3;
    const bl = makeBlEntry(
      levels[j].id,
      isActive,
      levels[j].slabCap,
      depthBelow === 0 ? 0.3 : 0.1
    );
    bl.distPct = isActive && depthBelow < DEFAULT_PCTS2.length ? DEFAULT_PCTS2[depthBelow] : 0;
    newZone.levelsBelow.push(bl);
  }
  lev.zones.push(newZone);
  renderZones(lev);
  markDirty();
  updateSummary();
}

function removeZone(levId, zi) {
  const lev = levels.find(l => l.id === levId);
  if (!lev) return;
  lev.zones.splice(zi, 1);
  renderZones(lev);
  markDirty();
  updateSummary();
}

function setZoneName(levId, zi, val) {
  const lev = levels.find(l => l.id === levId);
  if (!lev) return;
  lev.zones[zi].name = val;
  markDirty();
}

function setZoneThickness(levId, zi, val) {
  const lev = levels.find(l => l.id === levId);
  if (!lev) return;
  lev.zones[zi].thickness = val;
  const badge = document.getElementById(`zoneBadge_${levId}_${zi}`);
  if (badge) badge.textContent = val + ' mm';
  markDirty();
}

function setZoneAddLoad(levId, zi, val) {
  const lev = levels.find(l => l.id === levId);
  if (!lev) return;
  lev.zones[zi].addLoad = val;
  markDirty();
}

function setZoneLevelActive(levId, zi, bli, checked) {
  const lev = levels.find(l => l.id === levId);
  if (!lev) return;
  lev.zones[zi].levelsBelow[bli].active = checked;
  renderZones(lev);
  markDirty();
}

function setZoneLevelField(levId, zi, bli, field, val) {
  const lev = levels.find(l => l.id === levId);
  if (!lev) return;
  lev.zones[zi].levelsBelow[bli][field] = val;
  markDirty();
}

function updateDistPctSum(levId, zi) {
  const lev = levels.find(l => l.id === levId);
  if (!lev) return;
  const zone = lev.zones[zi];
  const activeBls = zone.levelsBelow.filter(b => b.active);
  // Suppress warning if T/G
  const isTG = activeBls.length > 0 && isBaseLevel(levels.find(l => l.id === activeBls[activeBls.length - 1].levelId));
  if (isTG) { markDirty(); return; }
  const pctSum = activeBls.reduce((s, b) => {
    const bl = levels.find(l => l.id === b.levelId);
    return isBaseLevel(bl) ? s : s + (b.distPct ?? 0);
  }, 0);
  const pctOk = Math.abs(pctSum - 100) < 0.01;
  const warnEl = document.getElementById(`pctWarn_${levId}_${zi}`);
  if (warnEl) {
    warnEl.textContent = `Σ distribution = ${pctSum.toFixed(0)}% ${pctOk ? '✓' : '— must equal 100%'}`;
    warnEl.style.color = pctOk ? 'var(--tg)' : 'var(--np)';
    warnEl.style.background = pctOk ? 'rgba(56,201,110,0.08)' : 'rgba(240,80,80,0.08)';
    warnEl.style.border = pctOk ? '1px solid rgba(56,201,110,0.2)' : '1px solid rgba(240,80,80,0.2)';
  }
  markDirty();
}

function setZoneProp(levId, zi, bli, propId) {
  const lev = levels.find(l => l.id === levId);
  if (!lev) return;
  const bl = lev.zones[zi].levelsBelow[bli];
  bl.propId = propId || null;
  bl.propCapOverride = null;
  // Snapshot the prop data at assignment time — protects against library edits/deletes
  const libProp = getProps().find(p => p.id === propId);
  bl.propSnapshot = libProp ? { type: libProp.type, capacity: libProp.capacity } : null;
  markDirty();
}

function reconcilePropIds() {
  const validIds = new Set(getProps().map(p => p.id));
  const defaultId = getDefaultPropId();
  levels.forEach(lev => {
    lev.zones.forEach(zone => {
      zone.levelsBelow.forEach(bl => {
        if (bl.propId && !validIds.has(bl.propId)) {
          // Prop deleted from library — snapshot preserves calc data, just clear stale ID
          if (bl.propSnapshot) {
            bl.propId = null;
          } else {
            // No snapshot (legacy) — reassign to default
            bl.propId = defaultId;
            bl.propCapOverride = null;
          }
        }
        // Only assign default if there is truly nothing — no ID and no snapshot
        if (!bl.propId && !bl.propSnapshot && defaultId) {
          bl.propId = defaultId;
          const libProp = getProps().find(p => p.id === defaultId);
          if (libProp) bl.propSnapshot = { type: libProp.type, capacity: libProp.capacity };
        }
      });
    });
  });
  markDirty();
}
