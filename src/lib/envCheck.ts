/**
 * Guarda de ambiente para builds fora da Lovable (Vercel, self-hosting).
 *
 * O cliente Supabase é gerado automaticamente e lê as variáveis do Vite em tempo
 * de build. Se elas não estiverem cadastradas no provedor de hospedagem, o app
 * sobe com `undefined` e falha sem mensagem clara. Aqui detectamos isso cedo e
 * mostramos um erro legível em vez de uma tela preta.
 */

const REQUIRED = [
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
  'VITE_SUPABASE_PROJECT_ID',
] as const;

export function assertSupabaseEnv() {
  const env = import.meta.env as unknown as Record<string, string | undefined>;
  const missing = REQUIRED.filter((key) => !env[key]);

  if (missing.length === 0) return;

  const message =
    `Configuração ausente: ${missing.join(', ')}. ` +
    'Cadastre estas variáveis no ambiente de deploy e publique novamente.';

  console.error(message);

  if (typeof document !== 'undefined') {
    const root = document.getElementById('root');
    if (root) {
      root.innerHTML =
        '<div style="font-family:system-ui,sans-serif;padding:2rem;max-width:40rem;margin:0 auto">' +
        '<h1 style="font-size:1.25rem;margin-bottom:.5rem">Aplicação não configurada</h1>' +
        `<p style="line-height:1.5">${message}</p>` +
        '</div>';
    }
  }

  throw new Error(message);
}
