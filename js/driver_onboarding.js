import { API_BASE_URL } from "./config.js";

/* ===============================
   STATE
================================ */
let currentStep = 0;
const steps = document.querySelectorAll(".step");
const progressBars = document.querySelectorAll(".progress span");
const token = localStorage.getItem("access_token");

if (!token) {
  location.href = "/auth.html";
}

/* ===============================
   AUTH HEADER
================================ */
function auth() {
  return {
    Authorization: `Bearer ${token}`,
  };
}

// ===============================
// FILE PICKERS
// ===============================
window.pick = function (id) {
  const input = document.getElementById(id);
  if (input) input.click();
};

window.fileStatus = function (input) {
  const status = input.parentElement.querySelector(".file-status");
  if (!status) return;

  if (input.files && input.files.length > 0) {
    status.textContent = `✔ ${input.files.length} file(s) selected`;
    status.className = "file-status ok";
  } else {
    status.textContent = "No file selected";
    status.className = "file-status err";
  }
};


/* ===============================
   INIT — RESUME / REDIRECT
================================ */
document.addEventListener("DOMContentLoaded", init);

async function init() {
  try {
    const res = await fetch(`${API_BASE_URL}/drivers/me/status`, {
      headers: auth(),
    });

    if (!res.ok) throw new Error("Failed to fetch status");

    const data = await res.json();

    if (data.status === "approved") {
      location.href = "/driver.html";
      return;
    }

    if (
      data.status === "pending" ||
      data.status === "approved_pending_activation"
    ) {
      location.href = "/driver-pending.html";
      return;
    }

    if (data.status === "in_progress" && data.step) {
      currentStep = Math.max(
        0,
        Math.min(data.step - 1, steps.length - 1)
      );
    }

    render();
  } catch (err) {
    console.error(err);
    alert("Unable to load onboarding status");
  }
}

/* ===============================
   RENDER UI
================================ */
function render() {
  steps.forEach((step, i) =>
    step.classList.toggle("active", i === currentStep)
  );

  progressBars.forEach((bar, i) => {
    bar.style.width = i <= currentStep ? "100%" : "0%";
  });
}

/* ===============================
   SAVE PROGRESS
================================ */
async function saveProgress() {
  try {
    await fetch(`${API_BASE_URL}/drivers/onboarding/save`, {
      method: "POST",
      headers: auth(),
      body: new URLSearchParams({ step: currentStep + 1 }),
    });
  } catch {
    console.warn("Progress not saved");
  }
}

/* ===============================
   NAVIGATION
================================ */
window.next = async function () {
  if (currentStep < steps.length - 1) {
    await saveProgress();
    currentStep++;
    render();
  } else {
    await submitDriver();
  }
};

window.prev = function () {
  if (currentStep > 0) {
    currentStep--;
    render();
  }
};

/* ===============================
   SUBMIT FULL ONBOARDING
================================ */
async function submitDriver() {
  /* ---------- VALIDATION ---------- */
  const requiredFields = [
    "phone",
    "address",
    "ghana_card",
    "license_number",
    "license_expiry",
    "vehicle_model",
    "vehicle_year",
    "vehicle_type",
    "plate",
    "kin_name",
    "kin_relation",
    "kin_phone",
  ];

  for (const id of requiredFields) {
    if (!getVal(id)) {
      alert(`Please fill in ${id.replace(/_/g, " ")}`);
      return;
    }
  }

  const requiredFiles = [
    "ghana_card_file",
    "license_file",
    "insurance_file",
    "tax_file",
    "selfie_file",
  ];

  for (const id of requiredFiles) {
    const input = document.getElementById(id);
    if (!input || !input.files?.[0]) {
      alert(`Please upload ${id.replace(/_/g, " ")}`);
      return;
    }
  }

  const photos = document.getElementById("car_photos")?.files;
  if (!photos || photos.length < 2) {
    alert("Please upload vehicle front and back photos");
    return;
  }

  /* ---------- FORM DATA ---------- */
  const form = new FormData();

  // BASIC
  form.append("phone", getVal("phone"));
  form.append("address", getVal("address"));

  // ID
  form.append("ghana_card_number", getVal("ghana_card"));
  form.append("license_number", getVal("license_number"));
  form.append("license_expiry", getVal("license_expiry"));

  // VEHICLE
  form.append("vehicle_model", getVal("vehicle_model"));
  form.append("vehicle_year", getVal("vehicle_year"));
  form.append("vehicle_type", getVal("vehicle_type"));
  form.append("plate", getVal("plate"));

  // NEXT OF KIN
  form.append("kin_name", getVal("kin_name"));
  form.append("kin_relation", getVal("kin_relation"));
  form.append("kin_phone", getVal("kin_phone"));

  // FILES
  appendFile(form, "ghana_card_file");
  appendFile(form, "license_file");
  appendFile(form, "insurance_file");
  appendFile(form, "tax_file");
  appendFile(form, "selfie_file", "selfie");

  form.append("vehicle_front", photos[0]);
  form.append("vehicle_back", photos[1]);

  /* ---------- UPLOAD ---------- */
  await uploadWithProgress(form);
}

/* ===============================
   HELPERS
================================ */
function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

function appendFile(form, inputId, keyOverride = null) {
  const input = document.getElementById(inputId);
  if (input?.files?.[0]) {
    form.append(keyOverride || inputId, input.files[0]);
  }
}

/* ===============================
   UPLOAD WITH PROGRESS (XHR)
================================ */
function uploadWithProgress(form) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    const bar = document.getElementById("uploadBar");
    const status = document.getElementById("uploadStatus");

    status.style.display = "block";
    bar.style.width = "0%";

    xhr.open("POST", `${API_BASE_URL}/drivers/onboard`);
    xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        bar.style.width = `${Math.round((e.loaded / e.total) * 100)}%`;
      }
    };

    xhr.onload = () => {
      let response;
      try {
        response = JSON.parse(xhr.responseText);
      } catch {
        alert("Invalid server response");
        reject();
        return;
      }

      if (xhr.status >= 200 && xhr.status < 300) {
        bar.style.width = "100%";
        alert("✅ Application submitted for review");
        location.href = "/driver-pending.html";
        resolve(response);
      } else if (Array.isArray(response.detail)) {
        alert(
          response.detail
            .map((e) => `${e.loc.at(-1)}: ${e.msg}`)
            .join("\n")
        );
        reject(response);
      } else {
        alert(response.detail || "Upload failed");
        reject(response);
      }
    };

    xhr.onerror = () => {
      alert("❌ Network error during upload");
      reject();
    };

    xhr.send(form);
  });
}
