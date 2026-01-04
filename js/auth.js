import { API_BASE } from "./config.js";

console.log("auth.js loaded");

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

// =========================
// GLOBAL FUNCTIONS (for HTML)
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
// LOGIN
// =========================
// =========================
// LOGIN
// =========================
window.login = async () => {
  const email = get("loginEmail").value.trim();
  const password = get("loginPassword").value;

  if (!email || !password) {
    alert("Email and password required");
    return;
  }

  const res = await fetch(`${API_BASE}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.detail || "Login failed");
    return;
  }

  localStorage.setItem("access_token", data.access_token);
  localStorage.setItem("refresh_token", data.refresh_token);

  const payload = parseJwt(data.access_token);
  const role = payload?.role;

  // 👇 DRIVER GUARD
  if (role === "driver") {
    const statusRes = await fetch(`${API_BASE}/drivers/me/status`, {
      headers: {
        Authorization: `Bearer ${data.access_token}`,
      },
    });

    const statusData = await statusRes.json();
    const status = statusData.status;

    if (status === "not_started") {
      location.href = "driver-onboarding.html";
      return;
    }

    if (status === "pending") {
      location.href = "driver-pending.html";
      return;
    }

    if (status === "rejected") {
      location.href = "driver-rejected.html";
      return;
    }

    if (status === "approved") {
      location.href = "driver.html";
      return;
    }

    // fallback safety
    location.href = "driver-onboarding.html";
    return;
  }

  if (role === "admin") {
    location.href = "admin.html";
    return;
  }

  location.href = "rider.html";
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

  const res = await fetch(`${API_BASE}/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, full_name, password, role }),
  });

  const data = await res.json();

  if (!res.ok) {
    alert(data.detail || "Signup failed");
    return;
  }

  alert("Account created! Check your email to verify.");
};
