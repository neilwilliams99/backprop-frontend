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
    // Reached both by signOut() and by supabase-js removing a session it found
    // invalid on load — the latter is how a taken-over session usually ends.
    if (!_userInitiatedSignOut) {
      setTimeout(() => showToast(
        'A session was started on another device. Only one active session is permitted, so you have been logged out.',
        'error', 12000
      ), 400);
    }
    _userInitiatedSignOut = false;
    _isPasswordRecovery = false;
    currentUser = null;
    projectStore = [];
    _sessionRevoked = false;   // re-arm the session guard for the next sign-in
    resetAuthScreen();
  }
});

// Projects loaded from Supabase after login via onAuthStateChange
// initAuth() is called from auth.js
initAuth();
