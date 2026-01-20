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

/* =========================
   WEBSOCKET BASE URL
========================= */
export const WS_BASE = IS_PROD
  ? "wss://shamor-ride-gh.onrender.com"
  : "ws://localhost:8000";

/* =========================
   TOKEN HELPERS (ROLE SAFE)
========================= */
export const getDriverToken = () =>
  localStorage.getItem("driver_token");

export const getRiderToken = () =>
  localStorage.getItem("rider_token");

export const getAdminToken = () =>
  localStorage.getItem("admin_token");

/* =========================
   AUTH HEADERS (ROLE SAFE)
========================= */
export const authDriver = () => {
  const t = getDriverToken();
  return t
    ? {
        "Content-Type": "application/json",
        Authorization: `Bearer ${t}`,
      }
    : {};
};

export const authRider = () => {
  const t = getRiderToken();
  return t
    ? {
        "Content-Type": "application/json",
        Authorization: `Bearer ${t}`,
      }
    : {};
};

export const authAdmin = () => {
  const t = getAdminToken();
  return t
    ? {
        "Content-Type": "application/json",
        Authorization: `Bearer ${t}`,
      }
    : {};
};
