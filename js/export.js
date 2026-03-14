// ════════════════════════════════════════════════
//  EXPORT
// ════════════════════════════════════════════════
async function exportResults() {
  if (!calcResults || calcResults.length === 0) {
    showToast('Run calculation first', 'error'); return;
  }
  // Block export on trial
  const accessInfo = currentUser ? await checkAccess(currentUser) : null;
  if (accessInfo && accessInfo.reason === 'trial') {
    await dlgAlert(
      'Export Not Available on Trial',
      'Exporting results requires a paid subscription. Subscribe to unlock full export functionality.',
      'Subscribe Now'
    );
    showPaywall('trial_limit');
    return;
  }
  const wb = XLSX.utils.book_new();

  // ── Helper: build a matrix sheet ──────────────────────────────────────────
  function makeMatrixSheet(title, cellFn) {
    // Collect all unique pour/zone labels and level names
    const pourLabels = calcResults.map(r => r.label);
    const levelNames = [];
    [...levels].reverse().forEach(lev => { if (!levelNames.includes(lev.name)) levelNames.push(lev.name); });

    const header = ['LEVEL', ...pourLabels];
    const rows = [['', title], header];

    levelNames.forEach(lvlName => {
      const row = [lvlName];
      calcResults.forEach(r => {
        const isWet = r.levelName === lvlName;
        const isGround = lvlName === levels[0].name;
        const entry = r.levels ? r.levels.find(l => l.name === lvlName) : null;
        row.push(cellFn(r, lvlName, entry, isWet, isGround));
      });
      rows.push(row);
    });
    return XLSX.utils.aoa_to_sheet(rows);
  }

  // ── 1. Prop Spacing ────────────────────────────────────────────────────────
  XLSX.utils.book_append_sheet(wb, makeMatrixSheet('Prop Spacing (m c/c)', (r, lvl, entry, isWet, isGround) => {
    if (isWet) return 'WET';
    if (isGround) return '∞';
    if (!entry) return '';
    if (entry.propSpacing === null || entry.propSpacing === undefined) return entry.isTG ? 'TG' : '';
    return parseFloat(entry.propSpacing.toFixed(2));
  }), 'PROP SPACING');

  // ── 2. Prop Type ───────────────────────────────────────────────────────────
  XLSX.utils.book_append_sheet(wb, makeMatrixSheet('Prop Type', (r, lvl, entry, isWet, isGround) => {
    if (isWet) return 'WET';
    if (isGround) return entry ? (entry.propType || '') : '';
    if (!entry) return '';
    return entry.propType || '';
  }), 'PROP TYPE');

  // ── 3. Cumulative Load ─────────────────────────────────────────────────────
  XLSX.utils.book_append_sheet(wb, makeMatrixSheet('Cumulative Load (kPa)', (r, lvl, entry, isWet, isGround) => {
    if (isWet) return 'WET';
    if (isGround) return entry ? parseFloat((entry.cumulativeLoad||0).toFixed(2)) : '';
    if (!entry) return '';
    return parseFloat((entry.cumulativeLoad||0).toFixed(2));
  }), 'CUMULATIVE LOAD');

  // ── 4. Slab Capacity ───────────────────────────────────────────────────────
  XLSX.utils.book_append_sheet(wb, makeMatrixSheet('Slab Capacity (kPa)', (r, lvl, entry, isWet, isGround) => {
    if (isWet) return 'WET';
    if (isGround) return '∞';
    if (!entry) return '';
    return parseFloat((entry.capacity||0).toFixed(2));
  }), 'SLAB CAPACITY');

  // ── 5. Slab Stiffness Modifier / Distribution % ───────────────────────────
  const isSharing5x = (project.calcMethod === 'sharing');
  XLSX.utils.book_append_sheet(wb, makeMatrixSheet(isSharing5x ? 'Load Distribution %' : 'Slab Stiffness Modifier', (r, lvl, entry, isWet, isGround) => {
    if (isWet) return 'WET';
    if (isGround) return '∞';
    if (!entry) return '';
    if (isSharing5x) return (entry.distPct ?? 0).toFixed(0) + '%';
    return parseFloat((entry.sm || 1.0).toFixed(2));
  }), isSharing5x ? 'DIST PERCENT' : 'STIFFNESS MODIFIER');

  // ── 6. Additional Load ─────────────────────────────────────────────────────
  XLSX.utils.book_append_sheet(wb, makeMatrixSheet('Additional Load (kPa)', (r, lvl, entry, isWet, isGround) => {
    if (isWet) return 'WET';
    if (isGround) return '';
    if (!entry) return '';
    const bl = r.backpropLevels ? r.backpropLevels.find(b => b.name === lvl) : null;
    return bl ? parseFloat((bl.addLoad||0).toFixed(2)) : '';
  }), 'ADDITIONAL LOAD');

  // ── 7. Pour Scenario Summary ───────────────────────────────────────────────
  const summaryData = [['Zone', 'Pour Level', 'Thickness mm', 'Slab Load kPa', 'Total Load kPa', 'Back-prop Levels', 'Governing Spacing', 'Result']];
  calcResults.forEach(r => {
    summaryData.push([
      r.label, r.levelName, r.thickness,
      parseFloat(r.slabLoad.toFixed(2)),
      parseFloat(r.totalLoad.toFixed(2)),
      r.levels ? r.levels.filter(l => l.propSpacing).length : 0,
      r.maxSpacingAchieved ? parseFloat(r.maxSpacingAchieved.toFixed(2)) : (r.isNP ? 'FAIL' : 'To Ground'),
      r.isNP ? 'FAIL' : 'PASS',
    ]);
  });
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summaryData), 'SUMMARY');

  // ── 8. Prop Library ────────────────────────────────────────────────────────
  const propData = [['Type', 'Extension', 'Capacity kN', 'Notes', 'Default']];
  getProps().forEach(p => propData.push([p.type, p.extension, p.capacity, p.notes, p.isDefault?'YES':'NO']));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(propData), 'PROP LIBRARY');

  const filename = (project.jobNo || 'backprop') + '_backpropping.xlsx';
  XLSX.writeFile(wb, filename);
  showToast('Exported to XLSX', 'success');
}
