/* =========================
   auth.js (FINAL — SINGLE SOURCE OF TRUTH)
========================= */
import { API_BASE } from "./config.js";

console.log("auth.js loaded — v9 (merged & stable)");

/* =========================
   PAGE GUARD
========================= */
/**
 * auth.js is intended for auth.html ONLY
 * It will safely no-op on other pages
 */
const IS_AUTH_PAGE =
  location.pathname.endsWith("/auth.html");

if (!IS_AUTH_PAGE) {
  console.log("auth.js inactive on this page");
  // Do nothing on non-auth pages
}

/* =========================
   HELPERS
========================= */
function get(id) {
  return document.getElementById(id);
}

function parseJwt(token) {
  try {
    return JSON.parse(atob(token.split(".")[1]));
  } catch {
    return null;
  }
}

function isEmail(v) {
  return v.includes("@");
}

function normalizePhone(v) {
  v = v.replace(/\s+/g, "");
  if (v.startsWith("0")) return "233" + v.slice(1);
  return v;
}

async function safeJson(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

/* =========================
   CLEAN SESSION (LOGIN ONLY)
========================= */
function clearAllAuth() {
  localStorage.removeItem("driver_token");
  localStorage.removeItem("rider_token");
  localStorage.removeItem("admin_token");
}

/* =========================
   UI: TABS (AUTH PAGE)
========================= */
if (IS_AUTH_PAGE) {
  const loginTab = get("loginTab");
  const signupTab = get("signupTab");
  const loginForm = get("loginForm");
  const signupForm = get("signupForm");

  window.showLogin = () => {
    loginTab?.classList.add("active");
    signupTab?.classList.remove("active");
    loginForm?.classList.add("active");
    signupForm?.classList.remove("active");
  };

  window.showSignup = () => {
    signupTab?.classList.add("active");
    loginTab?.classList.remove("active");
    signupForm?.classList.add("active");
    loginForm?.classList.remove("active");
  };

  loginTab && (loginTab.onclick = showLogin);
  signupTab && (signupTab.onclick = showSignup);
}

/* =========================
   LOGIN
========================= */
if (IS_AUTH_PAGE) {
  window.login = async () => {
    const identifier = get("loginIdentifier")?.value.trim();
    const password = get("loginPassword")?.value;

    if (!identifier || !password) {
      alert("Email/Phone and password required");
      return;
    }

    clearAllAuth(); // only here

    const payload = { password };
    isEmail(identifier)
      ? payload.email = identifier
      : payload.phone = normalizePhone(identifier);

    let res;
    try {
      res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      alert("Network error");
      return;
    }

    const data = await safeJson(res);
    if (!res.ok || !data?.access_token) {
      alert(data?.detail || "Login failed");
      return;
    }

    const token = data.access_token;
    const jwt = parseJwt(token);
    const role = jwt?.role;

    if (!role) {
      alert("Invalid login token");
      return;
    }

    /* ===== ROLE ROUTING ===== */

    if (role === "driver") {
      localStorage.setItem("driver_token", token);

      const s = await fetch(`${API_BASE}/drivers/me/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const d = await safeJson(s);
      const st = String(d?.status || "").toLowerCase();

      if (st === "approved") return location.href = "driver.html";
      if (st === "pending" || st === "approved_pending_activation")
        return location.href = "driver-pending.html";
      if (st === "rejected") return location.href = "driver-rejected.html";

      return location.href = "driver-onboarding.html";
    }

    if (role === "admin") {
      localStorage.setItem("admin_token", token);
      return location.href = "admin.html";
    }

    // rider (default)
    localStorage.setItem("rider_token", token);
    location.href = "rider.html";
  };
}

/* ===================== TABS ===================== */
loginTab.onclick=()=>{
  loginTab.classList.add("active");
  signupTab.classList.remove("active");
  loginForm.classList.add("active");
  signupForm.classList.remove("active");
};
signupTab.onclick=()=>{
  signupTab.classList.add("active");
  loginTab.classList.remove("active");
  signupForm.classList.add("active");
  loginForm.classList.remove("active");
};

/* ===================== PHONE AUTO FORMAT ===================== */
signupIdentifier.addEventListener("input",()=>{
  let v = signupIdentifier.value.replace(/\D/g,"");
  if(v.startsWith("0")) signupIdentifier.value="233"+v.slice(1);
});

/* =========================
   SIGNUP (DUPLICATE SAFE)
========================= */
if (IS_AUTH_PAGE) {
  window.signup = async () => {
    const full_name = get("signupFullName")?.value.trim();
    const identifier = get("signupIdentifier")?.value.trim();
    const password = get("signupPassword")?.value;
    const role = get("signupRole")?.value;

    if (!full_name || !identifier || !password || !role) {
      alert("All fields required");
      return;
    }

    const payload = { full_name, password, role };

    if (isEmail(identifier)) {
      payload.email = identifier;
    } else {
      payload.phone = normalizePhone(identifier);
      localStorage.setItem("pending_phone", payload.phone);
    }

    let res;
    try {
      res = await fetch(`${API_BASE}/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      alert("Network error");
      return;
    }

    const data = await safeJson(res);

    if (!res.ok) {
      // ✅ Duplicate handling
      if (
        data?.detail?.toLowerCase().includes("exists") ||
        data?.detail?.toLowerCase().includes("duplicate")
      ) {
        alert("Account already exists. Please login.");
        showLogin();
        return;
      }

      alert(data?.detail || "Signup failed");
      return;
    }

    // success
    get("signupFullName").value = "";
    get("signupIdentifier").value = "";
    get("signupPassword").value = "";
    get("signupRole").value = "rider";

    if (payload.phone) {
      location.href = "verify-otp.html";
    } else {
      alert("Account created. Check your email to verify.");
      showLogin();
    }
  };
}
