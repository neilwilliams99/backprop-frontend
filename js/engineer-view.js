// ════════════════════════════════════════════════
//  ENGINEER VIEW
// ════════════════════════════════════════════════
function renderEngineerView() {
  document.getElementById('engProjName').textContent = project.name;
  document.getElementById('engJobNo').textContent = 'Job No. ' + project.jobNo;
  document.getElementById('engDensity').value = project.concDensity;
  document.getElementById('engSpacing').value = project.maxSpacing;
  const methodBadgeEl = document.getElementById('engMethodBadge');
  if (methodBadgeEl) {
    const isSharing = project.calcMethod === 'sharing';
    methodBadgeEl.textContent = isSharing ? 'Load Sharing' : 'Load Balancing';
    methodBadgeEl.style.color = isSharing ? 'var(--accent2)' : 'var(--accent)';
    methodBadgeEl.style.borderColor = isSharing ? 'rgba(196,125,255,0.3)' : 'rgba(232,160,32,0.25)';
    methodBadgeEl.style.background = isSharing ? 'rgba(196,125,255,0.1)' : 'rgba(232,160,32,0.1)';
  }

  if (!calcResults || calcResults.length === 0) {
    document.getElementById('engineerMain').innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚙</div>
        <div class="empty-text">Configure levels & zones, then click Calculate</div>
        <div class="empty-hint">Results will appear here</div>
      </div>`;
    document.getElementById('engPoursBody').innerHTML = `<div style="font-size:11px;color:var(--text-muted)">No results yet</div>`;
    return;
  }

  // Guard: if results reference levels that no longer exist, treat as stale
  const currentLevelNamesEng = new Set(levels.map(l => l.name));
  if (calcResults.some(r => !currentLevelNamesEng.has(r.levelName))) {
    calcResults = null;
    updateCalcBtn();
    document.getElementById('engineerMain').innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">Project changed</div><div class="empty-hint">Click Calculate to update results</div></div>`;
    document.getElementById('engPoursBody').innerHTML = `<div style="font-size:11px;color:var(--text-muted)">Recalculate needed</div>`;
    return;
  }

  // Sidebar pour list — Pass/Fail only, clickable links to edit zone
  let poursHtml = '';
  [...calcResults].reverse().forEach((r) => {
    const pass = !r.isNP;
    const cl = pass ? 'var(--tg)' : 'var(--np)';
    const badge = pass ? 'PASS' : 'FAIL';
    // Find the level id so we can navigate to its zones page
    const lev = levels.find(l => l.name === r.levelName);
    const levId = lev ? lev.id : null;
    const linkAttr = levId ? `onclick="showPage('levels');openZones('${levId}')" style="cursor:pointer"` : '';
    poursHtml += `
      <div class="sidebar-pour-item" ${linkAttr} title="${levId ? 'Click to edit zones for ' + esc(r.levelName) : ''}">
        <span style="flex:1">${esc(r.label)}</span>
        <span style="color:${cl};font-weight:600;font-size:10px;flex-shrink:0">${badge}</span>
        ${levId ? `<span style="color:var(--text-dim);font-size:9px;flex-shrink:0;margin-left:4px">✎</span>` : ''}
      </div>`;
  });
  document.getElementById('engPoursBody').innerHTML = poursHtml || `<div style="font-size:11px;color:var(--text-muted)">No results</div>`;

  // Status bar
  const npCount = calcResults.filter(r => r.isNP).length;
  const tgCount = calcResults.filter(r => r.isTG && !r.isNP).length;

  // Build all level names that appear below any pour
  const allBelowNames = [];
  levels.forEach(l => { if (!allBelowNames.includes(l.name)) allBelowNames.push(l.name); });

  // helper: get prop label for a zone/level entry
  function getPropLabel(r, levelName) {
    const lev = levels.find(l => l.id === r.levelId);
    if (!lev) return '—';
    const zone = r.zoneId ? lev.zones.find(z => z.id === r.zoneId) : lev.zones.find(z => z.name === r.zoneName);
    if (!zone) return '—';
    const bl = zone.levelsBelow.find(b => {
      const bl2 = levels.find(l => l.id === b.levelId);
      return bl2 && bl2.name === levelName;
    });
    if (!bl || !bl.active) return '—';
    // Use snapshot type first, fall back to library
    if (bl.propSnapshot) return bl.propSnapshot.type;
    const prop = getProps().find(p => p.id === bl.propId);
    return prop ? prop.type : '—';
  }

  // helper: get slab capacity for a zone/level entry
  function getSlabCap(r, levelName) {
    const entry = r.levels.find(l => l.name === levelName);
    return entry ? entry.capacity : null;
  }

  const rowNames = [...new Set(levels.map(l=>l.name))].reverse();

  // shared column headers
  const colHeaders = calcResults.map(r => {
    const lev = levels.find(l => l.name === r.levelName);
    const levId = lev ? lev.id : null;
    const linkStart = levId ? `<a onclick="showPage('levels');openZones('${levId}')" style="cursor:pointer;color:var(--accent);text-decoration:none" title="Edit zones for ${esc(r.levelName)}">` : '<span>';
    const linkEnd = levId ? '</a>' : '</span>';
    return `<th class="col-pour">${linkStart}${esc(r.levelName)}<br><span style="font-weight:400;font-size:9px;color:var(--text-muted)">${esc(r.zoneName)}</span>${linkEnd}</th>`;
  }).join('');

  // ── Matrices side-by-side wrapper ─────────────────────────────────────────
  // ── 3x2 matrix grid ──────────────────────────────────────────────────────────
  let matHtml = `<div class="matrix-grid">`;

  // helper to build a matrix block
  function matBlock(title, tag, sub, bodyFn) {
    let html = `<div>
      <div class="results-title">${title} <span class="tag">${tag}</span></div>
      <div class="results-sub">${sub}</div>
      <div class="matrix-container">
        <table class="matrix-table"><thead><tr><th>Level</th>${colHeaders}</tr></thead><tbody>`;
    rowNames.forEach(levelName => {
      html += `<tr><td class="row-label">${esc(levelName)}</td>`;
      calcResults.forEach(r => { html += bodyFn(r, levelName); });
      html += `</tr>`;
    });
    html += `</tbody></table></div></div>`;
    return html;
  }

  // ── 1. Prop Spacing ──────────────────────────────────────────────────────────
  matHtml += matBlock('Prop Spacing','m c/c','Min spacing at each back-prop level. Green = OK, Orange = tight (&lt;1.2m), Red = Fail',
    (r, levelName) => {
      if (r.levelName === levelName) return `<td class="cell-wet">WET</td>`;
      const entry = r.levels.find(l => l.name === levelName);
      if (!entry) return `<td class="cell-empty">—</td>`;
      if (entry.status === 'Fail' || r.isNP) return `<td class="cell-np">Fail</td>`;
      const sp = entry.propSpacing;
      return `<td class="${!sp ? 'cell-empty' : sp < 1.2 ? 'cell-warn' : 'cell-ok'}">${sp ? sp.toFixed(2) : '—'}</td>`;
    });

  // ── 2. Prop Type ─────────────────────────────────────────────────────────────
  matHtml += matBlock('Prop Type','LIBRARY','Prop selected at each back-prop level for each pour/zone',
    (r, levelName) => {
      if (r.levelName === levelName) return `<td class="cell-wet">WET</td>`;
      const entry = r.levels.find(l => l.name === levelName);
      if (!entry) return `<td class="cell-empty">—</td>`;
      const label = getPropLabel(r, levelName);
      return `<td class="${label === '—' ? 'cell-empty' : 'cell-ok'}" style="max-width:70px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:10px" title="${esc(label)}">${esc(label)}</td>`;
    });

  // ── 3. Cumulative Load ───────────────────────────────────────────────────────
  matHtml += matBlock('Cumulative Load','kPa','Cumulative wet load at each level. Red = unresolved load (Fail)',
    (r, levelName) => {
      if (r.levelName === levelName) return `<td class="cell-wet">${r.totalLoad.toFixed(2)}</td>`;
      const entry = r.levels.find(l => l.name === levelName);
      if (!entry) return `<td class="cell-empty">—</td>`;
      const load = entry.cumulativeLoad;
      const cls = r.isNP ? 'cell-np' : load <= 0 ? 'cell-tg' : load > r.totalLoad * 0.8 ? 'cell-warn' : 'cell-ok';
      return `<td class="${cls}">${load.toFixed(2)}</td>`;
    });

  // ── 4. Slab Capacity ─────────────────────────────────────────────────────────
  matHtml += matBlock('Slab Capacity','kPa','Slab capacity at each back-prop level for each pour/zone',
    (r, levelName) => {
      const isBaseRow = levels.length > 0 && levels[0].name === levelName;
      if (r.levelName === levelName) return `<td class="cell-wet">WET</td>`;
      const entry = r.levels.find(l => l.name === levelName);
      if (!entry) return `<td class="cell-empty">—</td>`;
      if (isBaseRow) return `<td class="cell-tg" style="font-size:13px">∞</td>`;
      const cap = entry.capacity;
      return `<td class="${cap === null ? 'cell-empty' : 'cell-ok'}">${cap !== null ? cap.toFixed(2) : '—'}</td>`;
    });

  // ── 5. SM / Distribution % ───────────────────────────────────────────────────
  const isSharing5 = (project.calcMethod === 'sharing');
  matHtml += matBlock(
    isSharing5 ? 'Load Distribution' : 'Slab Stiffness Modifier',
    isSharing5 ? '%' : 'SM',
    isSharing5 ? '% of total construction load attracted by each slab. All slabs must pass capacity check before spacings shown.' : 'SM applied to slab capacity. 1.00 = full capacity, &lt;1.00 = reduced',
    (r, levelName) => {
      const isBaseRow = levels.length > 0 && levels[0].name === levelName;
      if (r.levelName === levelName) return `<td class="cell-wet">WET</td>`;
      const entry = r.levels.find(l => l.name === levelName);
      if (!entry) return `<td class="cell-empty">—</td>`;
      if (isBaseRow) return `<td class="cell-tg" style="font-size:13px">∞</td>`;
      if (isSharing5) {
        const pct = entry.distPct ?? 0;
        const share = entry.slabShare ?? 0;
        const cap = entry.capacity ?? 0;
        const passes = cap >= share;
        return `<td class="${passes ? 'cell-ok' : 'cell-np'}" title="Slab attracts ${share.toFixed(2)} kPa, capacity ${cap.toFixed(2)} kPa">${pct.toFixed(0)}%</td>`;
      }
      const sm = entry.sm ?? 1.0;
      return `<td class="${sm >= 1.0 ? 'cell-ok' : sm >= 0.7 ? 'cell-warn' : 'cell-np'}">${sm.toFixed(2)}</td>`;
    });

  // ── 6. Additional Load ───────────────────────────────────────────────────────
  matHtml += matBlock('Additional Load','kPa','Construction load applied at each back-prop level for each pour/zone',
    (r, levelName) => {
      const isBaseRow = levels.length > 0 && levels[0].name === levelName;
      if (r.levelName === levelName) return `<td class="cell-wet">WET</td>`;
      const entry = r.levels.find(l => l.name === levelName);
      if (!entry) return `<td class="cell-empty">—</td>`;
      if (isBaseRow) return `<td class="cell-tg">—</td>`;
      // look up addLoad from the zone data
      const lev = levels.find(l => l.name === r.levelName);
      const zone = lev ? lev.zones.find(z => z.name === r.zoneName) : null;
      const bl = zone ? zone.levelsBelow.find(b => {
        const bLevel = levels.find(ll => ll.name === levelName);
        return bLevel && b.levelId === bLevel.id;
      }) : null;
      const addLoad = bl ? bl.addLoad : null;
      return `<td class="${addLoad === null ? 'cell-empty' : 'cell-ok'}">${addLoad !== null ? addLoad.toFixed(2) : '—'}</td>`;
    });

  matHtml += `</div>`; // end 3x2 grid

  // ── Pour Scenario Detail cards ─────────────────────────────────────────────
  matHtml += `<div class="results-title" style="margin-top:20px">Pour Scenario Detail</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px">`;

  calcResults.forEach(r => {
    const statusCls = r.isNP ? 'fail' : 'pass';
    const statusTxt = r.isNP ? 'FAIL' : 'PASS';
    const resolutionColour = r.isNP ? 'var(--np)' : 'var(--tg)';
    const resolutionLabel = r.isNP ? 'Fail' : 'Pass';
    matHtml += `
      <div style="background:var(--surface);border:1px solid var(--border);border-radius:8px;overflow:hidden">
        <div style="background:var(--surface2);padding:10px 14px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between">
          <span style="font-family:'Syne',sans-serif;font-size:12px;font-weight:700">${esc(r.label)}</span>
          <span class="pass-badge ${statusCls}">${statusTxt}</span>
        </div>
        <div style="padding:12px 14px">
          <div class="info-row"><span class="info-key">Thickness</span><span class="info-val">${r.thickness} mm</span></div>
          <div class="info-row"><span class="info-key">Slab self-weight</span><span class="info-val">${r.slabLoad.toFixed(2)} kPa</span></div>
          <div class="info-row"><span class="info-key">Total wet load</span><span class="info-val">${r.totalLoad.toFixed(2)} kPa</span></div>
          <div class="info-row"><span class="info-key">Back-prop levels</span><span class="info-val">${r.levels.length}</span></div>
          <div class="info-row"><span class="info-key">Method</span><span class="info-val" style="color:${project.calcMethod === 'sharing' ? 'var(--accent2)' : 'var(--text-muted)'};">${project.calcMethod === 'sharing' ? 'Load Sharing' : 'Load Balancing'}</span></div>
          <div class="info-row"><span class="info-key">Resolution</span><span class="info-val" style="color:${resolutionColour};font-weight:600">${resolutionLabel}</span></div>
          ${r.isNP ? `<div style="margin-top:8px;padding:8px;background:rgba(240,80,80,0.08);border:1px solid rgba(240,80,80,0.2);border-radius:5px;color:var(--np);font-size:10px">⚠ ${r.failReason || 'Review back-propping arrangement.'}</div>` : ''}
        </div>
      </div>`;
  });

  matHtml += `</div>`;
  document.getElementById('engineerMain').innerHTML = matHtml;
  // Responsive matrix grid — measure first matrix to decide column count
  requestAnimationFrame(() => {
    const main = document.getElementById('engineerMain');
    const grid = main ? main.querySelector('.matrix-grid') : null;
    if (!grid) return;
    function updateCols() {
      const firstMatrix = grid.querySelector('.matrix-container table');
      const matW = firstMatrix ? firstMatrix.scrollWidth : 300;
      const available = grid.offsetWidth;
      // how many matrices fit side by side?
      const fit = Math.floor(available / (matW + 20));
      const cols = Math.max(1, Math.min(3, fit));
      grid.setAttribute('data-cols', cols === 3 ? '' : String(cols));
    }
    updateCols();
    if (window._matrixRO) window._matrixRO.disconnect();
    window._matrixRO = new ResizeObserver(updateCols);
    window._matrixRO.observe(grid);
  });
}
