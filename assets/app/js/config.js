// js/config.js

// export const API_BASE = "http://localhost:8000";
// export const WS_BASE = "ws://localhost:8000/ws";
export const API_BASE_URL = "https://shamor-ride-gh.onrender.com";
export const WS_BASE_URL = "wss://shamor-ride-gh.onrender.com";

// Testing flags
export const IS_TESTING = true;



export function getToken() {
  return localStorage.getItem("access_token");
}
