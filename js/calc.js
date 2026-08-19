// ════════════════════════════════════════════════
//  LOAD SHARING ENGINE
// ════════════════════════════════════════════════
//
// Cascade model for load sharing across back-propped levels.
//
// Core formula:
//   wet_share     = wetTotal × (distPct / 100)
//   slab_load     = wet_share + addLoad   (slab design load)
//   prop_load_in  = load arriving from above (design load for prop spacing)
//   prop_load_out = prop_load_in − wet_share          (not-propped-to-ground)
//                 = prop_load_in + addLoad             (propped-to-ground, wet_share = 0)
//
// Not Propped to Ground:
//   distPct is user-defined per level (must sum to 100 %).  Each slab absorbs
//   its wet_share, reducing the cascade.  addLoad is local to the slab design
//   check and does not accumulate in the cascade.
//
// Propped to Ground:
//   distPct forced to 0, so wet_share = 0.  The slab absorbs nothing; addLoad
//   at each level flows directly into the props and accumulates in the cascade.
//
// @param {number}  wetTotal          – wet slab total: slabLoad + addLoad (kPa)
// @param {Array}   supportingLevels  – top-to-bottom; each entry: { addLoad, distPct }
// @param {boolean} proppedToGround
// @returns {Array} one object per supporting level:
//   { prop_load_in, wet_share, slab_load, prop_load_out }
//
function computeLoadSharing(wetTotal, supportingLevels, proppedToGround) {
  const results = [];
  let prop_load_in = wetTotal;

  supportingLevels.forEach(level => {
    const add_load  = level.addLoad ?? 0;
    const dist_pct  = proppedToGround ? 0 : (level.distPct ?? 0);
    const wet_share = wetTotal * (dist_pct / 100);
    const slab_load = wet_share + add_load;

    const prop_load_out = proppedToGround
      ? prop_load_in + add_load          // add_load accumulates; nothing absorbed by slab
      : prop_load_in - wet_share;        // slab absorbs wet_share; add_load stays local

    results.push({ prop_load_in, wet_share, slab_load, prop_load_out });

    prop_load_in = prop_load_out;
  });

  return results;
}

// ════════════════════════════════════════════════
//  CALCULATION ENGINE
// ════════════════════════════════════════════════
function runCalc(opts = {}) {
  const silent = opts.silent === true;
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
    if (!silent) showToast(
      `Cannot calculate — no prop assigned in: ${unique.join(', ')}. Open each zone and select a prop for all active levels.`,
      'error'
    );
    return;
  }

  // Check 3: at least one level with zones must exist
  const levelsWithZones = levels.filter(l => !isBaseLevel(l) && l.zones.length > 0);
  if (levelsWithZones.length === 0) {
    if (!silent) showToast('Cannot calculate — no zones defined. Add zones to at least one level first.', 'error');
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
      if (!silent) showToast(`Cannot calculate — distribution % must sum to 100% in: ${badZones.join(', ')}. Open each zone and correct the values.`, 'error');
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
        // Uses computeLoadSharing() for both T/G and non-T/G paths.
        //
        // Not Propped to Ground: each slab absorbs its nominated % of the
        //   wet slab total.  All slab capacity checks must pass before prop
        //   spacings are shown.
        //
        // Propped to Ground (T/G): distribution_pct forced to 0 everywhere;
        //   the full wet load accumulates level-by-level down to the ground.

        const reachesGround = activeBelowEntries.some(b => {
          const bl = levels.find(l => l.id === b.levelId);
          return bl && isBaseLevel(bl);
        });
        pourResult.isTG = reachesGround;

        if (!reachesGround) {
          // Guard: % sum must equal 100 (pre-flight already checked globally;
          // this is a per-zone safety net).
          const pctSum = activeBelowEntries.reduce((s, b) => s + (b.distPct ?? 0), 0);
          if (Math.abs(pctSum - 100) > 0.5) {
            pourResult.isNP = true;
            pourResult.failReason = `Load sharing % must sum to 100% (currently ${pctSum.toFixed(0)}%). Edit zone distribution values.`;
          }
        }

        if (!pourResult.isNP) {
          // ── Run the cascade engine ──────────────────────────────────────
          const supportInputs = activeBelowEntries.map(bl => ({
            addLoad: bl.addLoad ?? 0,
            distPct: bl.distPct ?? 0,
          }));
          const sharingCalc = computeLoadSharing(totalWetLoad, supportInputs, reachesGround);

          // Pass 1 (non-TG only): check every slab can carry its slab_load.
          // If any slab fails, all spacings are suppressed.
          let allCapsPass = true;
          if (!reachesGround) {
            activeBelowEntries.forEach((bl, i) => {
              const calc = sharingCalc[i];
              const blev = levels.find(l => l.id === bl.levelId);
              if (!blev || isBaseLevel(blev)) return;
              if ((bl.slabCap ?? 0) < calc.slab_load) allCapsPass = false;
            });
          }

          // Pass 2: build per-level output; prop spacing uses prop_load_in
          activeBelowEntries.forEach((bl, i) => {
            const calc  = sharingCalc[i];
            const blev  = levels.find(l => l.id === bl.levelId);
            if (!blev) return;
            const isGndLevel = isBaseLevel(blev);

            const propCapKN = bl.propCapOverride !== null
              ? bl.propCapOverride
              : getPropCap(bl.propId, bl.propSnapshot);
            if (!propCapKN) {
              pourResult.isNP = true;
              pourResult.failReason = `No prop capacity set at ${blev.name}.`;
              return;
            }

            let propSpacing = null;
            let status      = '';

            if (isGndLevel) {
              // Ground slab: terminal anchor — no prop sizing needed
              status = 'T/G';
            } else if (!reachesGround && !allCapsPass) {
              // At least one slab failed — show cap pass/fail, no spacings
              const capPass = (bl.slabCap ?? 0) >= calc.slab_load;
              status = capPass ? 'Cap OK' : 'Fail';
              if (!capPass) pourResult.isNP = true;
            } else {
              // Size props for prop_load_in: load arriving at this level from above
              if (calc.prop_load_in > 0.001) {
                const rawSpacing = Math.sqrt(propCapKN / calc.prop_load_in);
                propSpacing = Math.min(rawSpacing, maxSp);
                status = propSpacing > 0 ? propSpacing.toFixed(2) + 'm' : 'Fail';
                if (propSpacing <= 0) pourResult.isNP = true;
              } else {
                status = 'no load';
              }
            }

            pourResult.levels.push({
              name:     blev.name,
              isGround: isGndLevel,

              // ── Cascade columns ────────────────────────────────────────
              cumulativeLoad: calc.prop_load_in,   // load arriving at this level (for display)
              wetShare:       calc.wet_share,
              slabShare:      Math.round(calc.slab_load * 100) / 100,
              propLoad:       calc.prop_load_in,

              // ── Fields used by rendering code ─────────────────────────
              capacity:  isGndLevel ? null : (bl.slabCap ?? null),
              distPct:   reachesGround ? 0 : (bl.distPct ?? 0),
              propCap:   propCapKN,
              netLoad:   isGndLevel ? 0 : Math.max(0, calc.prop_load_in),
              status,
              propSpacing,
              propId: bl.propId,
            });
          });
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
          //
          // A level's additional load is applied AT that level: it is added to the
          // load arriving from above, and the props bearing on that level are
          // sized for the sum. Nothing is absorbed on the way down.
          pourResult.isTG = true;

          let carryLoad = totalWetLoad;

          activeBelowEntries.forEach(bl => {
            const blev = levels.find(l => l.id === bl.levelId);
            if (!blev) return;
            const isGndLevel = isBaseLevel(blev);

            const propCapKN = bl.propCapOverride !== null ? bl.propCapOverride : getPropCap(bl.propId, bl.propSnapshot);
            if (!propCapKN) { pourResult.isNP = true; pourResult.failReason = `No prop capacity set at ${blev.name}. Assign a prop in zone settings.`; return; }

            const cumLoad = carryLoad + (bl.addLoad ?? 0);
            const propSpacing = Math.sqrt(propCapKN / cumLoad);
            const cappedSpacing = Math.min(propSpacing, maxSp);
            const status = cappedSpacing > 0 ? cappedSpacing.toFixed(2) + 'm' : 'Fail';
            if (status === 'Fail') pourResult.isNP = true;

            pourResult.levels.push({
              name: blev.name,
              isGround: isGndLevel,
              cumulativeLoad: cumLoad,
              capacity: isGndLevel ? null : bl.slabCap,
              propCap: propCapKN,
              netLoad: isGndLevel ? 0 : cumLoad,
              status,
              propSpacing: cappedSpacing > 0 ? cappedSpacing : null,
              propId: bl.propId,
            });

            carryLoad = cumLoad;
          });

        } else {
          // ── CASE B: Distributed across load-bearing slabs ────────────────
          //
          // A level's additional load is applied AT that level: it is added to the
          // load arriving from above, and the props bearing on that level are
          // sized for the sum. The slab's effective capacity is then absorbed
          // and whatever remains carries on down the stack.
          let carryLoad = totalWetLoad;

          activeBelowEntries.forEach(bl => {
            const blev = levels.find(l => l.id === bl.levelId);
            if (!blev) return;

            const propCapKN = bl.propCapOverride !== null ? bl.propCapOverride : getPropCap(bl.propId, bl.propSnapshot);
            if (!propCapKN) { pourResult.isNP = true; pourResult.failReason = `No prop capacity set at ${blev.name}. Assign a prop in zone settings.`; return; }

            const cumLoad = carryLoad + (bl.addLoad ?? 0);
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

            const effCap    = bl.slabCap * (bl.sm ?? 1.0);
            const carryDown = Math.max(0, cumLoad - effCap);

            pourResult.levels.push({
              name: blev.name,
              isGround: false,
              cumulativeLoad: cumLoad,
              capacity: bl.slabCap,
              sm: bl.sm ?? 1.0,
              effectiveCapacity: effCap,
              propCap: propCapKN,
              netLoad: carryDown,
              status,
              propSpacing,
              propId: bl.propId,
            });

            carryLoad = carryDown;
          });

          if (carryLoad > 0.01) {
            pourResult.isNP = true;
            pourResult.isTG = false;
            pourResult.failReason = `Load not fully resolved — ${carryLoad.toFixed(2)} kPa remaining after the last load-bearing level. Add more load-bearing levels or increase slab capacity.`;
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
  if (!silent) {
    showToast(`Calculation complete — ${results.length} pour scenario${results.length !== 1 ? 's' : ''} · saved`, 'success');
  }
  updateSummary();
  updateCalcBtn();
  // Save results to database (skip on silent auto-recalc at project open)
  if (!silent) {
    const activeP = projectStore.find(x => x.id === activeProjectId);
    if (activeP) { saveActiveProject(); dbSaveProject(activeP); }
  }
}
