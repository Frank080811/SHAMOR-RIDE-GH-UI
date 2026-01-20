/* =========================
   auth.js (FINAL — ROLE SAFE + BACKWARD COMPATIBLE)
========================= */
import { API_BASE } from "./config.js";

console.log("auth.js loaded — v4 (stable)");

// =========================
// HELPERS
// =========================
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

async function safeJson(res) {
  const text = await res.text();
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// =========================
// CLEAN SESSION
// =========================
function clearAllAuth() {
  localStorage.removeItem("access_token"); // ⚠️ kept for backend compatibility
  localStorage.removeItem("driver_token");
  localStorage.removeItem("rider_token");
  localStorage.removeItem("admin_token");
}

// =========================
// UI HELPERS
// =========================
window.togglePassword = (id) => {
  const el = get(id);
  if (el) el.type = el.type === "password" ? "text" : "password";
};

window.showLogin = () => {
  get("tabs").classList.remove("signup");
  get("loginForm").classList.add("active");
  get("signupForm").classList.remove("active");
};

window.showSignup = () => {
  get("tabs").classList.add("signup");
  get("signupForm").classList.add("active");
  get("loginForm").classList.remove("active");
};

// =========================
// LOGIN (FIXED)
// =========================
window.login = async () => {
  const email = get("loginEmail").value.trim();
  const password = get("loginPassword").value;

  if (!email || !password) {
    alert("Email and password required");
    return;
  }

  clearAllAuth();

  let res;
  try {
    res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
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
  const payload = parseJwt(token);
  const role = payload?.role;

  if (!role) {
    alert("Invalid token received");
    return;
  }

  // 🔥 BACKWARD COMPATIBILITY TOKEN
  localStorage.setItem("access_token", token);

  // =========================
  // ROLE-ISOLATED STORAGE
  // =========================
  if (role === "driver") {
    localStorage.setItem("driver_token", token);

    const statusRes = await fetch(`${API_BASE}/drivers/me/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    const statusData = await safeJson(statusRes);
    const status = statusData?.status;

    if (status === "approved") location.href = "driver.html";
    else if (status === "pending") location.href = "driver-pending.html";
    else if (status === "rejected") location.href = "driver-rejected.html";
    else location.href = "driver-onboarding.html";
    return;
  }

  if (role === "rider") {
    localStorage.setItem("rider_token", token);
    location.href = "rider.html";
    return;
  }

  if (role === "admin") {
    localStorage.setItem("admin_token", token);
    location.href = "admin.html";
    return;
  }

  alert("Unknown user role");
};

// =========================
// SIGNUP
// =========================
window.signup = async () => {
  const email = get("emailInput").value.trim();
  const full_name = get("full_nameInput").value.trim();
  const password = get("passwordInput").value;
  const role = get("roleSelect").value;

  if (!email || !full_name || !password) {
    alert("All fields required");
    return;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}/auth/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, full_name, password, role }),
    });
  } catch {
    alert("Network error");
    return;
  }

  const data = await safeJson(res);

  if (!res.ok) {
    alert(data?.detail || "Signup failed");
    return;
  }

  alert("Account created! Check your email to verify.");
};
