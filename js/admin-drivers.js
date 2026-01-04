import { API_BASE_URL } from "./config.js";

const token = localStorage.getItem("access_token");
if (!token) location.href = "/auth.html";

const headers = {
  Authorization: `Bearer ${token}`,
};

const list = document.getElementById("list");

async function loadDrivers() {
  const res = await fetch(`${API_BASE_URL}/admin/drivers/pending`, {
    headers,
  });

  const drivers = await res.json();
  list.innerHTML = "";

  drivers.forEach(d => {
    const div = document.createElement("div");
    div.className = "card";
    div.innerHTML = `
      <strong>${d.full_name}</strong> (${d.email})<br>
      Phone: ${d.phone}<br>
      Vehicle: ${d.vehicle_model} (${d.vehicle_plate})
      <div class="actions">
        <button class="approve">Approve</button>
        <button class="reject">Reject</button>
      </div>
    `;

    div.querySelector(".approve").onclick = () => approve(d.id);
    div.querySelector(".reject").onclick = () => reject(d.id);

    list.appendChild(div);
  });
}

async function approve(id) {
  await fetch(`${API_BASE_URL}/admin/drivers/${id}/approve`, {
    method: "POST",
    headers,
  });
  loadDrivers();
}

async function reject(id) {
  const reason = prompt("Rejection reason?");
  if (!reason) return;

  const form = new FormData();
  form.append("reason", reason);

  await fetch(`${API_BASE_URL}/admin/drivers/${id}/reject`, {
    method: "POST",
    headers,
    body: form,
  });

  loadDrivers();
}

loadDrivers();
