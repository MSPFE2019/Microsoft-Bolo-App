import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { setConfig } from "@microsoft/power-apps/app";
import App from "./App";
import "./styles.css";

// Complete the Power Apps host handshake. Safe to no-op when running locally
// outside the Power Apps player.
try {
  setConfig({});
} catch (error) {
  console.warn("Power Apps SDK not initialized (running standalone).", error);
}

let mounted = false;

function renderFallback(message: string) {
  // Once React owns the DOM it reports its own errors inline. Replacing the
  // tree here would blow the whole app away over a single failed request.
  if (mounted) {
    console.error("BOLO App error:", message);
    return;
  }
  const root = document.getElementById("root");
  if (root) {
    root.innerHTML =
      '<div style="font:14px system-ui;padding:32px;color:#b3261e">' +
      "Failed to start BOLO App: " +
      message +
      "</div>";
  }
}

window.addEventListener("error", (event) => renderFallback(String(event.message)));
window.addEventListener("unhandledrejection", (event) => renderFallback(String(event.reason)));

try {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  mounted = true;
} catch (error) {
  renderFallback(String(error));
}