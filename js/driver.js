/* =========================
   CONFIG
========================= */
import { API_BASE, WS_BASE, getToken, auth } from "./config.js";

const token = getToken();
if (!token) location.href = "/login.html";

/* =========================
   DOM ELEMENTS
========================= */
const driverStatus = document.getElementById("driverStatus");
const rideCard = document.getElementById("rideCard");
const rideInfo = document.getElementById("rideInfo");

const acceptBtn = document.getElementById("acceptBtn");
const rejectBtn = document.getElementById("rejectBtn");
const startBtn = document.getElementById("startBtn");
const endBtn = document.getElementById("endBtn");
const navigateBtn = document.getElementById("navigateBtn");
const toggleOnlineBtn = document.getElementById("toggleOnlineBtn");
const sosBtn = document.getElementById("sosBtn");

const earningsToday = document.getElementById("earningsToday");
const earningsTotal = document.getElementById("earningsTotal");

const etaBar = document.getElementById("etaBar");
const etaFill = document.getElementById("etaFill");

const historyBtn = document.getElementById("historyBtn");
const historyPanel = document.getElementById("historyPanel");
const historyList = document.getElementById("historyList");

const toast = document.getElementById("toast");

/* =========================
   STATE
========================= */
let map, marker;
let currentRide = null;
let isOnline = true;
let totalDistanceKm = 0;

/* =========================
   MAP INIT
========================= */
map = L.map("map").setView([6.8970, -1.5250], 13);
L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

/* =========================
   DRIVER WEBSOCKET (FIXED)
========================= */
let driverWS = null;

function startDriverSocket() {
  if (!token) return;

  driverWS = new WebSocket(`${WS_BASE}/tracking/ws/driver?token=${token}`);

  driverWS.onopen = () => {
    console.log("✅ Driver WebSocket connected");
  };

  driverWS.onmessage = e => {
    const msg = JSON.parse(e.data);

    // Future: admin messages / force logout / alerts
    if (msg.type === "force_offline") {
      showToast("⚠️ You have been set offline");
      isOnline = false;
    }
  };

  driverWS.onerror = () => {
    console.error("❌ Driver WebSocket error");
  };

  driverWS.onclose = () => {
    console.warn("⚠️ Driver WebSocket closed, reconnecting...");
    setTimeout(startDriverSocket, 3000);
  };
}

startDriverSocket();

/* =========================
   LIVE GPS TRACKING
========================= */
navigator.geolocation.watchPosition(
  pos => {
    const { latitude, longitude, heading, speed } = pos.coords;

    if (!marker) {
      marker = L.marker([latitude, longitude], {
        icon: L.divIcon({ className: "car-marker", html: "🚗" })
      }).addTo(map);
    } else {
      marker.setLatLng([latitude, longitude]);
      if (heading !== null && marker.getElement()) {
        marker.getElement().style.transform = `rotate(${heading}deg)`;
      }
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

    if (currentRide) updateETAProgress(latitude, longitude);
  },
  () => showToast("📡 GPS error"),
  { enableHighAccuracy: true }
);

/* =========================
   POLL PENDING RIDES (FALLBACK)
========================= */
setInterval(async () => {
  if (!isOnline || currentRide) return;

  const res = await fetch(
    `${API_BASE}/tracking/driver/rides/pending`,
    { headers: auth() }
  );

  if (!res.ok) return;

  const rides = await res.json();
  if (!rides.length) return;

  currentRide = rides[0];
  showRide(currentRide);
}, 5000);

/* =========================
   SHOW RIDE REQUEST
========================= */
async function showRide(ride) {
  const eta = await calculateETA(
    marker.getLatLng(),
    { lat: ride.pickup_lat, lng: ride.pickup_lng }
  );

  totalDistanceKm = eta?.distance_km || 0;

  rideInfo.innerHTML = `
    🚕 <b>New Ride Request</b><br>
    Pickup coordinates: ${ride.pickup_lat}, ${ride.pickup_lng}<br>
    Distance: ${eta?.distance_km || "--"} km<br>
    ETA: ${eta?.eta_min || "--"} min
  `;

  rideCard.classList.remove("hidden");
  navigateBtn.classList.remove("hidden");
  etaBar.classList.remove("hidden");
  driverStatus.innerText = "🚕 Ride request received";
  showToast("🚕 New ride request");
}

/* =========================
   ACCEPT / REJECT
========================= */
acceptBtn.onclick = async () => {
  if (!currentRide) return;

  await fetch(
    `${API_BASE}/tracking/driver/rides/${currentRide.ride_id}/accept`,
    { method: "POST", headers: auth() }
  );

  rideCard.classList.add("hidden");
  startBtn.classList.remove("hidden");
  driverStatus.innerText = "🧭 Heading to pickup";
};

rejectBtn.onclick = async () => {
  if (!currentRide) return;

  await fetch(
    `${API_BASE}/tracking/driver/rides/${currentRide.ride_id}/reject`,
    { method: "POST", headers: auth() }
  );

  resetState();
};

/* =========================
   START / END TRIP
========================= */
startBtn.onclick = async () => {
  await fetch(
    `${API_BASE}/tracking/driver/rides/${currentRide.ride_id}/start`,
    { method: "POST", headers: auth() }
  );

  startBtn.classList.add("hidden");
  endBtn.classList.remove("hidden");
  driverStatus.innerText = "🚦 Trip started";
};

endBtn.onclick = async () => {
  await fetch(
    `${API_BASE}/tracking/driver/rides/${currentRide.ride_id}/end`,
    { method: "POST", headers: auth() }
  );

  showToast("✅ Trip completed");
  resetState();
};

/* =========================
   EARNINGS (FIXED KEYS)
========================= */
async function loadEarnings() {
  const res = await fetch(
    `${API_BASE}/tracking/driver/earnings`,
    { headers: auth() }
  );

  if (!res.ok) return;

  const data = await res.json();
  earningsToday.innerText = `💰 Today: ₵${data.today}`;
  earningsTotal.innerText = `📊 Total: ₵${data.total}`;
}

setInterval(loadEarnings, 20000);
loadEarnings();

/* =========================
   SOS
========================= */
sosBtn.onclick = async () => {
  if (!marker || !confirm("Send emergency alert?")) return;

  const { lat, lng } = marker.getLatLng();

  await fetch(`${API_BASE}/tracking/driver/sos`, {
    method: "POST",
    headers: auth(),
    body: JSON.stringify({ lat, lng })
  });

  showToast("🚨 SOS sent");
};

/* =========================
   UTILITIES
========================= */
function resetState() {
  currentRide = null;
  rideCard.classList.add("hidden");
  startBtn.classList.add("hidden");
  endBtn.classList.add("hidden");
  navigateBtn.classList.add("hidden");
  etaBar.classList.add("hidden");
  etaFill.style.width = "0%";
  driverStatus.innerText = "📡 Online — waiting for rides";
}

function showToast(message, timeout = 2500) {
  toast.innerText = message;
  toast.classList.remove("hidden");
  setTimeout(() => toast.classList.add("hidden"), timeout);
}
