// js/driver.js
const API = "https://shamor-ride-gh.onrender.com";
const token = localStorage.getItem("access_token");

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
   LIVE GPS TRACKING
========================= */
navigator.geolocation.watchPosition(
  pos => {
    const { latitude, longitude, heading, speed } = pos.coords;

    if (!marker) {
      marker = L.marker([latitude, longitude], {
        icon: L.divIcon({
          className: "car-marker",
          html: "🚗"
        })
      }).addTo(map);
    } else {
      marker.setLatLng([latitude, longitude]);
      if (heading !== null) {
        marker.getElement().style.transform = `rotate(${heading}deg)`;
      }
    }

    map.setView([latitude, longitude], 15);

    fetch(`${API}/tracking/driver`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ lat: latitude, lng: longitude, heading, speed })
    });

    if (currentRide) updateETAProgress(latitude, longitude);
  },
  err => showToast("📡 GPS error"),
  { enableHighAccuracy: true }
);

/* =========================
   POLL PENDING RIDES
========================= */
setInterval(async () => {
  if (!isOnline || currentRide) return;

  const res = await fetch(`${API}/tracking/driver/rides/pending`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const rides = await res.json();
  if (!rides.length) return;

  currentRide = rides[0];
  showRide(currentRide);
}, 5000);

/* =========================
   SHOW RIDE
========================= */
async function showRide(ride) {
  const eta = await calculateETA(
    { lat: marker.getLatLng().lat, lng: marker.getLatLng().lng },
    { lat: ride.pickup_lat, lng: ride.pickup_lng }
  );

  totalDistanceKm = eta?.distance_km || 0;

  rideInfo.innerHTML = `
    🚕 <b>New Ride Request</b><br>
    Pickup: ${ride.pickup_name || "Assigned Point"}<br>
    Drop-off: ${ride.dropoff_name || "Assigned Point"}<br>
    Distance: ${eta?.distance_km || "--"} km<br>
    ETA: ${eta?.eta_min || "--"} min<br>
    Fare: ₵${ride.fare}
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
  await fetch(`${API}/tracking/driver/rides/${currentRide.ride_id}/accept`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });

  rideCard.classList.add("hidden");
  startBtn.classList.remove("hidden");
  driverStatus.innerText = "🧭 Heading to pickup";
};

rejectBtn.onclick = async () => {
  await fetch(`${API}/tracking/driver/rides/${currentRide.ride_id}/reject`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });

  resetState();
};

/* =========================
   START / END TRIP
========================= */
startBtn.onclick = async () => {
  await fetch(`${API}/tracking/driver/rides/${currentRide.ride_id}/start`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });

  startBtn.classList.add("hidden");
  endBtn.classList.remove("hidden");
  driverStatus.innerText = "🚦 Trip started";
};

endBtn.onclick = async () => {
  await fetch(`${API}/tracking/driver/rides/${currentRide.ride_id}/end`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}` }
  });

  showToast("✅ Trip completed");
  resetState();
};

/* =========================
   NAVIGATION
========================= */
navigateBtn.onclick = () => {
  if (!currentRide) return;
  window.open(
    `https://www.google.com/maps/dir/?api=1&destination=${currentRide.pickup_lat},${currentRide.pickup_lng}`,
    "_blank"
  );
};

/* =========================
   ETA PROGRESS
========================= */
async function updateETAProgress(lat, lng) {
  const eta = await calculateETA(
    { lat, lng },
    { lat: currentRide.pickup_lat, lng: currentRide.pickup_lng }
  );

  if (!eta || !totalDistanceKm) return;

  const percent = Math.min(
    100,
    100 - (eta.distance_km / totalDistanceKm) * 100
  );

  etaFill.style.width = `${percent}%`;
}

/* =========================
   ETA CALCULATION
========================= */
async function calculateETA(from, to) {
  const res = await fetch(
    `https://router.project-osrm.org/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=false`
  );
  const data = await res.json();
  if (!data.routes?.length) return null;

  return {
    distance_km: +(data.routes[0].distance / 1000).toFixed(2),
    eta_min: Math.ceil(data.routes[0].duration / 60)
  };
}

/* =========================
   EARNINGS
========================= */
async function loadEarnings() {
  const res = await fetch(`${API}/tracking/driver/earnings`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();

  earningsToday.innerText = `💰 Today: ₵${data.today_earnings}`;
  earningsTotal.innerText = `📊 Total: ₵${data.total_earnings}`;
}
setInterval(loadEarnings, 20000);

/* =========================
   ONLINE / OFFLINE
========================= */
toggleOnlineBtn.onclick = async () => {
  isOnline = !isOnline;

  await fetch(`${API}/tracking/driver/status`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ online: isOnline })
  });

  toggleOnlineBtn.innerText = isOnline ? "Go Offline" : "Go Online";
  driverStatus.innerText = isOnline
    ? "📡 Online — waiting for rides"
    : "⛔ Offline";
};

/* =========================
   SOS
========================= */
sosBtn.onclick = async () => {
  if (!marker || !confirm("Send emergency alert?")) return;

  const { lat, lng } = marker.getLatLng();

  await fetch(`${API}/tracking/driver/sos`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({ lat, lng })
  });

  showToast("🚨 SOS sent");
};

/* =========================
   HISTORY
========================= */
historyBtn.onclick = async () => {
  const res = await fetch(`${API}/tracking/driver/rides/history`, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const rides = await res.json();
  historyList.innerHTML = rides.map(r =>
    `<div class="card">🚕 ₵${r.fare} · ${new Date(r.date).toLocaleDateString()}</div>`
  ).join("");

  historyPanel.classList.toggle("show");
};

/* =========================
   UTIL
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

const ws = new WebSocket(
    `ws://localhost:8000/ws/driver/${driverId}`
  );
  
  navigator.geolocation.watchPosition(pos => {
    ws.send(JSON.stringify({
      lat: pos.coords.latitude,
      lng: pos.coords.longitude,
      heading: pos.coords.heading
    }));
  });
  