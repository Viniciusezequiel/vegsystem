import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { assertSupabaseEnv } from "./lib/envCheck";
import { setupNotificationChannel } from "./hooks/useNativeNotifications";
import { installActivityAutoLog } from "./lib/activityAutoLog";

// Falha cedo e de forma legível se o ambiente de deploy não tiver as variáveis
assertSupabaseEnv();

// Setup native notification channel (no-op on web)
setupNotificationChannel();

// Registro automático de histórico de atividades em todos os módulos
installActivityAutoLog();


createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
