import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { apiFetch } from "./api.js";

initializeApp(firebaseConfig);
onAuthStateChanged(getAuth(), (user) => {
  if (!user) window.location.href = "../index.html";
  else loadConversation();
});

const conversationId = new URLSearchParams(window.location.search).get("id");

const nameEl = document.getElementById("customer-name");
const badgeEl = document.getElementById("status-badge");
const controlsEl = document.getElementById("controls");
const messagesEl = document.getElementById("messages");
const replyForm = document.getElementById("reply-form");
const replyInput = document.getElementById("reply-input");
const replyHint = document.getElementById("reply-hint");
const errorText = document.getElementById("error-text");

if (!conversationId) {
  nameEl.textContent = "Conversation not found";
}

async function loadConversation() {
  if (!conversationId) return;
  try {
    const conv = await apiFetch(`/api/conversations/${conversationId}`);
    render(conv);
  } catch (err) {
    showError(err.message);
  }
}

function render(conv) {
  const name = conv.customer?.name || conv.customer?.whatsapp_number || "Unknown customer";
  nameEl.textContent = name;
  badgeEl.textContent = conv.status;
  badgeEl.className = `status-badge ${conv.status}`;

  renderControls(conv.status);
  renderMessages(conv.messages || []);

  // Reply form only makes sense once the owner has actually taken over —
  // sending owner messages while the assistant is still active would be
  // confusing (customer would get two different "voices").
  replyForm.style.display = conv.status === "human" ? "flex" : "none";
  replyHint.textContent =
    conv.status === "assistant"
      ? "The assistant is currently handling this conversation. Take over to reply yourself."
      : conv.status === "closed"
      ? "This conversation is closed."
      : "";
}

function renderControls(status) {
  controlsEl.innerHTML = "";

  if (status === "assistant") {
    controlsEl.appendChild(makeButton("Take over conversation", "secondary-btn", () => setStatus("human")));
  }
  if (status === "human") {
    controlsEl.appendChild(makeButton("Return to assistant", "secondary-btn", () => setStatus("assistant")));
  }
  if (status !== "closed") {
    controlsEl.appendChild(makeButton("Close conversation", "danger-btn", () => setStatus("closed")));
  } else {
    controlsEl.appendChild(makeButton("Reopen (to assistant)", "secondary-btn", () => setStatus("assistant")));
  }
}

function makeButton(label, cls, onClick) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `small-btn ${cls}`;
  btn.textContent = label;
  btn.addEventListener("click", onClick);
  return btn;
}

async function setStatus(status) {
  hideError();
  try {
    await apiFetch(`/api/conversations/${conversationId}`, { method: "PATCH", body: { status } });
    loadConversation();
  } catch (err) {
    showError(err.message);
  }
}

function renderMessages(messages) {
  messagesEl.innerHTML = "";
  for (const m of messages) {
    const row = document.createElement("div");
    const senderClass = m.sender === "customer" ? "customer" : m.sender === "owner" ? "owner" : "assistant";
    row.className = `msg ${senderClass}`;
    const label = m.sender === "customer" ? "Customer" : m.sender === "owner" ? "You" : "Assistant";
    row.innerHTML = `<div class="msg-bubble"><span class="msg-label">${label}</span>${escapeHtml(m.text)}</div>`;
    messagesEl.appendChild(row);
  }
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

replyForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = replyInput.value.trim();
  if (!text) return;
  hideError();

  try {
    await apiFetch(`/api/conversations/${conversationId}/messages`, { method: "POST", body: { text } });
    replyInput.value = "";
    loadConversation();
  } catch (err) {
    showError(err.message);
  }
});

function showError(msg) {
  errorText.textContent = msg;
  errorText.classList.add("visible");
}
function hideError() {
  errorText.classList.remove("visible");
}
function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
