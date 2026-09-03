import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { apiFetch } from "./api.js";

initializeApp(firebaseConfig);
onAuthStateChanged(getAuth(), (user) => {
  if (!user) window.location.href = "../index.html";
  else loadStatus();
});

const statusLine = document.getElementById("status-line");
const form = document.getElementById("whatsapp-form");
const saveBtn = document.getElementById("save-btn");
const errorText = document.getElementById("error-text");

async function loadStatus() {
  try {
    const account = await apiFetch("/api/whatsapp");
    if (account.status === "connected") {
      statusLine.innerHTML = `<span class="status-badge assistant">connected</span> — Phone Number ID: ${escapeHtml(account.phone_number_id)}`;
      document.getElementById("phone-number-id").value = account.phone_number_id || "";
      document.getElementById("waba-id").value = account.waba_id || "";
    } else {
      statusLine.innerHTML = `<span class="status-badge human">not connected</span>`;
    }
  } catch (err) {
    statusLine.textContent = "Could not load connection status.";
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  errorText.classList.remove("visible");
  saveBtn.disabled = true;

  try {
    await apiFetch("/api/whatsapp", {
      method: "PATCH",
      body: {
        phoneNumberId: document.getElementById("phone-number-id").value,
        wabaId: document.getElementById("waba-id").value,
      },
    });
    await loadStatus();
  } catch (err) {
    errorText.textContent = err.message;
    errorText.classList.add("visible");
  } finally {
    saveBtn.disabled = false;
  }
});

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
