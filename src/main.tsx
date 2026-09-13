import React from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./styles/process-selection-refinement.css";
import { assertSupabaseEnv } from "./lib/envCheck";

function renderBootstrapError(error: unknown) {
  console.error("[bootstrap]", error);
  const root = document.getElementById("root");
  if (!root || root.childElementCount > 0) return;

  const message = error instanceof Error ? error.message : "Não foi possível iniciar a aplicação.";
  root.innerHTML =
    '<div style="font-family:system-ui,sans-serif;padding:2rem;max-width:42rem;margin:4rem auto;color:#111827">' +
    '<h1 style="font-size:1.25rem;margin:0 0 .75rem">Não foi possível carregar o VEG System</h1>' +
    `<p style="line-height:1.6;color:#4b5563">${message}</p>` +
    '<p style="line-height:1.6;color:#6b7280;font-size:.875rem">Atualize a página. Se o problema persistir, revise as variáveis públicas do ambiente de preview.</p>' +
    '</div>';
}

async function bootstrap() {
  // Valida a configuração antes de importar módulos que inicializam o cliente
  // Supabase. Isso evita uma tela branca caso um ambiente seja publicado sem
  // as variáveis públicas necessárias.
  assertSupabaseEnv();

  if ("caches" in window) {
    void caches.delete("supabase-api");
  }

  const [appModule, notificationModule, activityModule] = await Promise.all([
    import("./App.tsx"),
    import("./hooks/useNativeNotifications"),
    import("./lib/activityAutoLog"),
  ]);

  notificationModule.setupNotificationChannel();
  activityModule.installActivityAutoLog();

  const App = appModule.default;
  createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
}

void bootstrap().catch(renderBootstrapError);
