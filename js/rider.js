/* =========================
   rider.js (FINAL — STABLE)
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
function getValidRiderToken() {
  const t = getRiderToken();
  if (!t) return null;

  try {
    const payload = JSON.parse(atob(t.split(".")[1]));
    if (payload.role !== "rider") throw new Error("Wrong role");
    return t;
  } catch {
    localStorage.removeItem("rider_token");
    return null;
  }
}

const token = getValidRiderToken();
if (!token) {
  alert("Rider login required");
  location.replace("index.html");
  throw new Error("Unauthorized rider");
}

/* =========================
   UI STATE
========================= */
const UI_STATE = {
  IDLE: "idle",
  REQUESTED: "requested",
  ASSIGNED: "assigned"
};

let uiState = UI_STATE.IDLE;

/* =========================
   MAP + STATE
========================= */
let map;
let pickupMarker = null;
let dropoffMarker = null;
let assignedDriverMarker = null;

let selectedPickup = null;
let selectedDropoff = null;
let activeRideId = null;

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
   TOAST
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

  try {
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
  } catch {
    /* silent */
  }
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

  try {
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
  } catch {
    /* silent */
  }
}

/* =========================
   REQUEST RIDE
========================= */
confirmBtn.onclick = async () => {
  if (!selectedPickup || !selectedDropoff) return;
  if (uiState !== UI_STATE.IDLE) return;

  uiState = UI_STATE.REQUESTED;
  confirmBtn.disabled = true;

  showToast("🚕 Searching for drivers...");

  try {
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
    if (!res.ok) throw new Error(data?.detail);

    activeRideId = data.ride_id;
  } catch (err) {
    uiState = UI_STATE.IDLE;
    confirmBtn.disabled = false;
    alert(err.message || "Ride request failed");
  }
};

/* =========================
   DRIVER CARD
========================= */
function showDriverCard(driver) {
  driverName.innerText = driver.name || "Driver";
  driverRating.innerText = driver.rating || "4.8";
  driverVehicle.innerText = driver.vehicle || "—";
  driverPlate.innerText = driver.plate || "—";
  driverCard.classList.remove("hidden");
}

/* =========================
   WEBSOCKET (RIDER)
========================= */
const ws = new WebSocket(
  `${WS_BASE}/tracking/ws/rider?token=${token}`
);

ws.onmessage = e => {
  let msg;
  try {
    msg = JSON.parse(e.data);
  } catch {
    return;
  }

  console.log("📩 Rider WS:", msg);

  if (msg.type === "ride.accepted") {
    uiState = UI_STATE.ASSIGNED;
    showToast("🚗 Driver accepted your ride");
    showDriverCard(msg.driver);
  }

  if (msg.type === "driver_location" && msg.lat && msg.lng) {
    if (!assignedDriverMarker) {
      assignedDriverMarker = L.marker([msg.lat, msg.lng]).addTo(map);
    } else {
      assignedDriverMarker.setLatLng([msg.lat, msg.lng]);
    }
  }
};
