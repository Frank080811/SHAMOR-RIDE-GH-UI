// js/payment.js

import { API_BASE_URL, PAYSTACK_PUBLIC_KEY, auth } from "./config.js";

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
    amount: Math.round(amount * 100),
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

export async function createRide(paymentRef) {
  try {
    const res = await fetch(`${API_BASE_URL}/rides/request`, {
      method: "POST",
      headers: auth(),
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
      alert(data.detail || "Ride creation failed");
      confirmBtn.disabled = false;
      return;
    }

    alert("🚕 Ride requested successfully!");
    startDriverTracking(data.id);

  } catch (err) {
    console.error(err);
    alert("Backend not reachable");
    confirmBtn.disabled = false;
  }
}
