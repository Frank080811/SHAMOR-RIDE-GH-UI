/* =========================
   CONFIG
========================= */
import { API_BASE, WS_BASE } from "./config.js";

/* =========================
   SOFT UI STATE (NON-BREAKING)
========================= */
const UI_STATE = {
  IDLE: "idle",
  SEARCHING: "searching",
  PREVIEW: "preview",
  ASSIGNED: "assigned"
};

let uiState = UI_STATE.IDLE;

/* =========================
   MAP + DATA STATE
========================= */
let map, pickupMarker, dropoffMarker;
let assignedDriverMarker = null;
let routeLine = null;

let selectedPickup = null;
let selectedDropoff = null;

let previewDriver = null;
let assignedDriver = null;
let activeRideId = null;

let pickupScanInterval = null;
let searchingAnimInterval = null;

const token = localStorage.getItem("access_token");

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

const driverRow = document.getElementById("driverRow");
const driverEtaText = document.getElementById("driverEtaText");

const driverCard = document.getElementById("driverCard");
const driverName = document.getElementById("driverName");
const driverRating = document.getElementById("driverRating");
const driverVehicle = document.getElementById("driverVehicle");
const driverPlate = document.getElementById("driverPlate");

/* =========================
   MAP INIT
========================= */
map = L.map("map").setView([6.8970, -1.5250], 13);
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
   SEARCHING ANIMATION
========================= */
function startSearchingAnimation() {
  stopSearchingAnimation();
  uiState = UI_STATE.SEARCHING;
  let dots = "";
  driverRow.style.display = "flex";
  driverEtaText.innerText = "Searching";

  searchingAnimInterval = setInterval(() => {
    dots = dots.length < 3 ? dots + "." : "";
    driverEtaText.innerText = "Searching" + dots;
  }, 500);
}

function stopSearchingAnimation() {
  clearInterval(searchingAnimInterval);
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

pickupInput.oninput = e =>
  searchLocations(e.target.value, pickupResults, setPickup);

dropoffInput.oninput = e =>
  searchLocations(e.target.value, dropoffResults, setDropoff);

/* =========================
   PICKUP / DROPOFF
========================= */
function setPickup(loc) {
  selectedPickup = loc;
  pickupInput.value = loc.name;
  pickupResults.innerHTML = "";
  pickupMarker && map.removeLayer(pickupMarker);
  pickupMarker = L.marker([loc.latitude, loc.longitude]).addTo(map);
  tryPrepareRide();
}

function setDropoff(loc) {
  selectedDropoff = loc;
  dropoffInput.value = loc.name;
  dropoffResults.innerHTML = "";
  dropoffMarker && map.removeLayer(dropoffMarker);
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

  const distanceKm = data.routes[0].distance / 1000;
  const fare = distanceKm * 4 + 5;

  distanceText.innerText = `${distanceKm.toFixed(2)} km`;
  fareText.innerText = `₵${fare.toFixed(2)}`;

  rideInfo.style.display = "block";
  confirmBtn.disabled = false;

  startDriverScan();
}

/* =========================
   DRIVER PREVIEW (REAL + SIM)
========================= */
function startDriverScan() {
  if (assignedDriver) return;
  clearInterval(pickupScanInterval);
  startSearchingAnimation();
  pickupScanInterval = setInterval(loadDriversForPreview, 15000);
  loadDriversForPreview();
}

async function loadDriversForPreview() {
  if (!selectedPickup || assignedDriver) return;

  let drivers = [];
  try {
    const res = await fetch(`${API_BASE}/tracking/drivers/live`);
    drivers = await res.json();
  } catch {}

  // 🔁 FALLBACK SIMULATION (DEV ONLY)
  if (!drivers.length) {
    drivers = simulateDrivers(selectedPickup);
  }

  previewDriver = drivers
    .map(d => ({
      ...d,
      score:
        (1 - haversine(d.lat, d.lng,
          selectedPickup.latitude,
          selectedPickup.longitude) / 6)
    }))
    .sort((a, b) => b.score - a.score)[0];

  if (!previewDriver) return;

  stopSearchingAnimation();
  uiState = UI_STATE.PREVIEW;

  driverEtaText.innerText = `${previewDriver.eta} min`;
  showDriverCard(previewDriver);
}

/* =========================
   CONFIRM RIDE
========================= */
confirmBtn.onclick = async () => {
  confirmBtn.disabled = true;
  showToast("🔍 Requesting driver...");

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
   DRIVER CARD
========================= */
function showDriverCard(driver) {
  driverName.innerText = driver.name ?? "Driver";
  driverRating.innerText = driver.rating ?? "4.8";
  driverVehicle.innerText = uiState === UI_STATE.ASSIGNED
    ? driver.vehicle
    : "Assigned after confirmation";
  driverPlate.innerText = uiState === UI_STATE.ASSIGNED
    ? driver.plate
    : "—";
  driverCard.classList.remove("hidden");
}

/* =========================
   WEBSOCKET
========================= */
if (token) {
  const ws = new WebSocket(`${WS_BASE}/tracking/ws/rider?token=${token}`);

  ws.onmessage = e => {
    const msg = JSON.parse(e.data);

    if (msg.type === "ride.accepted") {
      uiState = UI_STATE.ASSIGNED;
      assignedDriver = msg.driver;
      clearInterval(pickupScanInterval);
      showToast("🚗 Driver accepted your ride");
      showDriverCard(assignedDriver);
    }

    if (
      msg.type === "driver_location" &&
      assignedDriver &&
      msg.driver_id === assignedDriver.driver_id
    ) {
      updateDriverPosition(msg.lat, msg.lng);
    }

    if (msg.type === "driver.stalled") {
      showToast("⚠️ Driver unavailable. Reassigning...");
      assignedDriver = null;
      startDriverScan();
    }
  };
}

/* =========================
   DRIVER SIMULATION (SAFE)
========================= */
function simulateDrivers(pickup) {
  return Array.from({ length: 3 }).map((_, i) => ({
    driver_id: i + 1,
    name: `Test Driver ${i + 1}`,
    rating: (4.6 + Math.random() * 0.4).toFixed(1),
    vehicle: "Toyota Corolla",
    plate: `GT-${1200 + i}`,
    lat: pickup.latitude + (Math.random() - 0.5) / 300,
    lng: pickup.longitude + (Math.random() - 0.5) / 300,
    eta: Math.floor(2 + Math.random() * 6)
  }));
}
