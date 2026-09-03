// ════════════════════════════════════════════════
//  SESSION GUARD
// ════════════════════════════════════════════════
//
// Supabase single-session enforcement revokes the older session's refresh token,
// but supabase-js (2.114.0) never surfaces that. _autoRefreshTokenTick() swallows
// the failure with console.error("...likely a transient error"), _recoverAndRefresh()
// debug-logs it, and refreshSession() only returns it. SIGNED_OUT is emitted solely
// from _removeSession(), which none of those paths call — so the client keeps
// believing it is signed in while every write is doomed.
//
// We therefore detect the revoked session ourselves, say so, and sign the user
// out — the app saves on almost every edit, so there is no meaningful work left
// in the tab to preserve.

let _sessionRevoked = false;   // latch — announce once, not on every probe

// Matches a refresh token the server has rejected outright. Deliberately narrow:
// a network blip or a 5xx must never be read as a revoked session.
function isRevokedSessionError(error) {
  if (!error) return false;
  const msg  = (error.message || '').toLowerCase();
  const code = (error.code || error.error_code || '').toLowerCase();
  return msg.includes('refresh token') ||
         msg.includes('revoked') ||
         msg.includes('session expired') ||
         code === 'refresh_token_not_found' ||
         code === 'session_expired';
}

// A failed write carries an auth error once the access token has also expired.
function isAuthWriteError(error) {
  if (!error) return false;
  const msg = (error.message || '').toLowerCase();
  return msg.includes('jwt') || msg.includes('token') ||
         error.code === 'PGRST301' || error.code === '42501';
}

async function announceRevokedSession() {
  if (_sessionRevoked) return;
  _sessionRevoked = true;
  await dlgAlert(
    'Session Ended',
    'A session has been started on another device. Only one active session is ' +
    'permitted. You will now be logged out.',
    'OK'
  );
  await signOut();
  _sessionRevoked = false;   // re-arm for whoever signs in next
}

// Probe the session. Only reports a revocation the server actually stated.
//
// getSession() is the right probe, not refreshSession(): it returns the stored
// session with no network call while the access token is still live, and only
// attempts a refresh once it has expired — surfacing the error if that refresh is
// rejected. So a working session is never disturbed (refresh token rotation is on,
// and forcing a refresh on every tab focus would churn tokens for nothing), and a
// revoked one is caught exactly when it starts to matter.
//
// It also returns no session at all while the client is still initialising, which
// we skip rather than mistake for a revocation.
async function checkSessionAlive() {
  if (!currentUser || _sessionRevoked) return;
  const { error } = await supa.auth.getSession();
  // Check the error first: a revoked session whose access token has also expired
  // comes back as { session: null, error }, so testing for a missing session
  // before the error would skip the very case we are looking for. No error means
  // nothing is wrong — including while the client is still initialising.
  if (isRevokedSessionError(error)) await announceRevokedSession();
}

// Returning to a long-idle tab is the usual way people meet this.
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') checkSessionAlive();
});
setInterval(checkSessionAlive, 5 * 60 * 1000);
