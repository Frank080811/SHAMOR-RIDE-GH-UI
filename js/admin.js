// js/admin.js

import { API_BASE_URL, auth, getToken } from "./config.js";

/* =========================
   AUTH GUARD
========================= */
if (!getToken()) {
  location.href = "auth.html";
}

/* =========================
   DOM REFERENCES
========================= */
const usersCount = document.getElementById("usersCount");
const ridesCount = document.getElementById("ridesCount");
const driversCount = document.getElementById("driversCount");
const driversTable = document.getElementById("driversTable");

const docsModal = document.getElementById("docsModal");
const docsContent = document.getElementById("docsContent");

const rejectModal = document.getElementById("rejectModal");
const rejectReason = document.getElementById("rejectReason");

let rejectDriverId = null;

/* =========================
   LOAD STATS
========================= */
async function loadStats() {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/stats`, {
      headers: auth(),
    });

    if (!res.ok) throw new Error("Failed to load stats");

    const data = await res.json();
    usersCount.textContent = data.users;
    ridesCount.textContent = data.rides;
    driversCount.textContent = data.pending_drivers;
  } catch (err) {
    console.error(err);
    alert("Unable to load admin stats");
  }
}

/* =========================
   LOAD PENDING DRIVERS
========================= */
async function loadDrivers() {
  try {
    const res = await fetch(`${API_BASE_URL}/admin/drivers/pending`, {
      headers: auth(),
    });

    if (!res.ok) throw new Error("Failed to load drivers");

    const drivers = await res.json();
    driversTable.innerHTML = "";

    drivers.forEach(d => {
      driversTable.innerHTML += `
        <tr>
          <td>${d.name || "—"}</td>
          <td>${d.phone || "—"}</td>
          <td>${d.vehicle_model || "—"}</td>
          <td>${d.plate || "—"}</td>
          <td>
            <button class="btn view" data-id="${d.user_id}">View</button>
          </td>
          <td><span class="badge pending">Pending</span></td>
          <td>
            <button class="btn approve" data-id="${d.user_id}">Approve</button>
            <button class="btn reject" data-id="${d.user_id}">Reject</button>
          </td>
        </tr>
      `;
    });
  } catch (err) {
    console.error(err);
    alert("Unable to load pending drivers");
  }
}

/* =========================
   VIEW DOCUMENTS
========================= */
async function viewDocs(userId) {
  try {
    const res = await fetch(
      `${API_BASE_URL}/admin/drivers/${userId}/documents`,
      { headers: auth() }
    );

    if (!res.ok) throw new Error("Failed to load documents");

    const docs = await res.json();

    docsContent.innerHTML = `
      <p>🪪 Ghana Card: ${docs.ghana_card ? "✔ Uploaded" : "❌ Missing"}</p>
      <p>🚘 Driver License: ${docs.license ? "✔ Uploaded" : "❌ Missing"}</p>
      <p>🧾 Insurance: ${docs.insurance ? "✔ Uploaded" : "❌ Missing"}</p>
      <p>🚗 Vehicle Photos: ${docs.vehicle_photos?.length || 0}</p>
    `;

    docsModal.style.display = "flex";
  } catch (err) {
    console.error(err);
    alert("Unable to load documents");
  }
}

function closeDocs() {
  docsModal.style.display = "none";
}

/* =========================
   APPROVE DRIVER
========================= */
async function approve(userId) {
  if (!confirm("Approve this driver?")) return;

  try {
    const res = await fetch(
      `${API_BASE_URL}/admin/drivers/${userId}/approve`,
      {
        method: "POST",
        headers: auth(),
      }
    );

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Approval failed");
    }

    await loadStats();
    await loadDrivers();
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
}

/* =========================
   REJECT DRIVER
========================= */
function openReject(userId) {
  rejectDriverId = userId;
  rejectModal.style.display = "flex";
}

async function submitReject() {
  const reason = rejectReason.value.trim();
  if (!reason) {
    alert("Please provide a rejection reason");
    return;
  }

  try {
    const res = await fetch(
      `${API_BASE_URL}/admin/drivers/${rejectDriverId}/reject`,
      {
        method: "POST",
        headers: auth(),
        body: JSON.stringify({ reason }),
      }
    );

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.detail || "Rejection failed");
    }

    rejectModal.style.display = "none";
    rejectReason.value = "";
    rejectDriverId = null;

    await loadStats();
    await loadDrivers();
  } catch (err) {
    console.error(err);
    alert(err.message);
  }
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

/* =========================
   INIT
========================= */
loadStats();
loadDrivers();

/* =========================
   EXPOSE FOR HTML
========================= */
window.closeDocs = closeDocs;
window.submitReject = submitReject;
window.logout = logout;
