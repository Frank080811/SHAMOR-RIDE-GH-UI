// js/driver_guard.js
import { API_BASE } from "./config.js";

/**
 * Driver page guard
 * Enforces:
 * - logged in
 * - role === driver
 * - correct onboarding status
 *
 * Uses SINGLE SOURCE OF TRUTH:
 *   localStorage.access_token
 */

export async function enforceDriverFlow() {
  const token = localStorage.getItem("access_token");

  // 🚫 Not logged in
  if (!token) {
    location.replace("auth.html");
    return;
  }

  // 🔒 HARD ROLE CHECK (frontend)
  let payload;
  try {
    payload = JSON.parse(atob(token.split(".")[1]));
    if (payload.role !== "driver") {
      throw new Error("Not a driver");
    }
  } catch {
    localStorage.removeItem("access_token");
    location.replace("auth.html");
    return;
  }

  // 🔍 Verify driver status from backend (SOURCE OF TRUTH)
  let res;
  try {
    res = await fetch(`${API_BASE}/drivers/me/status`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    location.replace("auth.html");
    return;
  }

  if (!res.ok) {
    location.replace("auth.html");
    return;
  }

  const data = await res.json();
  const status = String(data.status || "").toLowerCase();

  // 🚦 Enforce correct flow
  switch (status) {
    case "not_started":
    case "in_progress":
      location.replace("driver-onboarding.html");
      break;

    case "pending":
    case "approved_pending_activation":
      location.replace("driver-pending.html");
      break;

    case "approved":
      // ✅ allowed to stay on driver.html
      break;

    case "rejected":
      location.replace("driver-rejected.html");
      break;

    default:
      location.replace("auth.html");
  }
}
