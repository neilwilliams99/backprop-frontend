// ════════════════════════════════════════════════
//  PROP LIBRARY
// ════════════════════════════════════════════════
// function renderProps() removed - props now in project settings modal

// function focusPropForm() removed - props now in project settings modal

function renderModalPropTable() {
  const container = document.getElementById('projModalPropTable');
  if (!container) return;
  const propList = getProps();
  if (propList.length === 0) {
    container.innerHTML = '<div style="font-size:11px;color:var(--text-muted);font-family:\'DM Mono\',monospace;padding:4px 0 8px">No props yet — add one below.</div>';
    return;
  }
  let html = '<div style="border:1px solid var(--border);border-radius:6px;overflow:hidden;margin-bottom:8px">';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr 70px 50px 40px;background:var(--surface3);padding:6px 10px;font-size:10px;font-weight:700;letter-spacing:0.5px;color:var(--text-muted);font-family:\'Syne\',sans-serif">';
  html += '<div>TYPE</div><div>EXTENSION</div><div style="text-align:center">kN</div><div></div><div></div></div>';
  propList.forEach((p, i) => {
    html += `<div style="display:grid;grid-template-columns:1fr 1fr 70px 50px 40px;padding:7px 10px;font-size:11px;font-family:'DM Mono',monospace;border-top:1px solid var(--border);align-items:center">`;
    html += `<div style="font-weight:500">${esc(p.type)}</div>`;
    html += `<div style="color:var(--text-muted)">${esc(p.extension||'—')}</div>`;
    html += `<div style="text-align:center">${p.capacity}</div>`;
    html += `<div style="text-align:center"><button onclick="showModalPropForm(${i})" style="background:none;border:none;color:var(--accent2);cursor:pointer;font-size:11px;font-family:'DM Mono',monospace;padding:0">Edit</button></div>`;
    html += `<div style="text-align:center"><button onclick="removeProp(${i})" style="background:none;border:none;color:var(--np);cursor:pointer;font-size:16px;line-height:1;padding:0">×</button></div>`;
    html += '</div>';
  });
  html += '</div>';
  container.innerHTML = html;
}

function showModalPropForm(editIdx) {
  const form = document.getElementById('projModalPropForm');
  form.style.display = 'block';
  clearModalPropForm();
  document.getElementById('projModalPropForm').style.display = 'block';
  if (editIdx !== undefined) {
    const p = getProps()[editIdx];
    document.getElementById('modalPropEditId').value = p.id;
    document.getElementById('modalPropType').value = p.type;
    document.getElementById('modalPropExtension').value = p.extension || '';
    document.getElementById('modalPropCapacity').value = p.capacity;
    document.getElementById('modalPropNotes').value = p.notes || '';
    document.getElementById('modalPropFormTitle').textContent = 'Edit Prop';
  }
  document.getElementById('modalPropType').focus();
}

function clearModalPropForm() {
  document.getElementById('modalPropEditId').value = '';
  document.getElementById('modalPropType').value = '';
  document.getElementById('modalPropExtension').value = '';
  document.getElementById('modalPropCapacity').value = '';
  document.getElementById('modalPropNotes').value = '';
  document.getElementById('modalPropFormTitle').textContent = 'Add Prop';
  document.getElementById('projModalPropForm').style.display = 'none';
}

function saveModalProp() {
  const type  = document.getElementById('modalPropType').value.trim();
  const ext   = document.getElementById('modalPropExtension').value.trim();
  const cap   = parseFloat(document.getElementById('modalPropCapacity').value);
  const notes = document.getElementById('modalPropNotes').value.trim();
  const editId = document.getElementById('modalPropEditId').value;

  if (!type) { showToast('Enter a prop type', 'error'); return; }
  if (isNaN(cap) || cap <= 0) { showToast('Enter a valid capacity', 'error'); return; }

  if (editId) {
    const idx = getProps().findIndex(p => p.id === editId);
    if (idx >= 0) {
      getProps()[idx] = { ...getProps()[idx], type, extension: ext, capacity: cap, notes };
      showToast('Prop updated', 'success');
    }
  } else {
    const newProp = { id: 'p_' + uid(), type, extension: ext, capacity: cap, notes, isDefault: getProps().length === 0 };
    getProps().push(newProp);
    showToast('Prop added', 'success');
  }
  clearModalPropForm();
  renderModalPropTable();
  reconcilePropIds();
  markDirty();
  // Refresh zone dropdowns if zones page is currently open
  if (currentZoneLevelId) {
    const lev = levels.find(l => l.id === currentZoneLevelId);
    if (lev) renderZones(lev);
  }
}

// function editProp(i) removed - props now in project settings modal

function removeProp(i) {
  getProps().splice(i, 1);
  reconcilePropIds();
  renderModalPropTable();
  showToast('Prop removed', 'info');
  if (currentZoneLevelId) {
    const lev = levels.find(l => l.id === currentZoneLevelId);
    if (lev) renderZones(lev);
  }
}

// function clearPropForm() removed - props now in project settings modal

function togglePropDefault(i) {
  getProps().forEach((p, j) => p.isDefault = (j === i && !p.isDefault));
  renderProps();
}

function saveProp() { saveModalProp(); } // delegates to modal version
