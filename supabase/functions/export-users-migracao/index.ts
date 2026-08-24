// FUNÇÃO TEMPORÁRIA DE MIGRAÇÃO — remover após a virada.
// Recria os usuários da origem no projeto destino, preservando o mesmo UUID.
// As senhas NÃO migram (hashes não são acessíveis por API); os usuários redefinem no primeiro acesso.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { DST_SERVICE_KEY, DST_URL, requireAdmin, requireDstKey, srcClient } from "../_shared/migracao.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

async function createAtDestination(user: {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
  email_confirmed_at?: string | null;
}) {
  const res = await fetch(`${DST_URL}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      apikey: DST_SERVICE_KEY,
      Authorization: `Bearer ${DST_SERVICE_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      id: user.id,
      email: user.email,
      email_confirm: Boolean(user.email_confirmed_at),
      user_metadata: user.user_metadata ?? {},
    }),
  });

  if (res.ok) return "criado";

  const text = await res.text();
  if (res.status === 422 && /already been registered|already exists|duplicate/i.test(text)) return "existente";
  throw new Error(`${user.email ?? user.id}: ${res.status} — ${text.slice(0, 300)}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return json({ error: auth.error }, auth.status);

    const missing = requireDstKey();
    if (missing) return json({ error: missing }, 400);

    const body = await req.json().catch(() => ({}));
    const dryRun: boolean = body.dry_run === true;

    const src = srcClient();
    const criados: string[] = [];
    const existentes: string[] = [];
    const falhas: string[] = [];
    let total = 0;

    for (let page = 1; page <= 50; page++) {
      const { data, error } = await src.auth.admin.listUsers({ page, perPage: 200 });
      if (error) throw new Error(error.message);
      const users = data?.users ?? [];
      if (users.length === 0) break;
      total += users.length;

      for (const u of users) {
        if (dryRun) continue;
        try {
          const outcome = await createAtDestination(u as never);
          (outcome === "criado" ? criados : existentes).push(u.email ?? u.id);
        } catch (e) {
          falhas.push(e instanceof Error ? e.message : String(e));
        }
      }

      if (users.length < 200) break;
    }

    return json({
      total_origem: total,
      dry_run: dryRun,
      criados: criados.length,
      existentes: existentes.length,
      falhas,
      aviso: "Senhas não migram — os usuários precisam usar 'esqueci minha senha' no primeiro acesso ao novo backend.",
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
