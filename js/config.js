/* =========================
   ENV DETECTION
========================= */
const IS_PROD =
  typeof window !== "undefined" &&
  window.location &&
  window.location.hostname !== "localhost" &&
  window.location.hostname !== "127.0.0.1";

/* =========================
   API BASE URLs
========================= */
export const API_BASE = IS_PROD
  ? "https://shamor-ride-gh.onrender.com"
  : "http://localhost:8000";

export const API_BASE_URL = API_BASE;

/* =========================
   WEBSOCKET BASE URL
========================= */
export const WS_BASE = IS_PROD
  ? "wss://shamor-ride-gh.onrender.com"
  : "ws://localhost:8000";

/* =========================
   PAYSTACK CONFIG
========================= */
export const PAYSTACK_PUBLIC_KEY =
  "pk_test_51SfaqWPxKebzwItyyTLjuEPRKjPoIK0KcAwfjkab60b3hOJytCTGyep1JSvqiuA5zivFEXDw8BpWMNEkvZIsbfs800mTLS5m2m";

/* =========================
   ENV FLAGS
========================= */
export const IS_TESTING = !IS_PROD;

/* ======================================================
   🔐 AUTH TOKEN HELPERS (ROLE-SAFE)
   🚫 NO shared access_token anymore
====================================================== */

/* ---------- DRIVER ---------- */
export function getDriverToken() {
  return localStorage.getItem("driver_token");
}

/* ---------- RIDER ---------- */
export function getRiderToken() {
  return localStorage.getItem("rider_token");
}

/* ---------- REFRESH (OPTIONAL / SHARED) ---------- */
export function getRefreshToken() {
  return localStorage.getItem("refresh_token");
}

/* ======================================================
   🔑 AUTH HEADERS (ROLE-AWARE)
====================================================== */

/* ---------- DRIVER HEADERS ---------- */
export function authDriver(extra = {}) {
  const token = getDriverToken();

  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "Content-Type": "application/json",
    ...extra,
  };
}

/* ---------- RIDER HEADERS ---------- */
export function authRider(extra = {}) {
  const token = getRiderToken();

  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    "Content-Type": "application/json",
    ...extra,
  };
}
