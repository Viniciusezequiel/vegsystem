import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

// O frontend Supabase usa somente credenciais publicáveis. Alguns previews da
// Vercel podem não herdar variáveis cadastradas apenas em Production; nesse
// caso o bundle falharia antes mesmo de o React montar e exibiria tela branca.
// Mantemos um fallback exclusivamente para builds Vercel e apenas quando a
// variável não existe. Service role, senha de banco e secrets nunca entram aqui.
function ensureVercelPublicSupabaseEnv() {
  if (process.env.VERCEL !== "1") return;

  process.env.VITE_SUPABASE_URL ||= "https://sshyjnyvihdheofjzsca.supabase.co";
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ||= "sb_publishable_d1JDBMEyTj5o6dIOLlGrNw_TKTZ1oNj";
  process.env.VITE_SUPABASE_PROJECT_ID ||= "sshyjnyvihdheofjzsca";
}

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  ensureVercelPublicSupabaseEnv();

  return {
    server: {
      host: "::",
      port: 8080,
    },
    plugins: [
      react(),
      mode === "development" && componentTagger(),
      VitePWA({
        registerType: "autoUpdate",
        includeAssets: ["favicon.ico", "pwa-192x192.png", "pwa-512x512.png"],
        manifest: {
          name: "VEG System - Sistema de Gestão",
          short_name: "VEG System",
          description: "Sistema de gestão integrado com chamados de sala, equipamentos, achados e perdidos e mais.",
          theme_color: "#16a34a",
          background_color: "#ffffff",
          display: "standalone",
          orientation: "any",
          start_url: "/",
          icons: [
            {
              src: "pwa-192x192.png",
              sizes: "192x192",
              type: "image/png",
            },
            {
              src: "pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
            },
            {
              src: "pwa-512x512.png",
              sizes: "512x512",
              type: "image/png",
              purpose: "any maskable",
            },
          ],
        },
        workbox: {
          globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
          maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
          navigateFallbackDenylist: [/^\/~oauth/],
          // Não armazenar respostas autenticadas do Supabase no
          // Cache Storage do navegador. Dados da API devem sempre
          // respeitar a sessão/RLS corrente.
          runtimeCaching: [],
        },
      }),
    ].filter(Boolean),
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "./src"),
      },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "@tanstack/react-query",
        "react-router-dom",
        "@radix-ui/react-dialog",
        "@radix-ui/react-label",
        "@radix-ui/react-popover",
        "@radix-ui/react-radio-group",
        "@radix-ui/react-select",
        "@supabase/supabase-js",
      ],
    },
    optimizeDeps: {
      include: [
        "@tanstack/react-query",
        "react-router-dom",
        "@supabase/supabase-js",
      ],
    },
  };
});
