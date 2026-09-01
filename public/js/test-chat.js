import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { apiFetch } from "./api.js";

initializeApp(firebaseConfig);
onAuthStateChanged(getAuth(), (user) => {
  if (!user) window.location.href = "../index.html";
});

const messagesEl = document.getElementById("messages");
const form = document.getElementById("chat-form");
const input = document.getElementById("chat-input");
const sendBtn = document.getElementById("send-btn");
const errorText = document.getElementById("error-text");

let history = []; // [{ role, content }]

appendMessage("assistant", "Send a message to see how your assistant responds using your current Products and Knowledge.", false);

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const message = input.value.trim();
  if (!message) return;

  hideError();
  appendMessage("user", message);
  history.push({ role: "user", content: message });
  input.value = "";
  input.disabled = true;
  sendBtn.disabled = true;

  const typingEl = appendMessage("assistant", "Typing…", false, true);

  try {
    const result = await apiFetch("/api/assistant/test-chat", {
      method: "POST",
      body: { message, history: history.slice(0, -1) },
    });
    typingEl.remove();
    appendMessage("assistant", result.reply, result.needsHuman);
    history.push({ role: "assistant", content: result.reply });
  } catch (err) {
    typingEl.remove();
    showError(err.message);
  } finally {
    input.disabled = false;
    sendBtn.disabled = false;
    input.focus();
  }
});

function appendMessage(role, text, needsHuman = false, isTyping = false) {
  const row = document.createElement("div");
  row.className = `msg ${role}`;
  const bubble = document.createElement("div");
  bubble.className = `msg-bubble${needsHuman ? " needs-human" : ""}`;
  bubble.textContent = text;
  if (needsHuman && !isTyping) {
    const tag = document.createElement("span");
    tag.className = "needs-human-tag";
    tag.textContent = "Assistant suggests human handoff";
    bubble.appendChild(tag);
  }
  row.appendChild(bubble);
  messagesEl.appendChild(row);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return row;
}

function showError(msg) {
  errorText.textContent = msg;
  errorText.classList.add("visible");
}
function hideError() {
  errorText.classList.remove("visible");
}
