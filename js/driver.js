/* =========================
   DRIVER DASHBOARD (FINAL — SINGLE TOKEN + DRIVER GUARD)
========================= */
import { API_BASE, WS_BASE } from "./config.js";
import { enforceDriverFlow } from "./driver_guard.js";

/* =========================
   DRIVER GUARD (MANDATORY)
========================= */
await enforceDriverFlow();

/* =========================
   TOKEN (PASSIVE READ ONLY)
========================= */
const token = localStorage.getItem("access_token");

/* =========================
   AUTH HEADER
========================= */
function auth() {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };
}

/* =========================
   DOM
========================= */
const driverStatus = document.getElementById("driverStatus");
const rideCard = document.getElementById("rideCard");
const rideInfo = document.getElementById("rideInfo");

const acceptBtn = document.getElementById("acceptBtn");
const startBtn = document.getElementById("startBtn");
const endBtn = document.getElementById("endBtn");

const earningsToday = document.getElementById("earningsToday");
const earningsTotal = document.getElementById("earningsTotal");
const toast = document.getElementById("toast");

/* =========================
   STATE
========================= */
let map, marker;
let currentRide = null;
let ws = null;
let heartbeatTimer = null;

/* =========================
   🔔 RING SOUND
========================= */
const ringAudio = new Audio("/sounds/ride-request.mp3");
ringAudio.loop = true;

/* =========================
   MAP INIT
========================= */
map = L.map("map").setView([6.897, -1.525], 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

/* =========================
   DRIVER WEBSOCKET
========================= */
function connectWS() {
  ws = new WebSocket(`${WS_BASE}/tracking/ws/driver?token=${token}`);

  ws.onopen = () => {
    console.log("✅ DRIVER WS CONNECTED");
    driverStatus.innerText = "📡 Online — waiting for rides";

    heartbeatTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) ws.send("ping");
    }, 20000);
  };

  ws.onmessage = e => {
    let msg;
    try {
      msg = JSON.parse(e.data);
    } catch {
      return;
    }

    if (msg.type !== "ride.requested" || currentRide) return;

    ringAudio.currentTime = 0;
    ringAudio.play().catch(() => {});

    currentRide = msg;
    showRide(msg);
  };

  ws.onclose = () => {
    clearInterval(heartbeatTimer);
    setTimeout(connectWS, 3000);
  };

  ws.onerror = () => ws.close();
}

connectWS();

/* =========================
   LIVE GPS
========================= */
navigator.geolocation.watchPosition(
  pos => {
    const { latitude, longitude, heading, speed } = pos.coords;

    if (!marker) {
      marker = L.marker([latitude, longitude], {
        icon: L.divIcon({ html: "🚗", className: "car-marker" }),
      }).addTo(map);
    } else {
      marker.setLatLng([latitude, longitude]);
    }

    fetch(`${API_BASE}/tracking/driver`, {
      method: "POST",
      headers: auth(),
      body: JSON.stringify({ lat: latitude, lng: longitude, heading, speed }),
    }).catch(() => {});
  },
  () => showToast("📡 GPS unavailable"),
  { enableHighAccuracy: true }
);

/* =========================
   SHOW RIDE
========================= */
function showRide(r) {
  rideInfo.innerHTML = `
    <b>New Ride</b><br><br>
    Pickup: ${r.pickup_lat}, ${r.pickup_lng}<br>
    Dropoff: ${r.dropoff_lat}, ${r.dropoff_lng}<br>
    Fare: ₵${r.fare}
  `;
  rideCard.classList.remove("hidden");
  driverStatus.innerText = "🚕 Ride request received";
}

/* =========================
   ACCEPT / START / END
========================= */
acceptBtn.onclick = async () => {
  if (!currentRide) return;
  stopRing();

  await fetch(`${API_BASE}/rides/${currentRide.ride_id}/accept`, {
    method: "POST",
    headers: auth(),
  });

  rideCard.classList.add("hidden");
  startBtn.classList.remove("hidden");
};

startBtn.onclick = async () => {
  await fetch(`${API_BASE}/rides/${currentRide.ride_id}/start`, {
    method: "POST",
    headers: auth(),
  });

  startBtn.classList.add("hidden");
  endBtn.classList.remove("hidden");
};

endBtn.onclick = async () => {
  await fetch(`${API_BASE}/rides/${currentRide.ride_id}/end`, {
    method: "POST",
    headers: auth(),
  });

  resetState();
};

/* =========================
   EARNINGS
========================= */
async function loadEarnings() {
  const res = await fetch(`${API_BASE}/tracking/driver/earnings`, {
    headers: auth(),
  });
  if (!res.ok) return;

  const data = await res.json();
  earningsToday.innerText = `₵${data.today}`;
  earningsTotal.innerText = `₵${data.total}`;
}

setInterval(loadEarnings, 20000);
loadEarnings();

/* =========================
   HELPERS
========================= */
function stopRing() {
  ringAudio.pause();
  ringAudio.currentTime = 0;
}

function resetState() {
  stopRing();
  currentRide = null;
  rideCard.classList.add("hidden");
  startBtn.classList.add("hidden");
  endBtn.classList.add("hidden");
  driverStatus.innerText = "📡 Online — waiting for rides";
}

function showToast(msg, t = 2500) {
  toast.innerText = msg;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), t);
}
