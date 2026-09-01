import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { apiFetch } from "./api.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

onAuthStateChanged(auth, (user) => {
  if (!user) window.location.href = "../index.html";
});

const form = document.getElementById("setup-form");
const submitBtn = document.getElementById("submit-btn");
const errorText = document.getElementById("error-text");

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  submitBtn.disabled = true;
  errorText.classList.remove("visible");

  try {
    await apiFetch("/api/business", {
      method: "POST",
      body: {
        name: document.getElementById("name").value,
        description: document.getElementById("description").value,
        location: document.getElementById("location").value,
        phone: document.getElementById("phone").value,
      },
    });
    window.location.href = "dashboard.html";
  } catch (err) {
    errorText.textContent = err.message;
    errorText.classList.add("visible");
    submitBtn.disabled = false;
  }
});
