/* =========================
   CONFIG
========================= */
import { API_BASE, WS_BASE } from "./config.js";

const SERVICE_AREA = {
  center: { lat: 6.8970, lng: -1.5250 },
  bounds: { south: 6.75, west: -1.70, north: 7.05, east: -1.35 }
};

/* =========================
   STATE
========================= */
let map, pickupMarker, dropoffMarker;
let assignedDriverMarker = null;

let selectedPickup = null;
let selectedDropoff = null;

let distanceKm = 0;
let baseFare = 0;
let finalFare = 0;

let previewDriver = null;
let assignedDriver = null;
let activeRideId = null;

let pickupScanInterval = null;
let countdownInterval = null;
let etaSeconds = 0;

let lastDriverLatLng = null;
let stallTimer = null;

/* =========================
   DOM
========================= */
const pickupInput = document.getElementById("pickup");
const dropoffInput = document.getElementById("dropoff");
const pickupResults = document.getElementById("pickupResults");
const dropoffResults = document.getElementById("dropoffResults");

const confirmBtn = document.getElementById("confirmBtn");
const rideInfo = document.getElementById("rideInfo");
const distanceText = document.getElementById("distanceText");
const fareText = document.getElementById("fareText");
const driverEtaText = document.getElementById("driverEtaText");
const driverRow = document.getElementById("driverRow");

const driverCard = document.getElementById("driverCard");
const driverName = document.getElementById("driverName");
const driverRating = document.getElementById("driverRating");
const driverVehicle = document.getElementById("driverVehicle");
const driverPlate = document.getElementById("driverPlate");
const driverCallBtn = document.getElementById("driverCallBtn");

const token = localStorage.getItem("access_token");

/* =========================
   MAP INIT
========================= */
map = L.map("map", {
  maxBounds: [
    [SERVICE_AREA.bounds.south, SERVICE_AREA.bounds.west],
    [SERVICE_AREA.bounds.north, SERVICE_AREA.bounds.east]
  ],
  maxBoundsViscosity: 1
}).setView([SERVICE_AREA.center.lat, SERVICE_AREA.center.lng], 13);

L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png").addTo(map);

/* =========================
   HELPERS
========================= */
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function showToast(msg) {
  const t = document.createElement("div");
  t.className = "toast";
  t.innerText = msg;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3000);
}

/* =========================
   LOCATION SEARCH
========================= */
async function searchLocations(query, container, onSelect) {
  container.innerHTML = "";
  if (query.length < 2) return;

  const res = await fetch(`${API_BASE}/locations/search?q=${query}`);
  const data = await res.json();

  data.forEach(loc => {
    const div = document.createElement("div");
    div.textContent = loc.name;
    div.onclick = () => onSelect(loc);
    container.appendChild(div);
  });
}

pickupInput.addEventListener("input", e =>
  searchLocations(e.target.value, pickupResults, setPickup)
);

dropoffInput.addEventListener("input", e =>
  searchLocations(e.target.value, dropoffResults, setDropoff)
);

/* =========================
   PICKUP / DROPOFF
========================= */
function setPickup(loc) {
  selectedPickup = loc;
  pickupInput.value = loc.name;
  pickupResults.innerHTML = "";

  if (pickupMarker) map.removeLayer(pickupMarker);
  pickupMarker = L.marker([loc.latitude, loc.longitude]).addTo(map);

  tryPrepareRide();
}

function setDropoff(loc) {
  selectedDropoff = loc;
  dropoffInput.value = loc.name;
  dropoffResults.innerHTML = "";

  if (dropoffMarker) map.removeLayer(dropoffMarker);
  dropoffMarker = L.marker([loc.latitude, loc.longitude]).addTo(map);

  tryPrepareRide();
}

/* =========================
   ROUTE + FARE
========================= */
async function tryPrepareRide() {
  if (!selectedPickup || !selectedDropoff) return;

  const res = await fetch(
    `https://router.project-osrm.org/route/v1/driving/` +
    `${selectedPickup.longitude},${selectedPickup.latitude};` +
    `${selectedDropoff.longitude},${selectedDropoff.latitude}?overview=false`
  );

  const data = await res.json();
  if (!data.routes?.length) return;

  distanceKm = data.routes[0].distance / 1000;
  baseFare = +(distanceKm * 4 + 5).toFixed(2);
  finalFare = baseFare;

  distanceText.innerText = `${distanceKm.toFixed(2)} km`;
  fareText.innerText = `₵${finalFare.toFixed(2)}`;

  rideInfo.style.display = "block";
  confirmBtn.disabled = false;

  startDriverScan();
}

/* =========================
   DRIVER PREVIEW MATCHING
========================= */
function startDriverScan() {
  if (pickupScanInterval) clearInterval(pickupScanInterval);
  pickupScanInterval = setInterval(loadDriversForPreview, 15000);
  loadDriversForPreview();
}

async function loadDriversForPreview() {
  const res = await fetch(`${API_BASE}/tracking/drivers/live`);
  const drivers = await res.json();
  if (!drivers.length) return;

  const scored = drivers.map(d => {
    const distance = haversine(
      d.lat, d.lng,
      selectedPickup.latitude,
      selectedPickup.longitude
    );

    return {
      ...d,
      score:
        (1 - distance / 8) * 0.5 +
        ((d.rating || 4.5) / 5) * 0.3 +
        (d.on_trip && d.near_dropoff ? 0.2 : 0)
    };
  });

  previewDriver = scored.sort((a, b) => b.score - a.score)[0];
  if (!previewDriver) return;

  const eta = await calculateDriverETA(previewDriver);
  if (!eta) return;

  driverRow.style.display = "flex";
  driverEtaText.innerText = `${eta.eta_min} min`;

  showDriverCard(previewDriver);
}

/* =========================
   DRIVER ETA
========================= */
async function calculateDriverETA(driver) {
  const res = await fetch(
    `https://router.project-osrm.org/route/v1/driving/` +
    `${driver.lng},${driver.lat};` +
    `${selectedPickup.longitude},${selectedPickup.latitude}?overview=false`
  );

  const data = await res.json();
  if (!data.routes?.length) return null;

  return { eta_min: Math.ceil(data.routes[0].duration / 60) };
}

/* =========================
   CONFIRM → REQUEST RIDE
========================= */
confirmBtn.onclick = async () => {
  confirmBtn.disabled = true;
  showToast("🔍 Sending request to driver...");

  const res = await fetch(`${API_BASE}/rides/request`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      pickup_lat: selectedPickup.latitude,
      pickup_lng: selectedPickup.longitude,
      dropoff_lat: selectedDropoff.latitude,
      dropoff_lng: selectedDropoff.longitude
    })
  });

  const ride = await res.json();
  activeRideId = ride.ride_id;
};

/* =========================
   SHOW DRIVER CARD
========================= */
function showDriverCard(driver) {
  driverName.innerText = driver.name || "Driver";
  driverRating.innerText = driver.rating || "4.8";
  driverVehicle.innerText = driver.vehicle || "Vehicle";
  driverPlate.innerText = driver.plate || "—";

  if (driver.phone) {
    driverCallBtn.href = `tel:${driver.phone}`;
    driverCallBtn.style.display = "block";
  }

  driverCard.classList.remove("hidden");
}

/* =========================
   LIVE TRACKING
========================= */
function updateDriverPosition(driver) {
  const latLng = [driver.lat, driver.lng];

  if (!assignedDriverMarker) {
    assignedDriverMarker = L.marker(latLng, {
      icon: L.divIcon({ html: "🚗", className: "car-marker" })
    }).addTo(map);
  } else {
    assignedDriverMarker.setLatLng(latLng);
  }

  map.panTo(latLng, { animate: true, duration: 0.5 });
}

/* =========================
   WEBSOCKET EVENTS
========================= */
const ws = new WebSocket(`${WS_BASE}/ws/rider`);

ws.onmessage = e => {
  const msg = JSON.parse(e.data);

  if (msg.type === "ride.accepted" && msg.ride_id === activeRideId) {
    assignedDriver = msg.driver;
    showToast("🚗 Driver accepted your ride");
    showDriverCard(assignedDriver);
  }

  if (msg.type === "driver.location" && assignedDriver) {
    updateDriverPosition(msg);
  }

  if (msg.type === "ride.declined") {
    showToast("❌ Driver declined. Searching again...");
    startDriverScan();
  }
};
