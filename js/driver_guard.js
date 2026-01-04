// js/driver_guard.js
import { API_BASE } from "./config.js";

export async function enforceDriverFlow() {
  const token = localStorage.getItem("access_token");
  if (!token) location.href = "auth.html";

  const res = await fetch(`${API_BASE}/drivers/me/status`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  if (!res.ok) {
    location.href = "auth.html";
    return;
  }

  const data = await res.json();

  switch (data.status) {
    case "not_started":
    case "in_progress":
      location.href = "driver-onboarding.html";
      break;

    case "pending":
    case "approved_pending_activation":
      location.href = "driver-pending.html";
      break;

    case "approved":
      // allowed
      break;

    case "rejected":
      location.href = "driver-rejected.html";
      break;

    default:
      location.href = "auth.html";
  }
}
