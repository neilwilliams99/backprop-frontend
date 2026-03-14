// ════════════════════════════════════════════════
//  SUBSCRIPTION & PAYWALL
// ════════════════════════════════════════════════

function getTrialDaysLeft(user) {
  const created = new Date(user.created_at);
  const now = new Date();
  const daysUsed = (now - created) / (1000 * 60 * 60 * 24);
  return Math.max(0, TRIAL_DAYS - daysUsed);
}

async function checkAccess(user) {
  // Admin accounts bypass all checks
  if (ADMIN_IDS.includes(user.id)) return { access: true, reason: 'subscribed' };
  // First check trial period
  const trialDaysLeft = getTrialDaysLeft(user);

  // Then check subscription status from API
  try {
    const res = await fetch(`${API_URL}/subscription-status?user_id=${user.id}`);
    const data = await res.json();
    if (data.access) return { access: true, reason: 'subscribed' };
  } catch(e) {
    console.warn('Subscription check failed, falling back to trial', e);
    // If API is down, fall back to trial grace — don't lock users out
    if (trialDaysLeft > 0) return { access: true, reason: 'trial', daysLeft: Math.ceil(trialDaysLeft) };
  }

  if (trialDaysLeft > 0) {
    return { access: true, reason: 'trial', daysLeft: Math.ceil(trialDaysLeft) };
  }
  return { access: false, reason: 'expired' };
}

function showPaywall(reason) {
  document.getElementById('loadingScreen').style.display = 'none';
  document.getElementById('projectListScreen').style.display = 'none';
  document.getElementById('appShell').style.display = 'none';
  const screen = document.getElementById('paywallScreen');
  screen.style.display = 'flex';

  if (reason === 'expired') {
    document.getElementById('paywallIcon').textContent = '⏰';
    document.getElementById('paywallTitle').textContent = 'Free Trial Ended';
    document.getElementById('paywallMsg').textContent =
      'Your 7-day free trial has ended. Subscribe to continue using BackProp.';
  } else if (reason === 'trial_limit') {
    document.getElementById('paywallIcon').textContent = '🔓';
    document.getElementById('paywallTitle').textContent = 'Upgrade to Unlock';
    document.getElementById('paywallMsg').textContent =
      'Your free trial includes 1 project and view-only results. Subscribe for unlimited projects and full export.';
  } else {
    document.getElementById('paywallTitle').textContent = 'Subscription Required';
    document.getElementById('paywallMsg').textContent =
      'A subscription is required to access BackProp.';
  }
}

async function startCheckout() {
  const btn = document.getElementById('paywallBtn');
  btn.textContent = 'Connecting…';
  btn.disabled = true;

  // Warn user if API takes a while (cold start on free Render tier)
  const slowTimer = setTimeout(() => {
    btn.textContent = 'Waking up server… (30s)';
  }, 3000);

  try {
    // 60 second timeout to handle Render cold start
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60000);

    const res = await fetch(`${API_URL}/create-checkout-session`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: currentUser.id, email: currentUser.email }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    clearTimeout(slowTimer);

    const data = await res.json();
    if (data.url) {
      btn.textContent = 'Redirecting to Stripe…';
      window.location.href = data.url;
    } else {
      throw new Error(data.detail || 'No checkout URL returned');
    }
  } catch(e) {
    clearTimeout(slowTimer);
    const msg = e.name === 'AbortError'
      ? 'Server took too long to respond — please try again'
      : 'Could not start checkout — please try again';
    showToast(msg, 'error');
    btn.textContent = 'Subscribe Now';
    btn.disabled = false;
  }
}

async function showDashboardWithAccessCheck(user) {
  const access = await checkAccess(user);
  _cachedAccessReason = access.reason;
  if (!access.access) {
    showPaywall(access.reason);
    return;
  }
  // Show trial banner if applicable
  if (access.reason === 'trial' && access.daysLeft <= 3) {
    setTimeout(() => showToast(
      `Trial: ${access.daysLeft} day${access.daysLeft !== 1 ? 's' : ''} remaining — subscribe to keep access`,
      'info', 8000
    ), 1000);
  }
  document.getElementById('paywallScreen').style.display = 'none';
  document.getElementById('projectListScreen').style.display = 'flex';
  updateDashWelcome();
  renderProjectList();
}
