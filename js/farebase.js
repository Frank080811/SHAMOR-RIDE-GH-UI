// js/push.js (or wherever this lives)

import { getMessaging, getToken as getFcmToken } from "firebase/messaging";
import { API_BASE, auth } from "./config.js";

const messaging = getMessaging(firebaseApp);

export async function registerPushToken() {
  try {
    const fcmToken = await getFcmToken(messaging, {
      vapidKey: VAPID_KEY
    });

    if (!fcmToken) return;

    await fetch(`${API_BASE}/users/push-token`, {
      method: "POST",
      headers: auth(),
      body: JSON.stringify({ token: fcmToken })
    });

    console.log("✅ Push token registered");
  } catch (err) {
    console.error("❌ Push token error:", err);
  }
}
