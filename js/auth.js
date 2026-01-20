/* =========================
   auth.js (FINAL — SAFE & ROLE ISOLATED)
========================= */
import { API_BASE } from "./config.js";

console.log("auth.js loaded — v7 (production safe)");

/* =========================
   PAGE CONTEXT GUARD
========================= */
/**
 * auth.js should ONLY be active on index.html
 * On other pages, it must be inert
 */
const IS_AUTH_PAGE =
  location.pathname.endsWith("/") ||
  location.pathname.endsWith("/index.html");

if (!IS_AUTH_PAGE) {
  // Do NOT attach auth handlers outside login page
  console.log("auth.js inactive on this page");
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
   CLEAN SESSION (MANUAL ONLY)
========================= */
function clearAllAuth() {
  localStorage.removeItem("driver_token");
  localStorage.removeItem("rider_token");
  localStorage.removeItem("admin_token");
}

/* =========================
   UI HELPERS (AUTH PAGE ONLY)
========================= */
if (IS_AUTH_PAGE) {
  window.togglePassword = (id) => {
    const el = get(id);
    if (el) el.type = el.type === "password" ? "text" : "password";
  };

  window.showLogin = () => {
    get("tabs")?.classList.remove("signup");
    get("loginForm")?.classList.add("active");
    get("signupForm")?.classList.remove("active");
  };

  window.showSignup = () => {
    get("tabs")?.classList.add("signup");
    get("signupForm")?.classList.add("active");
    get("loginForm")?.classList.remove("active");
  };
}

/* =========================
   LOGIN (AUTH PAGE ONLY)
========================= */
if (IS_AUTH_PAGE) {
  window.login = async () => {
    const identifier = get("loginIdentifier")?.value.trim();
    const password = get("loginPassword")?.value;

    if (!identifier || !password) {
      alert("Email/Phone and password required");
      return;
    }

    // 🔒 Clear stale session ONLY when user explicitly logs in
    clearAllAuth();

    let res;
    try {
      res = await fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: identifier,
          password
        }),
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

    const token = data.access_token_
