// ════════════════════════════════════════════════
//  INIT
// ════════════════════════════════════════════════

// Handle sign in / sign out events (skip during initial session check)
supa.auth.onAuthStateChange(async (event, session) => {
  if (_authInitializing) return;
  if (event === 'PASSWORD_RECOVERY') {
    showNewPasswordForm();
    return;
  }
  if (event === 'SIGNED_IN' && session && session.user && !currentUser && !_isPasswordRecovery) {
    if (window.location.hash.includes('access_token') && !window.location.hash.includes('type=recovery')) {
      setTimeout(() => showToast('Email confirmed — welcome to BackProp!', 'success'), 800);
    }
    currentUser = session.user;
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('loadingScreen').style.display = 'none';
    await dbLoadProjects();
    await showDashboardWithAccessCheck(currentUser);
  } else if (event === 'SIGNED_OUT') {
    _isPasswordRecovery = false;
    currentUser = null;
    projectStore = [];
    document.getElementById('authScreen').style.display = 'flex';
    document.getElementById('projectListScreen').style.display = 'none';
    document.getElementById('paywallScreen').style.display = 'none';
    document.getElementById('appShell').style.display = 'none';
  }
});

// Projects loaded from Supabase after login via onAuthStateChange
// initAuth() is called from auth.js
initAuth();
