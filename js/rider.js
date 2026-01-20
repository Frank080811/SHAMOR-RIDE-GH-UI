/* =========================
   CONFIG   rider.js
========================= */
import {
  API_BASE,
  WS_BASE,
  getRiderToken,
  authRider
} from "./config.js";

/* =========================
   AUTH (RIDER ONLY)
========================= */
const token = getRiderToken();
if (!token) {
  alert("Rider login required");
  location.href = "/login.html";
}

// 🔒 HARD ROLE CHECK (CRITICAL)
try {
  const payload = JSON.parse(atob(token.split(".")[1]));
  if (payload.role !== "rider") {
    throw new Error("Invalid role");
  }
} catch {
  localStorage.removeItem("rider_token");
  alert("Invalid rider session");
  location.href = "/login.html";
}

/* =========================
   UI STATE MACHINE
========================= */
const UI_STATE = {
  IDLE: "idle",
  SEARCHING: "searching",
  PREVIEW: "preview",
  REQUESTED: "requested",
  ASSIGNED: "assigned"
};

let uiState = UI_STATE.IDLE;

/* =========================
   MAP + STATE
========================= */
let map, pickupMarker, dropoffMarker, assignedDriverMarker;
let selectedPickup = null;
let selectedDropoff = null;
let previewDriver = null;
let assignedDriver = null;
let activeRideId = null;
let pickupScanInterval = null;

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
  if (query.length < 2) return;

  const res = await fetch(`${API_BASE}/locations/search?q=${query}`);
  if (!res.ok) return;

  const data = await res.json();
  container.innerHTML = "";

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
   ROUTE + FARE (UI ONLY)
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
   DRIVER PREVIEW (VISUAL ONLY)
========================= */
function startDriverScan() {
  if (uiState === UI_STATE.REQUESTED || uiState === UI_STATE.ASSIGNED) return;

  uiState = UI_STATE.SEARCHING;
  clearInterval(pickupScanInterval);

  pickupScanInterval = setInterval(loadDriversForPreview, 15000);
  loadDriversForPreview();
}

async function loadDriversForPreview() {
  if (!selectedPickup || uiState !== UI_STATE.SEARCHING) return;

  const res = await fetch(`${API_BASE}/tracking/drivers/live`);
  if (!res.ok) return;

  const drivers = await res.json();
  if (!drivers.length) return;

  previewDriver = drivers[0];
  driverEtaText.innerText = `${previewDriver.eta ?? "—"} min`;
  showDriverCard(previewDriver);
}

/* =========================
   CONFIRM RIDE
========================= */
confirmBtn.onclick = async () => {
  if (!selectedPickup || !selectedDropoff) return;

  uiState = UI_STATE.REQUESTED;
  confirmBtn.disabled = true;
  clearInterval(pickupScanInterval);

  showToast("🚕 Searching for drivers...");

  const res = await fetch(`${API_BASE}/rides/request`, {
    method: "POST",
    headers: authRider(),
    body: JSON.stringify({
      pickup_lat: selectedPickup.latitude,
      pickup_lng: selectedPickup.longitude,
      dropoff_lat: selectedDropoff.latitude,
      dropoff_lng: selectedDropoff.longitude
    })
  });

  const data = await res.json();
  activeRideId = data.ride_id;
};

/* =========================
   DRIVER CARD
========================= */
function showDriverCard(driver) {
  driverName.innerText = driver.name ?? "Driver";
  driverRating.innerText = driver.rating ?? "4.8";
  driverVehicle.innerText = "Assigned after acceptance";
  driverPlate.innerText = "—";
  driverCard.classList.remove("hidden");
}

/* =========================
   WEBSOCKET (RIDER)
========================= */
const ws = new WebSocket(
  `${WS_BASE}/tracking/ws/driver?token=${getDriverToken()}`
);


ws.onmessage = e => {
  const msg = JSON.parse(e.data);

  if (msg.type === "ride.accepted") {
    uiState = UI_STATE.ASSIGNED;
    assignedDriver = msg.driver;
    showToast("🚗 Driver accepted your ride");
    showDriverCard(assignedDriver);
  }

  if (msg.type === "driver_location" && assignedDriver) {
    const { lat, lng } = msg;
    if (!assignedDriverMarker) {
      assignedDriverMarker = L.marker([lat, lng]).addTo(map);
    } else {
      assignedDriverMarker.setLatLng([lat, lng]);
    }
  }
};
