/* =========================
   CONFIG
========================= */
import { API_BASE, WS_BASE, getToken, auth } from "./config.js";

const SERVICE_AREA = {
  center: { lat: 6.8970, lng: -1.5250 },
  bounds: { south: 6.75, west: -1.70, north: 7.05, east: -1.35 }
};

/* =========================
   STATE
========================= */
let map, pickupMarker, dropoffMarker, routeLine;
let selectedPickup = null;
let selectedDropoff = null;

let distanceKm = 0;
let baseFare = 0;
let finalFare = 0;

let nearestDriver = null;
let assignedDriver = null;
let assignedDriverMarker = null;

let pickupETAInterval = null;
let countdownInterval = null;
let etaSeconds = 0;
let totalEtaSeconds = 0;

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

const paymentModal = document.getElementById("paymentModal");
const paySummary = document.getElementById("paySummary");
const payBtn = document.getElementById("payBtn");

const token = localStorage.getItem("access_token");
const userEmail = localStorage.getItem("user_email") || "rider@email.com";

const driverPlate = document.getElementById("driverPlate");
const driverCard = document.getElementById("driverCard");
const driverName = document.getElementById("driverName");
const driverRating = document.getElementById("driverRating");
const driverVehicle = document.getElementById("driverVehicle");
const driverCallBtn = document.getElementById("driverCallBtn");



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

function detectSurge(driverCount) {
  if (driverCount < 3) return 1.5;
  if (driverCount < 6) return 1.2;
  return 1.0;
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

  tryDrawRoute();
  startPickupETA();
}

function setDropoff(loc) {
  selectedDropoff = loc;
  dropoffInput.value = loc.name;
  dropoffResults.innerHTML = "";

  if (dropoffMarker) map.removeLayer(dropoffMarker);
  dropoffMarker = L.marker([loc.latitude, loc.longitude]).addTo(map);

  tryDrawRoute();
}

/* =========================
   ROUTE + FARE
========================= */
async function tryDrawRoute() {
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
}

/* =========================
   DRIVER DISCOVERY + ETA
========================= */
async function startPickupETA() {
  if (pickupETAInterval) clearInterval(pickupETAInterval);
  pickupETAInterval = setInterval(loadLiveDrivers, 15000);
  loadLiveDrivers();
}

async function loadLiveDrivers() {
  if (!selectedPickup) return;

  const res = await fetch(`${API_BASE}/tracking/drivers/live`);
  const drivers = await res.json();
  if (!drivers.length) return;

  nearestDriver = drivers
    .map(d => ({
      ...d,
      distance_km: haversine(
        d.lat, d.lng,
        selectedPickup.latitude,
        selectedPickup.longitude
      )
    }))
    .sort((a, b) => a.distance_km - b.distance_km)[0];

  if (nearestDriver.distance_km > 10) {
    showToast("❌ No nearby drivers");
    confirmBtn.disabled = true;
    return;
  }

  const surge = detectSurge(drivers.length);
  finalFare = +(baseFare * surge).toFixed(2);
  fareText.innerText = `₵${finalFare.toFixed(2)}`;

  const eta = await calculateDriverETA(nearestDriver);
  if (!eta) return;

  startCountdown(eta.eta_min);

  if (assignedDriver && nearestDriver.driver_id === assignedDriver.driver_id) {
    updateAssignedDriverPosition(nearestDriver);
    monitorDriverMovement(nearestDriver);
    checkPickupGeofence(nearestDriver);
  }

  if (
    assignedDriver &&
    nearestDriver.driver_id === assignedDriver.driver_id
  ) {
    showDriverCard(nearestDriver);
  }
  
}

async function calculateDriverETA(driver) {
  const res = await fetch(
    `https://router.project-osrm.org/route/v1/driving/` +
    `${driver.lng},${driver.lat};` +
    `${selectedPickup.longitude},${selectedPickup.latitude}?overview=false`
  );
  const data = await res.json();
  if (!data.routes?.length) return null;

  return {
    eta_min: Math.ceil(data.routes[0].duration / 60)
  };
}

/* =========================
   COUNTDOWN
========================= */
function startCountdown(minutes) {
  etaSeconds = minutes * 60;
  totalEtaSeconds = etaSeconds;

  clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    etaSeconds--;
    if (etaSeconds <= 0) {
      clearInterval(countdownInterval);
      showToast("🚕 Driver arriving");
    }
  }, 1000);
}

/* =========================
   CONFIRM & PAY
========================= */
confirmBtn.onclick = () => {
  paySummary.innerText = `Fare: ₵${finalFare.toFixed(2)}`;
  paymentModal.style.display = "flex";
};

window.closePayment = () => {
  paymentModal.style.display = "none";
};

payBtn.onclick = () => {
  payWithPaystack({
    amount: finalFare,
    email: userEmail,
    onSuccess: createRide
  });
};

/* =========================
   CREATE RIDE
========================= */
async function createRide(paymentRef) {
  const res = await fetch(`${API_BASE}/rides/request`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      pickup_location_id: selectedPickup.id,
      dropoff_location_id: selectedDropoff.id,
      payment_reference: paymentRef
    })
  });

  if (!res.ok) {
    const err = await res.json();
    return alert(err.detail || "Ride failed");
  }

  paymentModal.style.display = "none";
  assignedDriver = nearestDriver;

  showDriverCard(assignedDriver);
  showToast(`🚗 Driver assigned (${assignedDriver.plate || "Plate N/A"})`);
  
}

/* =========================
  SHOW DRIVER DETAILS
========================= */
function showDriverCard(driver) {
  if (!driverCard) return;

  driverName.innerText = driver.name || "Driver";
  driverRating.innerText = driver.rating || "4.8";
  driverVehicle.innerText = driver.vehicle || "Vehicle";
  driverPlate.innerText = driver.plate || "—";

  if (driver.phone) {
    driverCallBtn.href = `tel:${driver.phone}`;
    driverCallBtn.style.display = "block";
  } else {
    driverCallBtn.style.display = "none";
  }

  driverCard.classList.remove("hidden");
}

/* =========================
   DRIVER MARKER + SAFETY
========================= */
function updateAssignedDriverPosition(driver) {
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

function monitorDriverMovement(driver) {
  if (!lastDriverLatLng) {
    lastDriverLatLng = [driver.lat, driver.lng];
    return;
  }

  const moved =
    lastDriverLatLng[0] !== driver.lat ||
    lastDriverLatLng[1] !== driver.lng;

  if (!moved) {
    if (!stallTimer) {
      stallTimer = setTimeout(() => {
        showToast("❌ Driver unresponsive. Ride cancelled.");
        assignedDriver = null;
      }, 120000);
    }
  } else {
    clearTimeout(stallTimer);
    stallTimer = null;
    lastDriverLatLng = [driver.lat, driver.lng];
  }
}

/* =========================
   PICKUP GEOFENCE
========================= */
function checkPickupGeofence(driver) {
  const distanceKm = haversine(
    driver.lat,
    driver.lng,
    selectedPickup.latitude,
    selectedPickup.longitude
  );

  if (distanceKm < 0.15) {
    showToast("📍 Driver has arrived");
  }
}

/* =========================
   WEBSOCKET DRIVER UPDATES
========================= */
const ws = new WebSocket("ws://localhost:8000/ws/rider");

ws.onmessage = e => {
  const data = JSON.parse(e.data);
  if (
    assignedDriver &&
    data.driver_id === assignedDriver.driver_id
  ) {
    updateAssignedDriverPosition(data);
    monitorDriverMovement(data);
    checkPickupGeofence(data);
  }
};
