import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { apiFetch } from "./api.js";
import { uploadFile } from "./upload.js";

initializeApp(firebaseConfig);
onAuthStateChanged(getAuth(), (user) => {
  if (!user) window.location.href = "../index.html";
  else loadItems();
});

const form = document.getElementById("knowledge-form");
const typeEl = document.getElementById("type");
const faqFields = document.getElementById("faq-fields");
const instructionFields = document.getElementById("instruction-fields");
const submitBtn = document.getElementById("submit-btn");
const formTitle = document.getElementById("form-title");
const cancelBtn = document.getElementById("cancel-edit");
const errorText = document.getElementById("error-text");
const listEl = document.getElementById("knowledge-list");
const emptyState = document.getElementById("empty-state");
const editIdField = document.getElementById("edit-id");

typeEl.addEventListener("change", updateFieldVisibility);
function updateFieldVisibility() {
  const isFaq = typeEl.value === "faq";
  faqFields.style.display = isFaq ? "block" : "none";
  instructionFields.style.display = isFaq ? "none" : "block";
}

async function loadItems() {
  try {
    const items = await apiFetch("/api/knowledge");
    renderList(items);
  } catch (err) {
    showError(err.message);
  }
}

function renderList(items) {
  listEl.innerHTML = "";
  emptyState.style.display = items.length === 0 ? "block" : "none";

  for (const item of items) {
    const card = document.createElement("div");
    card.className = "item-card";
    const title = item.type === "faq" ? item.question : "Instruction";
    const body = item.type === "faq" ? item.answer : item.content;
    card.innerHTML = `
      <div class="item-body">
        <div class="item-title">${escapeHtml(title)}
          <span class="badge ${item.enabled ? "" : "off"}">${item.enabled ? "Enabled" : "Disabled"}</span>
        </div>
        <div class="item-meta">${item.type === "faq" ? "FAQ" : "General instruction"}${item.file_url ? " · has attachment" : ""}</div>
        <div class="item-desc">${escapeHtml(body)}</div>
        <div class="item-actions">
          <button class="small-btn secondary-btn" data-action="edit">Edit</button>
          <button class="small-btn secondary-btn" data-action="toggle">${item.enabled ? "Disable" : "Enable"}</button>
          <button class="small-btn danger-btn" data-action="delete">Delete</button>
        </div>
      </div>
    `;
    card.querySelector('[data-action="edit"]').addEventListener("click", () => startEdit(item));
    card.querySelector('[data-action="toggle"]').addEventListener("click", () => toggleEnabled(item));
    card.querySelector('[data-action="delete"]').addEventListener("click", () => removeItem(item));
    listEl.appendChild(card);
  }
}

function startEdit(item) {
  editIdField.value = item.id;
  typeEl.value = item.type;
  updateFieldVisibility();
  if (item.type === "faq") {
    document.getElementById("question").value = item.question || "";
    document.getElementById("answer").value = item.answer || "";
  } else {
    document.getElementById("content").value = item.content || "";
  }
  formTitle.textContent = "Editing knowledge item";
  submitBtn.textContent = "Save changes";
  cancelBtn.style.display = "block";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  form.reset();
  editIdField.value = "";
  updateFieldVisibility();
  formTitle.textContent = "Add knowledge";
  submitBtn.textContent = "Add";
  cancelBtn.style.display = "none";
}
cancelBtn.addEventListener("click", resetForm);

async function toggleEnabled(item) {
  try {
    await apiFetch(`/api/knowledge/${item.id}`, { method: "PATCH", body: { enabled: !item.enabled } });
    loadItems();
  } catch (err) {
    showError(err.message);
  }
}

async function removeItem(item) {
  if (!confirm("Delete this knowledge item? This can't be undone.")) return;
  try {
    await apiFetch(`/api/knowledge/${item.id}`, { method: "DELETE" });
    loadItems();
  } catch (err) {
    showError(err.message);
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();
  submitBtn.disabled = true;

  try {
    const payload = { type: typeEl.value };
    if (typeEl.value === "faq") {
      payload.question = document.getElementById("question").value;
      payload.answer = document.getElementById("answer").value;
    } else {
      payload.content = document.getElementById("content").value;
    }

    const fileInput = document.getElementById("file");
    if (fileInput.files[0]) {
      payload.file_url = await uploadFile(fileInput.files[0], "knowledge");
    }

    const editId = editIdField.value;
    if (editId) {
      await apiFetch(`/api/knowledge/${editId}`, { method: "PATCH", body: payload });
    } else {
      await apiFetch("/api/knowledge", { method: "POST", body: payload });
    }

    resetForm();
    loadItems();
  } catch (err) {
    showError(err.message);
  } finally {
    submitBtn.disabled = false;
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
