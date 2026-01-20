/* =========================
   CONFIG
========================= */
import { API_BASE, WS_BASE, getToken, auth } from "./config.js";

const token = getToken();
if (!token) location.href = "/login.html";

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
   MAP INIT
========================= */
map = L.map("map").setView([6.8970, -1.5250], 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

/* =========================
   DRIVER WEBSOCKET (FINAL)
========================= */
function connectWS() {
  if (ws) ws.close();
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (heartbeatTimer) clearInterval(heartbeatTimer);

  ws = new WebSocket(`${WS_BASE}/tracking/ws/driver?token=${token}`);

  ws.onopen = () => {
    console.log("✅ Driver WebSocket connected");
    driverStatus.innerText = "📡 Online — waiting for rides";

    // 🔁 Start heartbeat ONLY after connection opens
    heartbeatTimer = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send("ping");
      }
    }, 20000);
  };

  ws.onmessage = e => {
    const msg = JSON.parse(e.data);
    console.log("📩 WS message:", msg);

    if (msg.type !== "ride.requested") return;
    if (currentRide) return;

    currentRide = {
      ride_id: msg.ride_id,
      pickup_lat: msg.pickup_lat,
      pickup_lng: msg.pickup_lng,
      dropoff_lat: msg.dropoff_lat,
      dropoff_lng: msg.dropoff_lng,
      fare: msg.fare
    };

    showRide(currentRide);
  };

  ws.onclose = () => {
    console.warn("⚠️ Driver WS closed — reconnecting");
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
      headers: auth(),
      body: JSON.stringify({
        lat: latitude,
        lng: longitude,
        heading,
        speed
      })
    });
  },
  () => showToast("📡 GPS error"),
  { enableHighAccuracy: true }
);

/* =========================
   SHOW RIDE REQUEST
========================= */
function showRide(ride) {
  rideInfo.innerHTML = `
    🚕 <b>New Ride Request</b><br>
    Pickup: ${ride.pickup_lat}, ${ride.pickup_lng}<br>
    Dropoff: ${ride.dropoff_lat}, ${ride.dropoff_lng}<br>
    Fare: ₵${ride.fare}
  `;

  rideCard.classList.remove("hidden");
  driverStatus.innerText = "🚕 Ride request received";
  showToast("🚕 New ride request");
}

/* =========================
   ACCEPT RIDE
========================= */
acceptBtn.onclick = async () => {
  if (!currentRide) return;

  await fetch(`${API_BASE}/rides/${currentRide.ride_id}/accept`, {
    method: "POST",
    headers: auth()
  });

  rideCard.classList.add("hidden");
  startBtn.classList.remove("hidden");
  driverStatus.innerText = "🧭 Heading to pickup";
};

/* =========================
   START RIDE
========================= */
startBtn.onclick = async () => {
  await fetch(`${API_BASE}/rides/${currentRide.ride_id}/start`, {
    method: "POST",
    headers: auth()
  });

  startBtn.classList.add("hidden");
  endBtn.classList.remove("hidden");
  driverStatus.innerText = "🚦 Trip started";
};

/* =========================
   END RIDE
========================= */
endBtn.onclick = async () => {
  await fetch(`${API_BASE}/rides/${currentRide.ride_id}/end`, {
    method: "POST",
    headers: auth()
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
    { headers: auth() }
  );
  if (!res.ok) return;

  const data = await res.json();
  earningsToday.innerText = `₵${data.today}`;
  earningsTotal.innerText = `₵${data.total}`;
}

setInterval(loadEarnings, 20000);
loadEarnings();

/* =========================
   RESET
========================= */
function resetState() {
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
