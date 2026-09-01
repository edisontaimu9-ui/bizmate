import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { apiFetch } from "./api.js";
import { uploadFile } from "./upload.js";

initializeApp(firebaseConfig);
onAuthStateChanged(getAuth(), (user) => {
  if (!user) window.location.href = "../index.html";
  else loadProducts();
});

const form = document.getElementById("product-form");
const submitBtn = document.getElementById("submit-btn");
const formTitle = document.getElementById("form-title");
const cancelBtn = document.getElementById("cancel-edit");
const errorText = document.getElementById("error-text");
const listEl = document.getElementById("product-list");
const emptyState = document.getElementById("empty-state");
const editIdField = document.getElementById("edit-id");

const fields = ["type", "availability", "name", "description", "price", "currency", "category"];

async function loadProducts() {
  try {
    const products = await apiFetch("/api/products");
    renderList(products);
  } catch (err) {
    showError(err.message);
  }
}

function renderList(products) {
  listEl.innerHTML = "";
  emptyState.style.display = products.length === 0 ? "block" : "none";

  for (const p of products) {
    const card = document.createElement("div");
    card.className = "item-card";
    card.innerHTML = `
      ${p.image_url ? `<img class="item-thumb" src="${escapeAttr(p.image_url)}" alt="">` : `<div class="item-thumb"></div>`}
      <div class="item-body">
        <div class="item-title">${escapeHtml(p.name)}
          <span class="badge ${p.enabled ? "" : "off"}">${p.enabled ? "Enabled" : "Disabled"}</span>
        </div>
        <div class="item-meta">${escapeHtml(p.type)} · ${escapeHtml(p.availability)} · ${p.price ? `${escapeHtml(p.currency || "")} ${p.price}` : "No price set"}${p.category ? " · " + escapeHtml(p.category) : ""}</div>
        ${p.description ? `<div class="item-desc">${escapeHtml(p.description)}</div>` : ""}
        <div class="item-actions">
          <button class="small-btn secondary-btn" data-action="edit">Edit</button>
          <button class="small-btn secondary-btn" data-action="toggle">${p.enabled ? "Disable" : "Enable"}</button>
          <button class="small-btn danger-btn" data-action="delete">Delete</button>
        </div>
      </div>
    `;
    card.querySelector('[data-action="edit"]').addEventListener("click", () => startEdit(p));
    card.querySelector('[data-action="toggle"]').addEventListener("click", () => toggleEnabled(p));
    card.querySelector('[data-action="delete"]').addEventListener("click", () => removeProduct(p));
    listEl.appendChild(card);
  }
}

function startEdit(p) {
  editIdField.value = p.id;
  document.getElementById("type").value = p.type;
  document.getElementById("availability").value = p.availability;
  document.getElementById("name").value = p.name;
  document.getElementById("description").value = p.description || "";
  document.getElementById("price").value = p.price ?? "";
  document.getElementById("currency").value = p.currency || "MWK";
  document.getElementById("category").value = p.category || "";
  formTitle.textContent = `Editing: ${p.name}`;
  submitBtn.textContent = "Save changes";
  cancelBtn.style.display = "block";
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function resetForm() {
  form.reset();
  editIdField.value = "";
  document.getElementById("currency").value = "MWK";
  formTitle.textContent = "Add a product or service";
  submitBtn.textContent = "Add product";
  cancelBtn.style.display = "none";
}
cancelBtn.addEventListener("click", resetForm);

async function toggleEnabled(p) {
  try {
    await apiFetch(`/api/products/${p.id}`, { method: "PATCH", body: { enabled: !p.enabled } });
    loadProducts();
  } catch (err) {
    showError(err.message);
  }
}

async function removeProduct(p) {
  if (!confirm(`Delete "${p.name}"? This can't be undone.`)) return;
  try {
    await apiFetch(`/api/products/${p.id}`, { method: "DELETE" });
    loadProducts();
  } catch (err) {
    showError(err.message);
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();
  submitBtn.disabled = true;

  try {
    const payload = {};
    for (const key of fields) {
      const el = document.getElementById(key);
      payload[key] = key === "price" ? (el.value ? Number(el.value) : null) : el.value;
    }

    const photoInput = document.getElementById("photo");
    if (photoInput.files[0]) {
      payload.image_url = await uploadFile(photoInput.files[0], "product");
    }

    const editId = editIdField.value;
    if (editId) {
      await apiFetch(`/api/products/${editId}`, { method: "PATCH", body: payload });
    } else {
      await apiFetch("/api/products", { method: "POST", body: payload });
    }

    resetForm();
    loadProducts();
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
function escapeAttr(str) {
  return escapeHtml(str);
}
