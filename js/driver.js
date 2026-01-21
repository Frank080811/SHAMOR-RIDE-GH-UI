/* =========================
   DRIVER DASHBOARD (FINAL — RING + RIDER DETAILS)
========================= */
import {
  API_BASE,
  WS_BASE,
  getDriverToken,
  authDriver
} from "./config.js";

/* =========================
   AUTH
========================= */
function getValidDriverToken() {
  const t = getDriverToken();
  if (!t) return null;

  try {
    const payload = JSON.parse(atob(t.split(".")[1]));
    if (payload.role !== "driver") throw new Error("Wrong role");
    return t;
  } catch {
    localStorage.removeItem("driver_token");
    return null;
  }
}

let token = getValidDriverToken();
if (!token) {
  location.replace("index.html");
  throw new Error("Driver not authenticated");
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
let reconnectTimer = null;
let heartbeatTimer = null;

/* =========================
   🔔 RING SOUND
========================= */
const ringAudio = new Audio("/sounds/ride-request.mp3");
ringAudio.loop = true;

/* =========================
   MAP INIT
========================= */
map = L.map("map").setView([6.8970, -1.5250], 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

/* =========================
   DRIVER WEBSOCKET
========================= */
function connectWS() {
  if (ws) ws.close();
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (heartbeatTimer) clearInterval(heartbeatTimer);

  token = getValidDriverToken();
  if (!token) {
    location.replace("index.html");
    return;
  }

  ws = new WebSocket(`${WS_BASE}/tracking/ws/driver?token=${token}`);

  ws.onopen = () => {
    console.log("✅ DRIVER WS CONNECTED");
    driverStatus.innerText = "📡 Online — waiting for rides";

    heartbeatTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send("ping");
      }
    }, 20000);
  };

  ws.onmessage = e => {
    let msg;
    try {
      msg = JSON.parse(e.data);
    } catch {
      return;
    }

    console.log("📩 DRIVER EVENT:", msg);

    if (msg.type !== "ride.requested") return;
    if (currentRide) return;

    // 🔔 RING
    ringAudio.currentTime = 0;
    ringAudio.play().catch(() => {});

    currentRide = {
      ride_id: msg.ride_id,
      pickup_lat: msg.pickup_lat,
      pickup_lng: msg.pickup_lng,
      dropoff_lat: msg.dropoff_lat,
      dropoff_lng: msg.dropoff_lng,
      fare: msg.fare,
      rider: msg.rider // ✅ RIDER DETAILS
    };

    showRide(currentRide);
  };

  ws.onclose = () => {
    console.warn("⚠️ DRIVER WS CLOSED — reconnecting");
    driverStatus.innerText = "⚠️ Reconnecting…";

    if (heartbeatTimer) clearInterval(heartbeatTimer);
    reconnectTimer = setTimeout(connectWS, 3000);
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
        icon: L.divIcon({ html: "🚗", className: "car-marker" })
      }).addTo(map);
    } else {
      marker.setLatLng([latitude, longitude]);
    }

    map.setView([latitude, longitude], 15);

    fetch(`${API_BASE}/tracking/driver`, {
      method: "POST",
      headers: authDriver(),
      body: JSON.stringify({ lat: latitude, lng: longitude, heading, speed })
    }).catch(() => {});
  },
  () => showToast("📡 GPS unavailable"),
  { enableHighAccuracy: true }
);

/* =========================
   SHOW RIDE (WITH RIDER INFO)
========================= */
function showRide(ride) {
  rideInfo.innerHTML = `
    🚕 <b>New Ride Request</b><br><br>

    👤 <b>Rider:</b> ${ride.rider?.name || "Unknown"}<br>
    📞 <b>Phone:</b> ${ride.rider?.phone || "—"}<br>
    ⭐ <b>Rating:</b> ${ride.rider?.rating ?? "4.5"}<br><br>

    📍 <b>Pickup:</b> ${ride.pickup_lat}, ${ride.pickup_lng}<br>
    🏁 <b>Dropoff:</b> ${ride.dropoff_lat}, ${ride.dropoff_lng}<br><br>

    💰 <b>Fare:</b> ₵${ride.fare}
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
    headers: authDriver()
  });

  rideCard.classList.add("hidden");
  startBtn.classList.remove("hidden");
  driverStatus.innerText = "🧭 Heading to pickup";
};

startBtn.onclick = async () => {
  await fetch(`${API_BASE}/rides/${currentRide.ride_id}/start`, {
    method: "POST",
    headers: authDriver()
  });

  startBtn.classList.add("hidden");
  endBtn.classList.remove("hidden");
  driverStatus.innerText = "🚦 Trip started";
};

endBtn.onclick = async () => {
  await fetch(`${API_BASE}/rides/${currentRide.ride_id}/end`, {
    method: "POST",
    headers: authDriver()
  });

  showToast("✅ Trip completed");
  resetState();
};

/* =========================
   EARNINGS
========================= */
async function loadEarnings() {
  const res = await fetch(
    `${API_BASE}/tracking/driver/earnings`,
    { headers: authDriver() }
  );
  if (!res.ok) return;

  const data = await res.json();
  earningsToday.innerText = `₵${data.today}`;
  earningsTotal.innerText = `₵${data.total}`;
}

setInterval(loadEarnings, 20000);
loadEarnings();

/* =========================
   RESET / HELPERS
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
