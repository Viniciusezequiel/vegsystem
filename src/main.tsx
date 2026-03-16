import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { setupNotificationChannel } from "./hooks/useNativeNotifications";

// Setup native notification channel (no-op on web)
setupNotificationChannel();

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
