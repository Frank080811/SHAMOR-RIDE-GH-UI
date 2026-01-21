// js/driver_guard.js
import { API_BASE } from "./config.js";

/**
 * Driver page guard (FINAL — SAFE MULTI-PAGE)
 *
 * Enforces:
 * - logged in
 * - role === driver
 * - correct page based on onboarding status
 *
 * SINGLE SOURCE OF TRUTH:
 *   localStorage.access_token
 */

export async function enforceDriverFlow() {
  const token = localStorage.getItem("access_token");
  const currentPage = location.pathname.split("/").pop();

  /* =========================
     NOT LOGGED IN
  ========================= */
  if (!token) {
    location.replace("auth.html");
    return;
  }

  /* =========================
     FRONTEND ROLE CHECK
  ========================= */
  let payload;
  try {
    payload = JSON.parse(atob(token.split(".")[1]));
    if (payload.role !== "driver") {
      throw new Error("Not driver");
    }
  } catch {
    localStorage.removeItem("access_token");
    location.replace("auth.html");
    return;
  }

  /* =========================
     BACKEND STATUS CHECK
  ========================= */
  let res;
  try {
    res = await fetch(`${API_BASE}/drivers/me/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  } catch {
    location.replace("auth.html");
    return;
  }

  if (!res.ok) {
    location.replace("auth.html");
    return;
  }

  const { status } = await res.json();
  const s = String(status || "").toLowerCase();

  /* =========================
     STATUS → PAGE MAPPING
  ========================= */
  let expectedPage;

  switch (s) {
    case "not_started":
    case "in_progress":
      expectedPage = "driver-onboarding.html";
      break;

    case "pending":
    case "approved_pending_activation":
      expectedPage = "driver-pending.html";
      break;

    case "approved":
      expectedPage = "driver.html";
      break;

    case "rejected":
      expectedPage = "driver-rejected.html";
      break;

    default:
      location.replace("auth.html");
      return;
  }

  /* =========================
     ONLY REDIRECT IF NEEDED
  ========================= */
  if (currentPage !== expectedPage) {
    location.replace(expectedPage);
  }
}
