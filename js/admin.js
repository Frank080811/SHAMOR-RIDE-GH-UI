// js/admin.js

import { API_BASE_URL, authHeaders, getToken } from "./config.js";

if (!getToken()) {
  location.href = "auth.html";
}

let rejectDriverId = null;

/* =========================
   LOAD STATS
========================= */
async function loadStats() {
  const res = await fetch(`${API_BASE_URL}/admin/stats`, {
    headers: authHeaders()
  });

  const data = await res.json();
  usersCount.textContent = data.users;
  ridesCount.textContent = data.rides;
  driversCount.textContent = data.pending_drivers;
}

/* =========================
   LOAD DRIVERS
========================= */
async function loadDrivers() {
  const res = await fetch(`${API_BASE_URL}/admin/drivers/pending`, {
    headers: authHeaders()
  });

  const drivers = await res.json();
  driversTable.innerHTML = "";

  drivers.forEach(d => {
    driversTable.innerHTML += `
      <tr>
        <td>${d.name}</td>
        <td>${d.phone}</td>
        <td>${d.vehicle_model}</td>
        <td>${d.plate}</td>
        <td>
          <button class="btn view" data-id="${d.id}">View</button>
        </td>
        <td><span class="badge pending">Pending</span></td>
        <td>
          <button class="btn approve" data-id="${d.id}">Approve</button>
          <button class="btn reject" data-id="${d.id}">Reject</button>
        </td>
      </tr>
    `;
  });
}

/* =========================
   VIEW DOCUMENTS
========================= */
async function viewDocs(id) {
  const res = await fetch(
    `${API_BASE_URL}/admin/drivers/${id}/documents`,
    { headers: authHeaders() }
  );

  const docs = await res.json();

  docsContent.innerHTML = `
    <p>🪪 Ghana Card: ${docs.ghana_card ? "✔ Uploaded" : "❌ Missing"}</p>
    <p>🚘 Driver License: ${docs.license ? "✔ Uploaded" : "❌ Missing"}</p>
    <p>🧾 Insurance: ${docs.insurance ? "✔ Uploaded" : "❌ Missing"}</p>
    <p>🚗 Vehicle Photos: ${docs.vehicle_photos?.length || 0}</p>
  `;

  docsModal.style.display = "flex";
}

function closeDocs() {
  docsModal.style.display = "none";
}

/* =========================
   APPROVE / REJECT
========================= */
async function approve(id) {
  await fetch(`${API_BASE_URL}/admin/drivers/${id}/approve`, {
    method: "POST",
    headers: authHeaders()
  });

  loadDrivers();
}

function openReject(id) {
  rejectDriverId = id;
  rejectModal.style.display = "flex";
}

async function submitReject() {
  await fetch(`${API_BASE_URL}/admin/drivers/${rejectDriverId}/reject`, {
    method: "POST",
    headers: authHeaders(),
    body: JSON.stringify({ reason: rejectReason.value })
  });

  rejectModal.style.display = "none";
  rejectReason.value = "";
  loadDrivers();
}

/* =========================
   LOGOUT
========================= */
function logout() {
  localStorage.clear();
  location.href = "auth.html";
}

/* =========================
   EVENT DELEGATION
========================= */
driversTable.addEventListener("click", e => {
  const id = e.target.dataset.id;
  if (!id) return;

  if (e.target.classList.contains("view")) viewDocs(id);
  if (e.target.classList.contains("approve")) approve(id);
  if (e.target.classList.contains("reject")) openReject(id);
});

/* INIT */
loadStats();
loadDrivers();

/* expose for HTML buttons */
window.closeDocs = closeDocs;
window.submitReject = submitReject;
window.logout = logout;
