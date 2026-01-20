// js/driver_guard.js
import { API_BASE, getDriverToken } from "./config.js";

export async function enforceDriverFlow() {
  const token = getDriverToken();

  // 🔒 No driver token → login
  if (!token) {
    location.replace("index.html");
    return;
  }

  // 🔒 HARD ROLE CHECK
  let payload;
  try {
    payload = JSON.parse(atob(token.split(".")[1]));
    if (payload.role !== "driver") {
      throw new Error("Not a driver");
    }
  } catch {
    localStorage.removeItem("driver_token");
    location.replace("index.html");
    return;
  }

  // 🔍 Verify driver onboarding status from backend
  let res;
  try {
    res = await fetch(`${API_BASE}/drivers/me/status`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    location.replace("index.html");
    return;
  }

  if (!res.ok) {
    location.replace("index.html");
    return;
  }

  const data = await res.json();

  // 🚦 Enforce correct driver flow
  switch (data.status) {
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
      location.replace("login.html");
  }
}
