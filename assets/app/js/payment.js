// js/payment.js
import { API } from "./config.js";

export function payWithPaystack({ amount, email, onSuccess }) {
  if (!window.PaystackPop) {
    alert("Payment system not loaded");
    return;
  }

  PaystackPop.setup({
    key: "pk_test_51SfaqWPxKebzwItyyTLjuEPRKjPoIK0KcAwfjkab60b3hOJytCTGyep1JSvqiuA5zivFEXDw8BpWMNEkvZIsbfs800mTLS5m2m",
    email,
    amount: Math.round(amount * 100),
    currency: "GHS",

    callback(response) {
      console.log("Payment success:", response.reference);
      onSuccess(response.reference);
    },

    onClose() {
      alert("Payment cancelled");
    }
  }).openIframe();
}


  async function createRide(paymentRef) {
    try {
      const res = await fetch(`${API}/rides/request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`
        },
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
  