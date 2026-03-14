// ════════════════════════════════════════════════
//  BUILDER VIEW
// ════════════════════════════════════════════════
function renderBuilderView() {
  if (!calcResults || calcResults.length === 0) {
    document.getElementById('builderPourList').innerHTML = `<div style="font-size:11px;color:var(--text-muted)">No results — click Calculate first</div>`;
    document.getElementById('builderContent').innerHTML = `<div class="empty-state"><div class="empty-icon">👷</div><div class="empty-text">Calculate first</div></div>`;
    return;
  }

  // Guard: if any result references a level that no longer exists, results are stale
  const currentLevelNames = new Set(levels.map(l => l.name));
  const isStale = calcResults.some(r => !currentLevelNames.has(r.levelName));
  if (isStale) {
    calcResults = null;
    updateCalcBtn();
    document.getElementById('builderPourList').innerHTML = `<div style="font-size:11px;color:var(--text-muted)">Levels changed — recalculate</div>`;
    document.getElementById('builderContent').innerHTML = `<div class="empty-state"><div class="empty-icon">⚠️</div><div class="empty-text">Project changed</div><div class="empty-hint">Click Calculate to update results</div></div>`;
    return;
  }

  // Pour list — reversed so highest level pours appear first (top of building down)
  const listEl = document.getElementById('builderPourList');
  listEl.innerHTML = '';
  [...calcResults].reverse().forEach((r, revIdx) => {
    const i = calcResults.length - 1 - revIdx; // real index for selection
    const item = document.createElement('div');
    item.className = `pour-item${i === selectedBuilderPour ? ' active' : ''}`;
    const passColour = r.isNP ? 'var(--np)' : 'var(--tg)';
    const passTxt = r.isNP ? 'Fail' : 'Pass';
    item.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
      <div class="pour-item-name">${esc(r.label)}</div>
      <span style="color:${passColour};font-size:10px;font-weight:600">${passTxt}</span></div>
      <div class="pour-item-sub">${r.thickness}mm · ${r.totalLoad.toFixed(1)} kPa</div>`;
    item.onclick = () => { selectedBuilderPour = i; renderBuilderView(); };
    listEl.appendChild(item);
  });

  renderBuilderVis(calcResults[selectedBuilderPour]);
}

function renderBuilderVis(pour) {
  if (!pour) return;
  const content = document.getElementById('builderContent');

  // Build level visualisation (top to bottom display)
  const levelsTopDown = [...levels].reverse();
  const activeNames = new Set([pour.levelName, ...pour.levels.map(l=>l.name)]);

  let visHtml = `<div class="building-vis-wrap">
    <div style="font-family:'Syne',sans-serif;font-size:13px;font-weight:700;margin-bottom:14px;color:var(--text-muted)">
      Back-propping arrangement for <span style="color:var(--text)">${esc(pour.label)}</span>
    </div>
    <div class="builder-legend">
      <div class="legend-item"><div class="legend-swatch" style="color:var(--wet);background:rgba(77,168,255,0.2)"></div>Wet pour (active)</div>
      <div class="legend-item"><div class="legend-swatch" style="color:var(--tg);background:rgba(56,201,110,0.2)"></div>Back-propped</div>
      <div class="legend-item"><div class="legend-swatch" style="color:var(--warn);background:rgba(212,146,26,0.2)"></div>Tight (&lt;1.2m)</div>
      <div class="legend-item"><div class="legend-swatch" style="color:var(--np);background:rgba(240,80,80,0.2)"></div>Fail</div>
      <div class="legend-item"><div class="legend-swatch" style="color:var(--border);background:var(--surface2)"></div>Not involved</div>
    </div>`;

  levelsTopDown.forEach((lev, idx) => {
    const isCurrent = lev.name === pour.levelName;
    const entry = pour.levels.find(l => l.name === lev.name);

    let barClass = 'slab-neutral';
    let barText = lev.name;

    if (isCurrent) {
      barClass = 'slab-wet';
      barText = `${lev.name} — WET POUR (${pour.thickness}mm)`;
    } else if (entry) {
      const sp = entry.propSpacing;
      // Get prop name for this entry
      const propObj = entry.propId ? getProps().find(p => p.id === entry.propId) : null;
      const propName = propObj ? propObj.type : '—';
      const spText = sp ? `${sp.toFixed(2)}m` : '—';
      const detailSuffix = (propName !== '—' || sp) ? ` — ${propName} @ ${spText}` : '';

      if (entry.status === 'Fail') {
        barClass = 'slab-np';
        barText = `${lev.name} — Fail`;
      } else if (sp && sp < 1.2) {
        barClass = 'slab-warn';
        barText = `${lev.name}${detailSuffix}`;
      } else if (sp) {
        barClass = 'slab-ok';
        barText = `${lev.name}${detailSuffix}`;
      }
    }

    visHtml += `<div class="vis-level">
      <div class="vis-label">${esc(lev.name)}</div>
      <div class="vis-bar ${barClass}">${barText}</div>
    </div>`;

    // Prop lines between active back-prop levels
    if (entry && !isCurrent && entry.propSpacing) {
      const propCount = Math.min(12, Math.floor(3.0 / entry.propSpacing) + 2);
      visHtml += `<div class="vis-props">`;
      for (let p = 0; p < propCount; p++) visHtml += `<div class="vis-prop-line" style="height:${8+p%4*2}px"></div>`;
      visHtml += `</div>`;
    }
  });

  visHtml += `</div>`;

  // Summary — 9. Pass/Fail only, no governing prop spacing
  const statusCls = pour.isNP ? 'fail' : 'pass';
  const statusTxt = pour.isNP ? 'FAIL' : 'PASS';

  visHtml += `<div class="summary-panel">
    <div class="summary-panel-header">
      ${esc(pour.label)}
      <span class="pass-badge ${statusCls}">${statusTxt}</span>
    </div>
    <div class="summary-body">
      <div class="info-row"><span class="info-key">Wet thickness</span><span class="info-val">${pour.thickness} mm</span></div>
      <div class="info-row"><span class="info-key">Slab self-weight</span><span class="info-val">${pour.slabLoad.toFixed(2)} kPa</span></div>
      <div class="info-row"><span class="info-key">Total construction load</span><span class="info-val">${pour.totalLoad.toFixed(2)} kPa</span></div>
      <div class="info-row"><span class="info-key">Back-prop stack depth</span><span class="info-val">${pour.levels.length} level${pour.levels.length !== 1 ? 's' : ''}</span></div>
      ${pour.isNP ? `<div style="margin-top:10px;padding:10px;background:rgba(240,80,80,0.08);border:1px solid rgba(240,80,80,0.2);border-radius:6px;color:var(--np);font-size:11px">⚠ ${pour.failReason || 'Fail — review back-propping arrangement before proceeding.'}</div>` : ''}
    </div>
  </div>`;

  content.innerHTML = visHtml;
}
