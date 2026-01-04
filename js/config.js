// js/config.js

/* =========================
   API BASE URLs
========================= */
export const API_BASE = "https://shamor-ride-gh.onrender.com";
export const API_BASE_URL = API_BASE; // alias for consistency

/* =========================
   WEBSOCKET BASE URL
========================= */
export const WS_BASE = "wss://shamor-ride-gh.onrender.com";

/* =========================
   PAYSTACK CONFIG
========================= */
export const PAYSTACK_PUBLIC_KEY =
  "pk_test_51SfaqWPxKebzwItyyTLjuEPRKjPoIK0KcAwfjkab60b3hOJytCTGyep1JSvqiuA5zivFEXDw8BpWMNEkvZIsbfs800mTLS5m2m";

/* =========================
   ENV FLAGS
========================= */
export const IS_TESTING = true;

/* =========================
   AUTH TOKEN HELPERS
========================= */
export function getToken() {
  return localStorage.getItem("access_token");
}

export function getRefreshToken() {
  return localStorage.getItem("refresh_token");
}

/* =========================
   AUTH HEADER HELPERS
========================= */
export function authHeaders(extra = {}) {
  const token = getToken();

  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

/* =========================
   JSON AUTH HEADERS (COMMON)
========================= */
export function auth() {
  return authHeaders({
    "Content-Type": "application/json",
  });
}
