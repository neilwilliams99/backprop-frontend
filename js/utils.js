// ════════════════════════════════════════════════
//  UTILITIES
// ════════════════════════════════════════════════
function esc(s) {
  return String(s || '')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function showToast(msg, type = 'success', duration = 5000) {
  const container = document.getElementById('toastContainer');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.textContent = msg;
  container.appendChild(t);
  // Animate in
  requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('show')));
  // Animate out then remove
  setTimeout(() => {
    t.classList.remove('show');
    t.classList.add('hiding');
    setTimeout(() => t.remove(), 300);
  }, duration);
}
