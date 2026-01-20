// js/push.js (ROLE SAFE)

import { getMessaging, getToken as getFcmToken } from "firebase/messaging";
import {
  API_BASE,
  getDriverToken,
  getRiderToken,
  getAdminToken
} from "./config.js";

/* =========================
   FIREBASE
========================= */
const messaging = getMessaging(firebaseApp);

/* =========================
   RESOLVE ACTIVE TOKEN
========================= */
function getAnyAuthHeader() {
  const token =
    getDriverToken() ||
    getRiderToken() ||
    getAdminToken();

  if (!token) return null;

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

/* =========================
   REGISTER PUSH TOKEN
========================= */
export async function registerPushToken() {
  try {
    const headers = getAnyAuthHeader();
    if (!headers) {
      console.warn("⚠️ Push token skipped — no authenticated user");
      return;
    }

    const fcmToken = await getFcmToken(messaging, {
      vapidKey: VAPID_KEY,
    });

    if (!fcmToken) {
      console.warn("⚠️ No FCM token received");
      return;
    }

    const res = await fetch(`${API_BASE}/users/push-token`, {
      method: "POST",
      headers,
      body: JSON.stringify({ token: fcmToken }),
    });

    if (!res.ok) {
      console.warn("⚠️ Push token rejected");
      return;
    }

    console.log("✅ Push token registered");
  } catch (err) {
    console.error("❌ Push token error:", err);
  }
}
