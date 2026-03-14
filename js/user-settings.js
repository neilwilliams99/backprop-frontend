// ════════════════════════════════════════════════
//  USER SETTINGS
// ════════════════════════════════════════════════
async function openUserSettings() {
  const meta = currentUser?.user_metadata || {};
  document.getElementById('settingsFirstName').value = meta.first_name || '';
  document.getElementById('settingsLastName').value  = meta.last_name  || '';
  document.getElementById('settingsEmail').value     = currentUser?.email || '';

  // Load subscription status — use checkAccess which handles trial logic
  const statusEl = document.getElementById('settingsSubStatus');
  statusEl.textContent = 'Checking…';
  statusEl.style.color = 'var(--text-muted)';

  // First show trial status immediately (no API needed)
  const trialDaysLeft = getTrialDaysLeft(currentUser);
  const trialEndDate  = new Date(new Date(currentUser.created_at).getTime() + 7*24*60*60*1000);
  const trialEndStr   = trialEndDate.toLocaleDateString('en-AU', { day:'numeric', month:'long', year:'numeric' });

  if (trialDaysLeft > 0) {
    statusEl.innerHTML = `<span style="color:var(--accent)">Free trial</span> <span style="color:var(--text-muted);font-size:10px">— ${Math.ceil(trialDaysLeft)} day${Math.ceil(trialDaysLeft) !== 1 ? 's' : ''} remaining, ends ${trialEndStr}</span>`;
    document.getElementById('subscribeBtn').style.display = 'block';
    document.getElementById('manageSubBtn').style.display = 'none';
  }

  // Then try API for paid subscription details
  try {
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 8000);
    const res  = await fetch(`${API_URL}/subscription-status?user_id=${currentUser.id}`, { signal: controller.signal });
    const data = await res.json();
    if (data.access && data.reason === 'subscribed') {
      document.getElementById('subscribeBtn').style.display = 'none';
      if (data.cancel_at_period_end) {
        statusEl.innerHTML = `<span style="color:var(--accent)">⚠ Cancelled</span> <span style="color:var(--text-muted);font-size:10px">— access until ${data.renewal_date || 'end of period'}</span>`;
        document.getElementById('manageSubBtn').style.display = 'block';
      } else {
        statusEl.innerHTML = `<span style="color:var(--tg)">✓ Active</span> <span style="color:var(--text-muted);font-size:10px">— renews ${data.renewal_date || 'next billing date'}</span>`;
        document.getElementById('manageSubBtn').style.display = 'block';
      }
    } else if (trialDaysLeft <= 0) {
      document.getElementById('subscribeBtn').style.display = 'block';
      document.getElementById('manageSubBtn').style.display = 'none';
      statusEl.innerHTML = `<span style="color:var(--np)">Trial expired</span> <span style="color:var(--text-muted);font-size:10px">— subscribe to continue</span>`;
    }
    // else: trial status already shown above
  } catch(e) {
    // API unavailable — trial status already shown, leave it
    if (trialDaysLeft <= 0) {
      statusEl.innerHTML = `<span style="color:var(--text-muted)">Status unavailable</span>`;
    }
  }

  document.getElementById('userSettingsModal').classList.add('open');
}

async function manageSubscription() {
  // Redirect to Stripe customer portal
  const btn = event.target;
  btn.textContent = 'Opening Stripe…';
  btn.disabled = true;
  try {
    const res  = await fetch(`${API_URL}/create-portal-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: currentUser.id }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      throw new Error('No portal URL');
    }
  } catch(e) {
    showToast('Could not open Stripe portal — please try again', 'error');
  } finally {
    btn.textContent = 'Manage Subscription via Stripe';
    btn.disabled = false;
  }
}

async function saveUserSettings() {
  const firstName = document.getElementById('settingsFirstName').value.trim();
  const lastName  = document.getElementById('settingsLastName').value.trim();
  const { data, error } = await supa.auth.updateUser({
    data: { first_name: firstName, last_name: lastName }
  });
  if (error) { showToast('Error saving settings', 'error'); return; }
  currentUser = data.user;
  updateDashWelcome();
  document.getElementById('userSettingsModal').classList.remove('open');
  showToast('Settings saved', 'success');
}

function updateDashWelcome() {
  if (!currentUser) return;
  const meta = currentUser.user_metadata || {};
  const first = meta.first_name || '';
  const last  = meta.last_name  || '';
  const name  = [first, last].filter(Boolean).join(' ');
  document.getElementById('dashUserName').textContent = name || currentUser.email || '';
}
