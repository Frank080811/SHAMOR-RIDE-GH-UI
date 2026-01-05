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
   VIEW DOCUMENTS (SCROLLABLE)
========================= */
async function viewDocs(userId) {
  try {
    const res = await fetch(
      `${API_BASE_URL}/admin/drivers/${userId}/documents`,
      { headers: auth() }
    );

    if (!res.ok) throw new Error("Failed to load documents");

    const docs = await res.json();
    docsContent.innerHTML = "";

    renderDoc("Ghana Card", docs.ghana_card);
    renderDoc("Driver License", docs.license);
    renderDoc("Insurance", docs.insurance);

    if (Array.isArray(docs.vehicle_photos)) {
      docs.vehicle_photos.forEach((url, i) =>
        renderDoc(`Vehicle Photo ${i + 1}`, url)
      );
    }

    docsModal.style.display = "flex";
  } catch (err) {
    console.error(err);
    alert("Unable to load documents");
  }
}

function renderDoc(title, url) {
  if (!url) {
    docsContent.innerHTML += `<p>❌ ${title}: Missing</p>`;
    return;
  }

  const isPdf = url.endsWith(".pdf");

  docsContent.innerHTML += `
    <div style="margin-bottom:1rem">
      <h4>${title}</h4>
      ${
        isPdf
          ? `<iframe src="${url}" style="width:100%;height:420px;border-radius:10px"></iframe>`
          : `<img src="${url}" style="width:100%;border-radius:10px" loading="lazy" />`
      }
    </div>
  `;
}

function closeDocs() {
  docsModal.style.display = "none";
  docsContent.innerHTML = "";
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
        headers: {
          ...auth(),
          "Content-Type": "application/json",
        },
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
