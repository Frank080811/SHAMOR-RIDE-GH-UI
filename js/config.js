// js/config.js

// ===== API BASE URL =====
export const API_BASE = "https://shamor-rides-frontend.onrender.com";

// js/config.js
export const API_BASE_URL = "https://shamor-rides-frontend.onrender.com";


// ===== WEBSOCKET BASE URL =====
export const WS_BASE = "wss://shamor-ride-gh.onrender.com";

// ===== PAYSTACK (STATIC SITE FIX) =====
export const PAYSTACK_PUBLIC_KEY = "pk_test_51SfaqWPxKebzwItyyTLjuEPRKjPoIK0KcAwfjkab60b3hOJytCTGyep1JSvqiuA5zivFEXDw8BpWMNEkvZIsbfs800mTLS5m2m";

// ===== ENV FLAGS =====
export const IS_TESTING = true;

// ===== AUTH TOKEN HELPER =====
export function getToken() {
  return localStorage.getItem("access_token");
}

// ===== AUTH HEADER HELPER =====
export function auth() {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token && { Authorization: `Bearer ${token}` })
  };
}
