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

export const API_BASE_URL = API_BASE; // alias for consistency

/* =========================
   WEBSOCKET BASE URL
   🔥 AUTO FIXES ws / wss
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
