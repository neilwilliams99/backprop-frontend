// ════════════════════════════════════════════════
//  CALCULATION ENGINE
// ════════════════════════════════════════════════
function runCalc() {
  const density = project.concDensity;
  const maxSp = project.maxSpacing;
  const results = [];

  // ── PRE-FLIGHT VALIDATION ────────────────────────────────────────────────
  const validPropIds = new Set(getProps().map(p => p.id));

  // Check 1: skip — prop library can be empty if zones have snapshots or overrides
  // (check 2 below catches any zones truly missing a prop)

  // Check 2: every active levelsBelow entry must have a usable prop
  // A prop is usable if: propCapOverride set, OR propId in library, OR propSnapshot exists
  const missingPropZones = [];
  levels.forEach(lev => {
    if (isBaseLevel(lev)) return;
    lev.zones.forEach(zone => {
      zone.levelsBelow.forEach(bl => {
        if (!bl.active) return;
        const hasOverride = bl.propCapOverride !== null && bl.propCapOverride !== undefined;
        const hasLibProp  = bl.propId && validPropIds.has(bl.propId);
        const hasSnapshot = bl.propSnapshot && bl.propSnapshot.capacity > 0;
        if (!hasOverride && !hasLibProp && !hasSnapshot) {
          missingPropZones.push(`${lev.name} · ${zone.name}`);
        }
      });
    });
  });

  if (missingPropZones.length > 0) {
    const unique = [...new Set(missingPropZones)];
    showToast(
      `Cannot calculate — no prop assigned in: ${unique.join(', ')}. Open each zone and select a prop for all active levels.`,
      'error'
    );
    return;
  }

  // Check 3: at least one level with zones must exist
  const levelsWithZones = levels.filter(l => !isBaseLevel(l) && l.zones.length > 0);
  if (levelsWithZones.length === 0) {
    showToast('Cannot calculate — no zones defined. Add zones to at least one level first.', 'error');
    return;
  }

  // Check 4: Load Sharing — validate % sums for all non-TG zones
  if (project.calcMethod === 'sharing') {
    const badZones = [];
    levels.forEach(lev => {
      if (isBaseLevel(lev)) return;
      lev.zones.forEach(zone => {
        const activeEntries = zone.levelsBelow.filter(b => b.active);
        const reachesGround = activeEntries.some(b => {
          const bl = levels.find(l => l.id === b.levelId);
          return bl && isBaseLevel(bl);
        });
        // T/G: lowest active entry is base level — skip % check
        const activeEnt = zone.levelsBelow.filter(b => b.active);
        const lowestIsGnd = activeEnt.length > 0 && isBaseLevel(levels.find(l => l.id === activeEnt[activeEnt.length-1].levelId));
        if (reachesGround && lowestIsGnd) return; // T/G — skip % check
        const nonGnd = activeEntries.filter(b => {
          const bl = levels.find(l => l.id === b.levelId);
          return bl && !isBaseLevel(bl);
        });
        const pctSum = nonGnd.reduce((s, b) => s + (b.distPct ?? 0), 0);
        if (Math.abs(pctSum - 100) > 0.5) {
          badZones.push(`${lev.name} · ${zone.name} (${pctSum.toFixed(0)}%)`);
        }
      });
    });
    if (badZones.length > 0) {
      showToast(`Cannot calculate — distribution % must sum to 100% in: ${badZones.join(', ')}. Open each zone and correct the values.`, 'error');
      return;
    }
  }
  // ── END PRE-FLIGHT ───────────────────────────────────────────────────────

  // For each level (non-ground), for each zone
  levels.forEach((lev, li) => {
    if (isBaseLevel(lev)) return; // skip base level
    if (lev.zones.length === 0) return;

    lev.zones.forEach(zone => {
      const thickM = zone.thickness / 1000;
      const slabLoad = thickM * density;
      const addLoad = zone.addLoad ?? lev.addLoad ?? 3.0;
      const totalWetLoad = slabLoad + addLoad;

      const pourResult = {
        levelId: lev.id,
        zoneId: zone.id,
        levelName: lev.name,
        zoneName: zone.name,
        label: `${lev.name} · ${zone.name}`,
        thickness: zone.thickness,
        slabLoad,
        totalLoad: totalWetLoad,
        levels: [],
        maxSpacingAchieved: null,
        isNP: false,
        isTG: false,
      };

      // ── BACK-PROPPING LOGIC ──────────────────────────────────────────────
      //
      // Two distinct cases:
      //
      // CASE A — Props resolve to GROUND (T/G):
      //   The full wet load is carried by props all the way down to the ground
      //   slab. Intermediate slabs do NOT absorb any load — they simply transfer
      //   the full wet load downward. Every back-propped level in the stack must
      //   have props sized for the FULL wet load.
      //
      // CASE B — Props do NOT reach ground:
      //   Each active slab absorbs its stated capacity, reducing the cumulative
      //   load. If all load is absorbed before the bottom of the stack → OK.
      //   If there is any remainder after the last active level → FAIL (N/P).
      //   No prop spacing result is possible — user must add more load-bearing
      //   levels or increase slab capacity.
      //
      // ─────────────────────────────────────────────────────────────────────

      const activeBelowEntries = zone.levelsBelow.filter(b => b.active);
      const useSharing = (project.calcMethod === 'sharing');

      if (activeBelowEntries.length === 0) {
        pourResult.isNP = true;
        pourResult.failReason = 'No load-bearing levels selected.';
      } else if (useSharing) {
        // ── CASE C: LOAD SHARING ─────────────────────────────────────────
        // Each slab attracts its nominated % of the running load+addLoad.
        // Props at each level are sized for the load passed DOWN.
        // All slab capacity checks must pass before any spacings are shown.

        const reachesGround = activeBelowEntries.some(b => {
          const bl = levels.find(l => l.id === b.levelId);
          return bl && isBaseLevel(bl);
        });

        if (reachesGround) {
          pourResult.isTG = true;
          // T/G in load sharing: distribution boxes are 0%, all load to ground
          // Props at every level carry the full running load
          activeBelowEntries.forEach(bl => {
            const blev = levels.find(l => l.id === bl.levelId);
            if (!blev) return;
            const isGndLevel = isBaseLevel(blev);
            const propCapKN = bl.propCapOverride !== null ? bl.propCapOverride : getPropCap(bl.propId, bl.propSnapshot);
            if (!propCapKN) { pourResult.isNP = true; pourResult.failReason = `No prop capacity set at ${blev.name}.`; return; }
            const propSpacing = Math.sqrt(propCapKN / totalWetLoad);
            const cappedSpacing = Math.min(propSpacing, maxSp);
            const status = cappedSpacing > 0 ? cappedSpacing.toFixed(2) + 'm' : 'Fail';
            if (status === 'Fail') pourResult.isNP = true;
            pourResult.levels.push({
              name: blev.name, isGround: isGndLevel,
              cumulativeLoad: totalWetLoad,
              capacity: isGndLevel ? null : bl.slabCap,
              distPct: 0, slabShare: 0,
              propCap: propCapKN,
              netLoad: isGndLevel ? 0 : totalWetLoad,
              status, propSpacing: cappedSpacing > 0 ? cappedSpacing : null,
              propId: bl.propId,
            });
          });
        } else {
          // Validate % sum = 100 for non-ground entries
          const nonGndEntries = activeBelowEntries.filter(b => {
            const bl = levels.find(l => l.id === b.levelId);
            return bl && !isBaseLevel(bl);
          });
          const pctSum = nonGndEntries.reduce((s, b) => s + (b.distPct ?? 0), 0);
          if (Math.abs(pctSum - 100) > 0.5) {
            pourResult.isNP = true;
            pourResult.failReason = `Load sharing % must sum to 100% (currently ${pctSum.toFixed(0)}%). Edit zone distribution values.`;
          } else {
            // Pass 1: check all slab capacities
            let runLoad = totalWetLoad;
            const levelChecks = [];
            let allPass = true;

            activeBelowEntries.forEach(bl => {
              const blev = levels.find(l => l.id === bl.levelId);
              if (!blev) return;
              const levelAddLoad = bl.addLoad ?? 0;
              const totalAtLevel = runLoad + levelAddLoad;
              const pct = (bl.distPct ?? 0) / 100;
              const slabShare = totalAtLevel * pct;
              const capPass = isBaseLevel(blev) || bl.slabCap >= slabShare;
              if (!capPass) allPass = false;
              levelChecks.push({ bl, blev, totalAtLevel, slabShare, pct, capPass, runLoadIn: runLoad });
              runLoad = totalAtLevel - slabShare;
            });

            // Pass 2: if all slabs pass, calc prop spacings; otherwise all fail
            levelChecks.forEach(({ bl, blev, totalAtLevel, slabShare, pct, capPass, runLoadIn }) => {
              const isGndLevel = isBaseLevel(blev);
              const propCapKN = bl.propCapOverride !== null ? bl.propCapOverride : getPropCap(bl.propId, bl.propSnapshot);
              if (!propCapKN) { pourResult.isNP = true; pourResult.failReason = `No prop capacity set at ${blev.name}.`; return; }

              let propSpacing = null;
              let status = '';

              if (!allPass) {
                // Any slab failed — no spacings
                status = capPass ? 'Cap OK' : 'Fail';
                propSpacing = null;
                if (!capPass) pourResult.isNP = true;
              } else {
                // All caps pass — prop spacing = sqrt(propCap / cumulativeLoad at this level)
                // cumulativeLoad = totalAtLevel = runLoad arriving + addLoad at this level
                if (totalAtLevel > 0.001) {
                  const rawSpacing = Math.sqrt(propCapKN / totalAtLevel);
                  propSpacing = Math.min(rawSpacing, maxSp);
                  status = propSpacing > 0 ? propSpacing.toFixed(2) + 'm' : 'Fail';
                  if (propSpacing <= 0) pourResult.isNP = true;
                } else {
                  status = 'no load';
                }
              }

              pourResult.levels.push({
                name: blev.name, isGround: isGndLevel,
                cumulativeLoad: runLoadIn,
                capacity: isGndLevel ? null : bl.slabCap,
                distPct: Math.round((pct * 100) * 100) / 100,
                slabShare: Math.round(slabShare * 100) / 100,
                propCap: propCapKN,
                netLoad: Math.max(0, totalAtLevel - slabShare),
                status, propSpacing,
                propId: bl.propId,
              });
            });

            pourResult.isTG = false;
          }
        }
      } else {
        // Determine if stack reaches ground
        const reachesGround = activeBelowEntries.some(b => {
          const bl = levels.find(l => l.id === b.levelId);
          return bl && isBaseLevel(bl);
        });

        if (reachesGround) {
          // ── CASE A: T/G ─────────────────────────────────────────────────
          // Every level in the stack (including intermediates) props the FULL
          // wet load. Ground slab is recorded as T/G with no prop spacing.
          pourResult.isTG = true;

          activeBelowEntries.forEach(bl => {
            const blev = levels.find(l => l.id === bl.levelId);
            if (!blev) return;
            const isGndLevel = isBaseLevel(blev);

            const propCapKN = bl.propCapOverride !== null ? bl.propCapOverride : getPropCap(bl.propId, bl.propSnapshot);
            if (!propCapKN) { pourResult.isNP = true; pourResult.failReason = `No prop capacity set at ${blev.name}. Assign a prop in zone settings.`; return; }
            const propSpacing = Math.sqrt(propCapKN / totalWetLoad);
            const cappedSpacing = Math.min(propSpacing, maxSp);
            const status = cappedSpacing > 0 ? cappedSpacing.toFixed(2) + 'm' : 'Fail';
            if (status === 'Fail') pourResult.isNP = true;

            pourResult.levels.push({
              name: blev.name,
              isGround: isGndLevel,
              cumulativeLoad: totalWetLoad,
              capacity: isGndLevel ? null : bl.slabCap,
              propCap: propCapKN,
              netLoad: isGndLevel ? 0 : totalWetLoad,
              status,
              propSpacing: cappedSpacing > 0 ? cappedSpacing : null,
              propId: bl.propId,
            });
          });

        } else {
          // ── CASE B: Distributed across load-bearing slabs ────────────────
          let cumLoad = totalWetLoad;

          activeBelowEntries.forEach(bl => {
            const blev = levels.find(l => l.id === bl.levelId);
            if (!blev) return;

            const propCapKN = bl.propCapOverride !== null ? bl.propCapOverride : getPropCap(bl.propId, bl.propSnapshot);
            if (!propCapKN) { pourResult.isNP = true; pourResult.failReason = `No prop capacity set at ${blev.name}. Assign a prop in zone settings.`; return; }
            let propSpacing = null;
            let status = '';

            if (cumLoad > 0) {
              const rawSpacing = Math.sqrt(propCapKN / cumLoad);
              propSpacing = Math.min(rawSpacing, maxSp);
              status = propSpacing > 0 ? propSpacing.toFixed(2) + 'm' : 'Fail';
              if (propSpacing <= 0) pourResult.isNP = true;
            } else {
              status = 'no load';
              propSpacing = null;
            }

            const effCap = bl.slabCap * (bl.sm ?? 1.0);
            pourResult.levels.push({
              name: blev.name,
              isGround: false,
              cumulativeLoad: cumLoad,
              capacity: bl.slabCap,
              sm: bl.sm ?? 1.0,
              effectiveCapacity: effCap,
              propCap: propCapKN,
              netLoad: Math.max(0, cumLoad - effCap),
              status,
              propSpacing,
              propId: bl.propId,
            });

            const effectiveCap = bl.slabCap * (bl.sm ?? 1.0);
            cumLoad = Math.max(0, cumLoad - effectiveCap);
          });

          if (cumLoad > 0.01) {
            pourResult.isNP = true;
            pourResult.isTG = false;
            pourResult.failReason = `Load not fully resolved — ${cumLoad.toFixed(2)} kPa remaining after the last load-bearing level. Add more load-bearing levels or increase slab capacity.`;
            pourResult.levels.forEach(l => {
              l.status = 'Fail';
              l.propSpacing = null;
            });
          } else {
            pourResult.isTG = false;
          }
        }
      }

      const spacings = pourResult.levels
        .filter(l => l.propSpacing !== null && l.propSpacing > 0)
        .map(l => l.propSpacing);
      pourResult.maxSpacingAchieved = (!pourResult.isNP && spacings.length > 0) ? Math.min(...spacings) : null;
      pourResult.isNP = pourResult.isNP || pourResult.levels.some(l => l.status === 'Fail');

      results.push(pourResult);
    });
  });

  calcResults = results;
  renderEngineerView();
  renderBuilderView();
  showToast(`Calculation complete — ${results.length} pour scenario${results.length !== 1 ? 's' : ''} · saved`, 'success');
  updateSummary();
  updateCalcBtn();
  // Save results to database
  const activeP = projectStore.find(x => x.id === activeProjectId);
  if (activeP) { saveActiveProject(); dbSaveProject(activeP); }
}
