// ════════════════════════════════════════════════
//  AUTH
// ════════════════════════════════════════════════
let currentUser = null;
// Set by signOut() so the SIGNED_OUT handler can tell a deliberate sign-out from
// one the server forced on us (single-session enforcement, revoked token).
let _userInitiatedSignOut = false;
let authMode = 'signin';
let _authInitializing = true;
let _isPasswordRecovery = false;

const legalContent = {
  terms: {
    title: 'Terms & Conditions',
    body: `
<p style="color:#e8a020;font-size:11px;letter-spacing:1px;font-family:'DM Mono',monospace;margin:0 0 28px;text-transform:uppercase">Last updated: March 2026</p>

<p style="color:#dde8f5;font-size:14px;line-height:1.8;margin-bottom:24px">Welcome to BackProp. These terms cover your use of our slab back-propping design tool. By creating an account you're agreeing to these terms, so please take a few minutes to read them.</p>

<h3 style="color:#dde8f5;font-family:'Syne',sans-serif;font-size:14px;font-weight:700;margin:28px 0 10px;padding-bottom:8px;border-bottom:1px solid #2a3447">Who we are</h3>
<p>BackProp is operated by IKB Engineering Pty Ltd (ABN 90 672 228 965), a structural engineering consultancy based in Western Australia. You can reach us at neil.williams@ikbeng.com.</p>

<h3 style="color:#dde8f5;font-family:'Syne',sans-serif;font-size:14px;font-weight:700;margin:28px 0 10px;padding-bottom:8px;border-bottom:1px solid #2a3447">Your subscription</h3>
<p>BackProp is offered on a monthly subscription basis at A$30/month (inclusive of GST where applicable). You get a 7-day free trial when you sign up — no charge until the trial ends. You can cancel at any time from your account settings and you won't be charged again after that. We don't offer refunds for partial months.</p>

<h3 style="color:#dde8f5;font-family:'Syne',sans-serif;font-size:14px;font-weight:700;margin:28px 0 10px;padding-bottom:8px;border-bottom:1px solid #2a3447">What you can do with it</h3>
<p>Your subscription gives you access to use BackProp for your own professional work. You can't share your login, resell access, or use it to build a competing product. The tool and its underlying calculations are our intellectual property.</p>

<h3 style="color:#dde8f5;font-family:'Syne',sans-serif;font-size:14px;font-weight:700;margin:28px 0 10px;padding-bottom:8px;border-bottom:1px solid #2a3447">Your data</h3>
<p>Your projects are stored securely in our database. We don't sell your data or share it with third parties except as needed to run the service (payment processing via Stripe, authentication via Supabase). See our Privacy Policy for the full story.</p>

<h3 style="color:#dde8f5;font-family:'Syne',sans-serif;font-size:14px;font-weight:700;margin:28px 0 10px;padding-bottom:8px;border-bottom:1px solid #2a3447">Changes to the service</h3>
<p>We're constantly improving BackProp. We might add features, change how things work, or occasionally need to take the service offline briefly for maintenance. We'll give you reasonable notice of any significant changes.</p>

<h3 style="color:#dde8f5;font-family:'Syne',sans-serif;font-size:14px;font-weight:700;margin:28px 0 10px;padding-bottom:8px;border-bottom:1px solid #2a3447">Ending your account</h3>
<p>You can close your account at any time. We may suspend or close accounts that violate these terms. If that happens we'll let you know why.</p>

<h3 style="color:#dde8f5;font-family:'Syne',sans-serif;font-size:14px;font-weight:700;margin:28px 0 10px;padding-bottom:8px;border-bottom:1px solid #2a3447">Governing law</h3>
<p>These terms are governed by the laws of Western Australia, Australia.</p>
    `
  },

  privacy: {
    title: 'Privacy Policy',
    body: `
<p style="color:#e8a020;font-size:11px;letter-spacing:1px;font-family:'DM Mono',monospace;margin:0 0 28px;text-transform:uppercase">Last updated: March 2026</p>

<p style="color:#dde8f5;font-size:14px;line-height:1.8;margin-bottom:24px">We take your privacy seriously. Here's a straightforward explanation of what data we collect, why we collect it, and what we do with it.</p>

<h3 style="color:#dde8f5;font-family:'Syne',sans-serif;font-size:14px;font-weight:700;margin:28px 0 10px;padding-bottom:8px;border-bottom:1px solid #2a3447">What we collect</h3>
<p>When you sign up we collect your name and email address. When you use the tool we store your project data (building levels, zones, prop configurations, and calculation results). When you subscribe we process your payment through Stripe — we never see or store your card details directly.</p>

<h3 style="color:#dde8f5;font-family:'Syne',sans-serif;font-size:14px;font-weight:700;margin:28px 0 10px;padding-bottom:8px;border-bottom:1px solid #2a3447">Why we collect it</h3>
<p>Your name and email are needed to create and manage your account and send you important service emails (like email verification and password resets). Your project data is stored so you can access it across devices and sessions. We use Google Analytics to understand how people use the site so we can improve it — this is anonymised and doesn't identify you personally.</p>

<h3 style="color:#dde8f5;font-family:'Syne',sans-serif;font-size:14px;font-weight:700;margin:28px 0 10px;padding-bottom:8px;border-bottom:1px solid #2a3447">Who we share it with</h3>
<p>We use a small number of trusted third-party services to run BackProp: Supabase for authentication and database storage, Stripe for payment processing, and Resend for transactional emails. Each of these providers has their own privacy policy and handles your data securely. We don't sell your data to anyone, ever.</p>

<h3 style="color:#dde8f5;font-family:'Syne',sans-serif;font-size:14px;font-weight:700;margin:28px 0 10px;padding-bottom:8px;border-bottom:1px solid #2a3447">Where it's stored</h3>
<p>Your data is stored on Supabase's infrastructure. Supabase uses AWS data centres. We've configured our project to use servers in the US East region.</p>

<h3 style="color:#dde8f5;font-family:'Syne',sans-serif;font-size:14px;font-weight:700;margin:28px 0 10px;padding-bottom:8px;border-bottom:1px solid #2a3447">Your rights</h3>
<p>Under the Australian Privacy Act you have the right to access the personal information we hold about you, and to ask us to correct or delete it. Just email us at neil.williams@ikbeng.com and we'll sort it out promptly.</p>

<h3 style="color:#dde8f5;font-family:'Syne',sans-serif;font-size:14px;font-weight:700;margin:28px 0 10px;padding-bottom:8px;border-bottom:1px solid #2a3447">Cookies</h3>
<p>We use session cookies to keep you logged in, and Google Analytics uses cookies for anonymous usage tracking. We don't use advertising cookies or track you across other websites.</p>

<h3 style="color:#dde8f5;font-family:'Syne',sans-serif;font-size:14px;font-weight:700;margin:28px 0 10px;padding-bottom:8px;border-bottom:1px solid #2a3447">Questions</h3>
<p>If you have any questions about how we handle your data, email us at neil.williams@ikbeng.com.</p>
    `
  },

  disclaimer: {
    title: 'Disclaimer',
    body: `
<p style="color:#e8a020;font-size:11px;letter-spacing:1px;font-family:'DM Mono',monospace;margin:0 0 28px;text-transform:uppercase">Last updated: March 2026</p>

<p style="color:#dde8f5;font-size:14px;line-height:1.8;margin-bottom:24px">BackProp is a design aid for qualified structural and temporary works engineers. Before you use it, there are a few important things to understand.</p>

<h3 style="color:#dde8f5;font-family:'Syne',sans-serif;font-size:14px;font-weight:700;margin:28px 0 10px;padding-bottom:8px;border-bottom:1px solid #2a3447">It's a tool, not a substitute for engineering judgement</h3>
<p>BackProp automates back-propping calculations but it doesn't replace your professional judgement, experience, or duty of care. Every project is different. You're responsible for verifying that the tool's outputs are appropriate for your specific situation, including site conditions, construction sequence, and applicable standards.</p>

<h3 style="color:#dde8f5;font-family:'Syne',sans-serif;font-size:14px;font-weight:700;margin:28px 0 10px;padding-bottom:8px;border-bottom:1px solid #2a3447">Check your results</h3>
<p>We've worked hard to make BackProp accurate and reliable, but no software is perfect. Always cross-check results against your own calculations and engineering judgement before using them on a project. Don't use BackProp as the sole basis for any engineering decision.</p>

<h3 style="color:#dde8f5;font-family:'Syne',sans-serif;font-size:14px;font-weight:700;margin:28px 0 10px;padding-bottom:8px;border-bottom:1px solid #2a3447">Standards and codes</h3>
<p>BackProp is designed for use in Australia in accordance with AS 3610 and related standards. It's your responsibility to ensure you're applying the correct standards for your jurisdiction and project type.</p>

<h3 style="color:#dde8f5;font-family:'Syne',sans-serif;font-size:14px;font-weight:700;margin:28px 0 10px;padding-bottom:8px;border-bottom:1px solid #2a3447">Liability</h3>
<p>To the maximum extent permitted by Australian law, IKB Engineering Pty Ltd accepts no liability for any loss, damage, or consequences arising from the use of BackProp. This includes errors in calculation outputs, misapplication of results, or any decisions made on the basis of the tool's outputs.</p>

<h3 style="color:#dde8f5;font-family:'Syne',sans-serif;font-size:14px;font-weight:700;margin:28px 0 10px;padding-bottom:8px;border-bottom:1px solid #2a3447">Professional responsibility</h3>
<p>If you're a Chartered Professional Engineer or registered practitioner, your professional obligations remain unchanged regardless of what tools you use. BackProp is designed to assist qualified engineers — not to replace the need for one.</p>

<p style="margin-top:20px;padding:12px;background:rgba(232,160,32,0.08);border:1px solid rgba(232,160,32,0.2);border-radius:6px;color:#e8a020">By using BackProp you confirm that you are a qualified engineer or working under the supervision of one, and that you accept these terms.</p>
    `
  }
};

function setAuthMode(mode) {
  authMode = mode;
  const isReset = mode === 'reset';
  const isSignup = mode === 'signup';
  const isSignin = mode === 'signin';
  document.getElementById('authNameFields').style.display = isSignup ? 'grid' : 'none';
  document.getElementById('authTermsRow').style.display = isSignup ? 'flex' : 'none';
  if (!isSignup) document.getElementById('authTermsCheck').checked = false;
  document.getElementById('authPasswordField').style.display = isReset ? 'none' : 'block';
  document.getElementById('forgotLink').style.display = isSignin ? 'block' : 'none';
  // Tab strip: hide when in reset mode
  document.querySelector('#tabSignin').closest('div').style.display = isReset ? 'none' : 'flex';
  document.getElementById('authFormTitle').textContent = isReset ? 'Reset Password' : isSignup ? 'Create Account' : 'Sign In';
  document.getElementById('authFormSub').textContent   = isReset ? 'Enter your email and we\'ll send a reset link.' : isSignup ? 'Start your 7-day free trial.' : 'Welcome back to BackProp.';
  document.getElementById('tabSignin').style.background = isSignin ? '#161e2a' : 'transparent';
  document.getElementById('tabSignin').style.color = isSignin ? '#dde8f5' : '#7d8590';
  document.getElementById('tabSignup').style.background = isSignup ? '#161e2a' : 'transparent';
  document.getElementById('tabSignup').style.color = isSignup ? '#dde8f5' : '#7d8590';
  const _authBtn = document.getElementById('authBtn');
  _authBtn.textContent = isReset ? 'Send Reset Link' : isSignin ? 'Sign In' : 'Create Account';
  _authBtn.disabled = false;
  _authBtn.onclick = handleAuth;
  document.getElementById('authError').style.display = 'none';
  document.getElementById('authMsg').style.display = 'none';
  // Back to sign in link
  let backLink = document.getElementById('resetBackLink');
  if (isReset && !backLink) {
    backLink = document.createElement('div');
    backLink.id = 'resetBackLink';
    backLink.style.cssText = 'text-align:center;margin-top:12px;font-size:10px;font-family:"DM Mono",monospace;color:#7d8590';
    backLink.innerHTML = '<a href="#" onclick="setAuthMode(\'signin\');return false;" style="color:#7d8590;text-decoration:none">← Back to sign in</a>';
    document.getElementById('authBtn').insertAdjacentElement('afterend', backLink);
  } else if (!isReset && backLink) {
    backLink.remove();
  }
}

async function handleAuth() {
  const email = document.getElementById('authEmail').value.trim();
  const password = document.getElementById('authPassword').value;
  const errEl = document.getElementById('authError');
  const msgEl = document.getElementById('authMsg');
  errEl.style.display = 'none';
  msgEl.style.display = 'none';

  // ── Password reset flow ──
  if (authMode === 'reset') {
    if (!email) { errEl.textContent = 'Please enter your email address.'; errEl.style.display = 'block'; return; }
    document.getElementById('authBtn').textContent = '…';
    const { error } = await supa.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + window.location.pathname
    });
    document.getElementById('authBtn').textContent = 'Send Reset Link';
    if (error) {
      errEl.textContent = error.message;
      errEl.style.display = 'block';
    } else {
      msgEl.textContent = 'Reset link sent — check your email.';
      msgEl.style.display = 'block';
    }
    return;
  }

  if (!email || !password) { errEl.textContent = 'Please enter email and password.'; errEl.style.display = 'block'; return; }
  const authBtn = document.getElementById('authBtn');
  authBtn.textContent = '…';
  authBtn.disabled = true;
  if (authMode === 'signup') {
    if (!document.getElementById('authTermsCheck').checked) {
      errEl.textContent = 'Please agree to the Terms & Conditions, Privacy Policy and Disclaimer.';
      errEl.style.display = 'block';
      document.getElementById('authBtn').textContent = 'Create Account';
      return;
    }
    const firstName = document.getElementById('authFirstName').value.trim();
    const lastName  = document.getElementById('authLastName').value.trim();
    const { data, error } = await supa.auth.signUp({ email, password, options: { data: { first_name: firstName, last_name: lastName } } });
    if (error) {
      errEl.textContent = error.message;
      errEl.style.display = 'block';
      authBtn.textContent = 'Create Account';
      authBtn.disabled = false;
    } else if (data.user && data.user.identities && data.user.identities.length === 0) {
      // Supabase returns a fake success when email already exists — detect by empty identities
      errEl.textContent = 'An account with this email already exists. Please sign in instead.';
      errEl.style.display = 'block';
      document.getElementById('authBtn').textContent = 'Create Account';
      // Switch to sign in after 4 seconds, keep message visible
      authBtn.disabled = false;
      setTimeout(() => {
        setAuthMode('signin');
        errEl.textContent = 'An account with this email already exists. Please sign in instead.';
        errEl.style.display = 'block';
      }, 4000);
      return;
    } else {
      // Reset button first
      authBtn.textContent = 'Create Account';
      authBtn.disabled = false;
      // Clear all fields
      document.getElementById('authEmail').value = '';
      document.getElementById('authPassword').value = '';
      document.getElementById('authFirstName').value = '';
      document.getElementById('authLastName').value = '';
      document.getElementById('authTermsCheck').checked = false;
      // Switch to signin tab
      setAuthMode('signin');
      // Show success message after mode switch (setAuthMode hides msgEl so set after)
      setTimeout(() => {
        msgEl.textContent = '✓ Account created! Check your email (including spam) to confirm, then sign in.';
        msgEl.style.display = 'block';
      }, 50);
      return;
    }
  } else {
    const { error } = await supa.auth.signInWithPassword({ email, password });
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        errEl.textContent = 'Incorrect email or password.';
      } else {
        errEl.textContent = error.message;
      }
      errEl.style.display = 'block';
      authBtn.textContent = 'Sign In';
      authBtn.disabled = false;
    }
  }
  document.getElementById('authBtn').textContent = authMode === 'signin' ? 'Sign In' : 'Create Account';
  // Clear password field after any attempt; clear email too on successful signup
  document.getElementById('authPassword').value = '';
  document.getElementById('authFirstName').value = '';
  document.getElementById('authLastName').value = '';
}

function openLegal(type) {
  const doc = legalContent[type];
  if (!doc) return;
  document.getElementById('legalTitle').textContent = doc.title;
  document.getElementById('legalBody').innerHTML = doc.body;
  document.getElementById('legalPage').style.display = 'block';
  document.getElementById('legalPage').scrollTop = 0;
}

function closeLegal() {
  document.getElementById('legalPage').style.display = 'none';
}

// Shows the auth screen in a usable state. handleAuth() disables the button and
// blanks its label while signing in, and never restores it on success — so any
// path back to the auth screen that skips this leaves an unclickable Sign In.
function resetAuthScreen() {
  const btn = document.getElementById('authBtn');
  if (btn) { btn.disabled = false; btn.textContent = authMode === 'signup' ? 'Create Account' : 'Sign In'; btn.onclick = handleAuth; }
  const err = document.getElementById('authError'); if (err) err.style.display = 'none';
  const msg = document.getElementById('authMsg');   if (msg) msg.style.display = 'none';
  const pw  = document.getElementById('authPassword'); if (pw) pw.value = '';
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('projectListScreen').style.display = 'none';
  document.getElementById('paywallScreen').style.display = 'none';
  document.getElementById('appShell').style.display = 'none';
}

async function signOut() {
  _userInitiatedSignOut = true;
  // A revoked session has nothing left to end server-side and can throw here;
  // the local teardown below must happen either way.
  try { await supa.auth.signOut({ scope: 'local' }); } catch (e) { console.warn('Sign out:', e); }
  navReplace({ screen: 'auth' });
  currentUser = null;
  projectStore = [];
  resetAuthScreen();
}

// Check session immediately on load — prevents flash of login screen
async function initAuth() {
  // Detect password recovery link BEFORE anything else
  // Supabase puts type=recovery in the URL hash
  const hash = window.location.hash;
  if (hash.includes('type=recovery')) {
    _isPasswordRecovery = true;
  }

  // Handle Stripe redirect back
  const params = new URLSearchParams(window.location.search);
  if (params.get('payment') === 'success') {
    window.history.replaceState({}, '', '/');
    setTimeout(() => showToast('Payment successful — welcome to BackProp!', 'success', 8000), 1500);
  } else if (params.get('payment') === 'cancelled') {
    window.history.replaceState({}, '', '/');
  }
  try {
    const { data } = await supa.auth.getSession();
    const session = data.session;
    _authInitializing = false;
    document.getElementById('loadingScreen').style.display = 'none';
    if (_isPasswordRecovery) {
      // Show reset form regardless of session state
      showNewPasswordForm();
      return;
    }
    if (session && session.user) {
      currentUser = session.user;
      await dbLoadProjects();
      await showDashboardWithAccessCheck(currentUser);
    } else {
      document.getElementById('authScreen').style.display = 'flex';
    }
  } catch(e) {
    _authInitializing = false;
    console.error('Auth init error:', e);
    document.getElementById('loadingScreen').style.display = 'none';
    document.getElementById('authScreen').style.display = 'flex';
  }
}

function showNewPasswordForm() {
  // Replace auth form content with new password entry
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('authFormTitle').textContent = 'Set New Password';
  document.getElementById('authFormSub').textContent = 'Enter your new password below.';
  document.querySelector('#tabSignin').closest('div').style.display = 'none';
  document.getElementById('authNameFields').style.display = 'none';
  document.getElementById('authPasswordField').style.display = 'block';
  document.getElementById('forgotLink').style.display = 'none';
  document.querySelector('label[for="authEmail"]') // hide email field
  document.getElementById('authEmail').closest('div').style.display = 'none';
  document.getElementById('authBtn').textContent = 'Update Password';
  document.getElementById('authBtn').onclick = updatePassword;
  document.getElementById('authError').style.display = 'none';
  document.getElementById('authMsg').style.display = 'none';
}

async function updatePassword() {
  const password = document.getElementById('authPassword').value;
  const errEl = document.getElementById('authError');
  const msgEl = document.getElementById('authMsg');
  if (!password || password.length < 6) {
    errEl.textContent = 'Password must be at least 6 characters.';
    errEl.style.display = 'block'; return;
  }
  document.getElementById('authBtn').textContent = '…';
  const { error } = await supa.auth.updateUser({ password });
  if (error) {
    errEl.textContent = error.message;
    errEl.style.display = 'block';
    document.getElementById('authBtn').textContent = 'Update Password';
  } else {
    _isPasswordRecovery = false;
    msgEl.textContent = 'Password updated — taking you to the app…';
    msgEl.style.display = 'block';
    // Get current session and go to dashboard
    setTimeout(async () => {
      const { data } = await supa.auth.getSession();
      if (data.session && data.session.user) {
        currentUser = data.session.user;
        document.getElementById('authScreen').style.display = 'none';
        await dbLoadProjects();
        await showDashboardWithAccessCheck(currentUser);
      }
    }, 1200);
  }
}
