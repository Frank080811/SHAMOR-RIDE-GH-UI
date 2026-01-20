/* =========================
   admin.js (ROLE SAFE)
========================= */
import { API_BASE } from "./config.js";

/* =========================
   AUTH (ADMIN ONLY)
========================= */
function getValidAdminToken() {
  const token = localStorage.getItem("admin_token");
  if (!token) return null;

  try {
    const payload = JSON.parse(atob(token.split(".")[1]));
    if (payload.role !== "admin") throw new Error("Invalid role");
    return token;
  } catch {
    localStorage.removeItem("admin_token");
    return null;
  }
}

const token = getValidAdminToken();
if (!token) {
  alert("Admin login required");
  location.href = "auth.html";
}

/* =========================
   COMMON HEADERS
========================= */
const headers = {
  "Content-Type": "application/json",
  Authorization: `Bearer ${token}`,
};

/* =========================
   DOM
========================= */
const list = document.getElementById("list");

/* =========================
   LOAD PENDING DRIVERS
========================= */
async function loadDrivers() {
  let res;

  try {
    res = await fetch(`${API_BASE}/admin/drivers/pending`, { headers });
  } catch {
    alert("Network error");
    return;
  }

  if (!res.ok) {
    alert("Session expired");
    localStorage.removeItem("admin_token");
    location.href = "auth.html";
    return;
  }

  const drivers = await res.json();
  list.innerHTML = "";

  drivers.forEach(d => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <strong>${d.full_name}</strong> (${d.email})<br>
      Phone: ${d.phone ?? "—"}<br>
      Vehicle: ${d.vehicle_model ?? "—"} (${d.vehicle_plate ?? "—"})
      <div class="actions">
        <button class="approve">Approve</button>
        <button class="reject">Reject</button>
      </div>
    `;

    div.querySelector(".approve").onclick = () => approveDriver(d.id);
    div.querySelector(".reject").onclick = () => rejectDriver(d.id);

    list.appendChild(div);
  });
}

/* =========================
   APPROVE DRIVER
========================= */
async function approveDriver(id) {
  await fetch(`${API_BASE}/admin/drivers/${id}/approve`, {
    method: "POST",
    headers,
  });

  loadDrivers();
}

/* =========================
   REJECT DRIVER
========================= */
async function rejectDriver(id) {
  const reason = prompt("Rejection reason?");
  if (!reason) return;

  await fetch(`${API_BASE}/admin/drivers/${id}/reject`, {
    method: "POST",
    headers,
    body: JSON.stringify({ reason }),
  });

  loadDrivers();
}

/* =========================
   INIT
========================= */
loadDrivers();
