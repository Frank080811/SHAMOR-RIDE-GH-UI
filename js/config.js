/* =========================
   ENV DETECTION
========================= */
const IS_PROD =
  typeof window !== "undefined" &&
  window.location &&
  !["localhost", "127.0.0.1"].includes(window.location.hostname);

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
   TOKEN HELPERS (SINGLE SOURCE OF TRUTH)
========================= */
export const getToken = () =>
  localStorage.getItem("access_token");

/* =========================
   AUTH HEADERS (UNIFIED)
========================= */
export const auth = (extra = {}) => {
  const token = getToken();

  return {
    "Content-Type": "application/json",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
};
