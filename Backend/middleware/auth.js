const crypto = require('crypto');
const path = require('path');

const JWT_SECRET = process.env.JWT_SECRET || 'oppo-mmt-campaign-secret-key-2026';
const MMT_DASHBOARD_PASSWORD = process.env.MMT_DASHBOARD_PASSWORD || 'mmt-admin-2026';
const OPPO_DASHBOARD_PASSWORD = process.env.OPPO_DASHBOARD_PASSWORD || 'oppo-admin-2026';

// Parse a single cookie value
function getCookie(req, name) {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';');
  for (let cookie of cookies) {
    const [key, val] = cookie.trim().split('=');
    if (key === name) return decodeURIComponent(val);
  }
  return null;
}

// Generate token using HMAC-SHA256
function generateToken(dashboard) {
  const payload = {
    dashboard,
    exp: Date.now() + 24 * 60 * 60 * 1000 // 24 hours expiry
  };
  const payloadStr = JSON.stringify(payload);
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(payloadStr).digest('hex');
  return Buffer.from(payloadStr).toString('base64') + '.' + signature;
}

// Verify HMAC signature and expiry
function verifyToken(token) {
  if (!token) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;

  try {
    const payloadStr = Buffer.from(parts[0], 'base64').toString('utf8');
    const signature = parts[1];

    const expectedSignature = crypto.createHmac('sha256', JWT_SECRET).update(payloadStr).digest('hex');
    if (signature !== expectedSignature) return null;

    const payload = JSON.parse(payloadStr);
    if (payload.exp < Date.now()) return null; // Expired

    return payload;
  } catch (err) {
    return null;
  }
}

// Dynamic Login Page HTML generator with premium UI/UX
function getLoginHTML(dashboard) {
  const isMMT = dashboard === 'mmt';
  
  const title = isMMT ? 'MakeMyTrip Admin Login' : 'OPPO Client Login';
  const accentColor = isMMT ? '#0052e4' : '#00b064';
  const subtitle = isMMT ? 'Admin Moderation Portal' : 'Contest Winner Dashboard';
  
  // Custom styling tokens
  const bodyGradient = isMMT
    ? 'from-[#050c1a] via-[#091428] to-[#0c1f3d]'
    : 'from-[#020a06] via-[#05120c] to-[#0a2215]';
    
  const cardBorder = isMMT
    ? 'border-white/10 shadow-white/5'
    : 'border-[#00b064]/20 shadow-[#00b064]/5';

  const brandLogo = isMMT
    ? `<img src="https://promos.makemytrip.com/images/mmtlogo.webp" alt="MakeMyTrip Logo" class="mx-auto max-w-[150px] mb-2 p-1.5 bg-white rounded-lg">`
    : `<div class="text-3xl font-black font-mono tracking-widest text-[#00b064] text-glow select-none uppercase">OPPO</div>`;

  const btnGradient = isMMT
    ? 'from-[#0052e4] to-[#00b064] hover:shadow-[#0052e4]/30'
    : 'from-[#005a36] to-[#00b064] hover:shadow-[#00b064]/30';

  const focusRing = isMMT ? 'focus:ring-[#0052e4] focus:border-[#0052e4]' : 'focus:ring-[#00b064] focus:border-[#00b064]';
  const badgeColor = isMMT ? 'text-oppoMint bg-[#00e5ff]/10 border-[#00e5ff]/20' : 'text-oppoEmerald bg-[#00b064]/10 border-[#00b064]/20';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title} | OPPO x MMT</title>
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          colors: {
            mmtBlue: '#0052e4',
            oppoGreen: '#005a36',
            oppoEmerald: '#00b064',
            oppoMint: '#00e5ff',
          },
          fontFamily: {
            sans: ['Lato', 'Inter', 'sans-serif'],
          }
        }
      }
    }
  </script>
  <link href="https://fonts.googleapis.com/css2?family=Lato:wght@300;400;500;600;700;800;900&family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
  <style>
    body {
      font-family: 'Lato', sans-serif;
    }
    .glass-card {
      background: rgba(11, 22, 44, 0.75);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
    }
    .text-glow {
      text-shadow: 0 0 20px rgba(0, 229, 255, 0.45);
    }
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20%, 60% { transform: translateX(-8px); }
      40%, 80% { transform: translateX(8px); }
    }
    .shake {
      animation: shake 0.4s ease-in-out;
    }
    @keyframes fadeInDown {
      from {
        opacity: 0;
        transform: translateY(-20px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }
    .fade-in-down {
      animation: fadeInDown 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
  </style>
</head>
<body class="text-slate-100 min-h-screen flex items-center justify-center p-4 antialiased bg-gradient-to-br ${bodyGradient}">

  <!-- Login Card Container -->
  <div id="loginCard" class="w-full max-w-md glass-card border ${cardBorder} rounded-3xl p-8 md:p-10 shadow-2xl fade-in-down">
    
    <!-- Header/Branding -->
    <div class="text-center mb-8">
      ${brandLogo}
      <h1 class="text-lg font-bold tracking-wide mt-3 text-white">${title}</h1>
      <span class="inline-block mt-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${badgeColor}">
        ${subtitle}
      </span>
    </div>

    <!-- Form -->
    <form id="authForm" class="space-y-6">
      <div class="space-y-2 relative">
        <label for="password" class="text-xs font-semibold uppercase tracking-wider text-slate-400">Password</label>
        <div class="relative">
          <input type="password" id="password" required
            class="w-full bg-slate-900/50 border border-white/10 rounded-xl px-4 py-3.5 pr-12 text-sm text-white focus:outline-none focus:ring-2 ${focusRing} transition-all duration-300 placeholder-slate-600"
            placeholder="Enter secure dashboard password">
          <!-- Toggle Password Visiblity -->
          <button type="button" id="togglePassword" class="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors text-sm focus:outline-none">
            👁️
          </button>
        </div>
      </div>

      <button type="submit" id="submitBtn"
        class="w-full bg-gradient-to-r ${btnGradient} text-white font-extrabold text-xs uppercase tracking-wider py-4 rounded-xl shadow-lg transition-all active:scale-95 duration-300 flex items-center justify-center gap-2">
        <span>Log In Securely</span>
        <svg id="loadingSpinner" class="hidden animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
      </button>
    </form>
  </div>

  <!-- Micro Toast Notification System -->
  <div id="toast" class="hidden fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3.5 rounded-xl border text-xs font-bold tracking-wide shadow-2xl backdrop-blur-md transition-all duration-300 z-50 flex items-center gap-2 animate-bounce">
    <span id="toastIcon"></span>
    <span id="toastText"></span>
  </div>

  <script>
    const form = document.getElementById('authForm');
    const card = document.getElementById('loginCard');
    const passwordInput = document.getElementById('password');
    const togglePasswordBtn = document.getElementById('togglePassword');
    const submitBtn = document.getElementById('submitBtn');
    const spinner = document.getElementById('loadingSpinner');
    const toast = document.getElementById('toast');
    const toastText = document.getElementById('toastText');
    const toastIcon = document.getElementById('toastIcon');

    // Toggle Password Visibility
    togglePasswordBtn.addEventListener('click', () => {
      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        togglePasswordBtn.textContent = '🙈';
      } else {
        passwordInput.type = 'password';
        togglePasswordBtn.textContent = '👁️';
      }
    });

    // Custom Toast Helper
    function showToast(message, type = 'success') {
      toast.className = 'fixed bottom-6 left-1/2 -translate-x-1/2 px-5 py-3.5 rounded-xl border text-xs font-bold tracking-wide shadow-2xl backdrop-blur-md transition-all duration-300 z-50 flex items-center gap-2';
      
      if (type === 'error') {
        toast.classList.add('bg-red-500/10', 'text-red-400', 'border-red-500/20');
        toastIcon.textContent = '⚠️';
      } else {
        toast.classList.add('bg-emerald-500/10', 'text-emerald-400', 'border-emerald-500/20');
        toastIcon.textContent = '✅';
      }
      
      toastText.textContent = message;
      toast.classList.remove('hidden');

      setTimeout(() => {
        toast.classList.add('hidden');
      }, 3500);
    }

    // Submit handler
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      // Clear previous styles
      card.classList.remove('shake');
      
      const password = passwordInput.value;
      if (!password) {
        showToast('Password is required', 'error');
        return;
      }

      // Enter loading state
      submitBtn.disabled = true;
      spinner.classList.remove('hidden');

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            dashboard: '${dashboard}',
            password: password
          })
        });

        const data = await res.json();
        
        if (res.ok && data.success) {
          showToast('Access granted! Opening dashboard...', 'success');
          setTimeout(() => {
            window.location.reload();
          }, 800);
        } else {
          // Trigger shake micro-animation
          setTimeout(() => { card.classList.add('shake'); }, 10);
          showToast(data.message || 'Incorrect password. Access denied.', 'error');
          submitBtn.disabled = false;
          spinner.classList.add('hidden');
        }
      } catch (err) {
        console.error(err);
        showToast('Server connection failed. Try again.', 'error');
        submitBtn.disabled = false;
        spinner.classList.add('hidden');
      }
    });
  </script>
</body>
</html>
  `;
}

// Route handler protecting Page requests
function pageAuthMiddleware(dashboard) {
  return (req, res, next) => {
    const token = getCookie(req, `auth_token_${dashboard}`);
    const payload = verifyToken(token);

    if (payload && payload.dashboard === dashboard) {
      return next(); // Authenticated, proceed to static file server
    }

    // Unauthenticated: Serve custom, premium brand-aligned login HTML
    res.setHeader('Content-Type', 'text/html');
    return res.status(200).send(getLoginHTML(dashboard));
  };
}

// Route handler protecting sensitive API operations
function apiAuthMiddleware(dashboardOrRoles) {
  return (req, res, next) => {
    // If dashboardOrRoles is an array, verify if the user possesses ANY of the tokens
    const roles = Array.isArray(dashboardOrRoles) ? dashboardOrRoles : [dashboardOrRoles];
    
    let authenticated = false;
    for (const role of roles) {
      const token = getCookie(req, `auth_token_${role}`);
      const payload = verifyToken(token);
      if (payload && payload.dashboard === role) {
        authenticated = true;
        req.user = payload; // Attach user claims to req
        break;
      }
    }

    if (authenticated) {
      return next();
    }

    return res.status(401).json({
      success: false,
      message: 'Access Denied: You must be authenticated to access this endpoint.'
    });
  };
}

// Authenticate and issue Cookie
function handleLogin(req, res) {
  const { dashboard, password } = req.body;

  if (!dashboard || !password) {
    return res.status(400).json({ success: false, message: 'Dashboard and password are required.' });
  }

  let expectedPassword;
  if (dashboard === 'mmt') {
    expectedPassword = MMT_DASHBOARD_PASSWORD;
  } else if (dashboard === 'oppo') {
    expectedPassword = OPPO_DASHBOARD_PASSWORD;
  } else {
    return res.status(400).json({ success: false, message: 'Invalid dashboard specified.' });
  }

  if (password !== expectedPassword) {
    return res.status(401).json({ success: false, message: 'Incorrect password.' });
  }

  const token = generateToken(dashboard);
  
  // Set Cookie parameters (HttpOnly, Secure in Production, Strict SameSite)
  const isProd = process.env.NODE_ENV === 'production';
  res.cookie(`auth_token_${dashboard}`, token, {
    httpOnly: true,
    secure: isProd,
    sameSite: 'strict',
    maxAge: 24 * 60 * 60 * 1000 // 24 hours
  });

  return res.status(200).json({ success: true, message: 'Authenticated successfully.' });
}

// Clear cookie
function handleLogout(req, res) {
  const { dashboard } = req.body;
  
  if (!dashboard || (dashboard !== 'mmt' && dashboard !== 'oppo')) {
    return res.status(400).json({ success: false, message: 'Invalid dashboard specified.' });
  }

  res.clearCookie(`auth_token_${dashboard}`);
  return res.status(200).json({ success: true, message: 'Logged out successfully.' });
}

module.exports = {
  pageAuthMiddleware,
  apiAuthMiddleware,
  handleLogin,
  handleLogout
};
