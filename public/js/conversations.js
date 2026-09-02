import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { apiFetch } from "./api.js";

initializeApp(firebaseConfig);
onAuthStateChanged(getAuth(), (user) => {
  if (!user) window.location.href = "../index.html";
  else loadConversations();
});

const listEl = document.getElementById("conv-list");
const emptyState = document.getElementById("empty-state");
const simForm = document.getElementById("simulate-form");
const simBtn = document.getElementById("simulate-btn");
const simError = document.getElementById("sim-error");

async function loadConversations() {
  try {
    const conversations = await apiFetch("/api/conversations");
    renderList(conversations);
  } catch (err) {
    console.error(err);
  }
}

function renderList(conversations) {
  listEl.innerHTML = "";
  emptyState.style.display = conversations.length === 0 ? "block" : "none";

  for (const c of conversations) {
    const name = c.customer?.name || c.customer?.whatsapp_number || "Unknown customer";
    const time = c.last_message_at ? formatTime(c.last_message_at) : "";
    const a = document.createElement("a");
    a.href = `conversation.html?id=${c.id}`;
    a.className = "conv-item";
    a.innerHTML = `
      <div class="conv-top">
        <span class="conv-name">${escapeHtml(name)}</span>
        <span class="conv-time">${escapeHtml(time)}</span>
      </div>
      <div class="conv-preview">${escapeHtml(c.last_message_preview || "")}</div>
      <span class="status-badge ${c.status}">${escapeHtml(c.status)}</span>
    `;
    listEl.appendChild(a);
  }
}

simForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  simError.classList.remove("visible");
  simBtn.disabled = true;

  try {
    const result = await apiFetch("/api/dev/simulate-message", {
      method: "POST",
      body: {
        whatsappNumber: document.getElementById("whatsapp-number").value,
        customerName: document.getElementById("customer-name").value,
        message: document.getElementById("sim-message").value,
      },
    });
    document.getElementById("sim-message").value = "";
    await loadConversations();
    if (result.conversation?.id) {
      window.location.href = `conversation.html?id=${result.conversation.id}`;
    }
  } catch (err) {
    simError.textContent = err.message;
    simError.classList.add("visible");
  } finally {
    simBtn.disabled = false;
  }
});

function formatTime(iso) {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
