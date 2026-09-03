import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { assertSupabaseEnv } from "./lib/envCheck";
import { setupNotificationChannel } from "./hooks/useNativeNotifications";
import { installActivityAutoLog } from "./lib/activityAutoLog";

// Falha cedo e de forma legível se o ambiente de deploy não tiver as variáveis
assertSupabaseEnv();

// Segurança: versões anteriores da PWA armazenavam respostas da API
// Supabase no Cache Storage. O sistema não depende desse cache para
// funcionar e ele não deve sobreviver entre sessões de usuários.
if ("caches" in window) {
  void caches.delete("supabase-api");
}

// Setup native notification channel (no-op on web)
setupNotificationChannel();

// Registro automático de histórico de atividades em todos os módulos
installActivityAutoLog();


createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
