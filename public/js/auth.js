import { firebaseConfig } from "./firebase-config.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.14.1/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.14.1/firebase-auth.js";
import { apiFetch } from "./api.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

let mode = "signin"; // "signin" | "signup"

const form = document.getElementById("auth-form");
const emailEl = document.getElementById("email");
const passwordEl = document.getElementById("password");
const displayNameEl = document.getElementById("displayName");
const nameField = document.getElementById("name-field");
const submitBtn = document.getElementById("submit-btn");
const errorText = document.getElementById("error-text");
const switchLink = document.getElementById("switch-link");
const switchCopy = document.getElementById("switch-copy");

switchLink.addEventListener("click", (e) => {
  e.preventDefault();
  mode = mode === "signin" ? "signup" : "signin";
  const isSignup = mode === "signup";
  submitBtn.textContent = isSignup ? "Create account" : "Sign in";
  switchCopy.textContent = isSignup ? "Already have an account?" : "Don't have an account?";
  switchLink.textContent = isSignup ? "Sign in" : "Sign up";
  nameField.style.display = isSignup ? "block" : "none";
  hideError();
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  hideError();
  submitBtn.disabled = true;

  try {
    if (mode === "signup") {
      await createUserWithEmailAndPassword(auth, emailEl.value, passwordEl.value);
      await apiFetch("/api/auth/profile", {
        method: "POST",
        body: { displayName: displayNameEl.value },
      });
    } else {
      await signInWithEmailAndPassword(auth, emailEl.value, passwordEl.value);
    }
    // onAuthStateChanged below handles redirect once Firebase confirms the session.
  } catch (err) {
    showError(friendlyError(err));
    submitBtn.disabled = false;
  }
});

onAuthStateChanged(auth, async (user) => {
  if (!user) return;
  try {
    // Does this account already have a business? If yes, go to the dashboard.
    // If not, send them to business setup. A 404 from /api/business means "no business yet".
    await apiFetch("/api/business");
    window.location.href = "pages/dashboard.html";
  } catch {
    window.location.href = "pages/setup.html";
  }
});

function showError(msg) {
  errorText.textContent = msg;
  errorText.classList.add("visible");
}
function hideError() {
  errorText.classList.remove("visible");
}
function friendlyError(err) {
  const code = err.code || "";
  if (code.includes("email-already-in-use")) return "An account with this email already exists.";
  if (code.includes("invalid-credential") || code.includes("wrong-password")) return "Incorrect email or password.";
  if (code.includes("weak-password")) return "Password should be at least 6 characters.";
  if (code.includes("user-not-found")) return "No account found with this email.";
  return err.message || "Something went wrong. Please try again.";
}
