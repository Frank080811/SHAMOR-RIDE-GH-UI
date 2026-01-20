// js/payment.js (RIDER SAFE)

import {
  API_BASE_URL,
  PAYSTACK_PUBLIC_KEY,
  getRiderToken,
  authRider
} from "./config.js";

/* =========================
   PAYSTACK
========================= */
export function payWithPaystack({ amount, email, onSuccess }) {
  if (!window.PaystackPop) {
    alert("Payment system not loaded");
    return;
  }

  if (!PAYSTACK_PUBLIC_KEY) {
    alert("Payment key not configured");
    return;
  }

  PaystackPop.setup({
    key: PAYSTACK_PUBLIC_KEY,
    email,
    amount: Math.round(amount * 100), // kobo
    currency: "GHS",

    callback(response) {
      console.log("✅ Payment success:", response.reference);
      onSuccess(response.reference);
    },

    onClose() {
      alert("Payment cancelled");
    }
  }).openIframe();
}

/* =========================
   CREATE RIDE (RIDER ONLY)
========================= */
export async function createRide({
  pickupCoords,
  dropoffCoords,
  fare,
  paymentRef,
  confirmBtn,
  startDriverTracking
}) {
  const token = getRiderToken();

  if (!token) {
    alert("Rider login required");
    location.href = "/login.html";
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/rides/request`, {
      method: "POST",
      headers: authRider(),
      body: JSON.stringify({
        pickup_lat: pickupCoords.lat,
        pickup_lng: pickupCoords.lng,
        dropoff_lat: dropoffCoords.lat,
        dropoff_lng: dropoffCoords.lng,
        estimated_fare: fare,
        payment_reference: paymentRef
      })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data?.detail || "Ride creation failed");
      confirmBtn && (confirmBtn.disabled = false);
      return;
    }

    alert("🚕 Ride requested successfully!");
    startDriverTracking?.(data.ride_id);

  } catch (err) {
    console.error("❌ Ride request error:", err);
    alert("Backend not reachable");
    confirmBtn && (confirmBtn.disabled = false);
  }
}
