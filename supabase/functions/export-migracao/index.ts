// FUNÇÃO TEMPORÁRIA DE MIGRAÇÃO — remover após a virada.
// Copia os dados das tabelas da origem (Lovable Cloud) para o projeto Supabase destino.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  TABLE_ORDER,
  countAtDestination,
  pageSizeFor,
  requireAdmin,
  requireDstKey,
  srcClient,
  upsertToDestination,
} from "../_shared/migracao.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return json({ error: auth.error }, auth.status);

    const missing = requireDstKey();
    if (missing) return json({ error: missing }, 400);

    const body = await req.json().catch(() => ({}));
    const action: string = body.action ?? "copy";
    const only: string[] | undefined = Array.isArray(body.tables) && body.tables.length ? body.tables : undefined;
    const tables = (only ?? TABLE_ORDER).filter((t) => TABLE_ORDER.includes(t));

    const src = srcClient();

    if (action === "verify") {
      const results: Array<Record<string, unknown>> = [];
      for (const table of tables) {
        const { count: srcCount, error } = await src.from(table).select("*", { count: "exact", head: true });
        const dstCount = await countAtDestination(table);
        results.push({
          table,
          origem: error ? null : srcCount ?? 0,
          destino: dstCount,
          ok: !error && (srcCount ?? 0) === (dstCount ?? -1),
          erro: error?.message ?? null,
        });
      }
      return json({ action, results });
    }

    // action === "copy"
    const results: Array<Record<string, unknown>> = [];
    for (const table of tables) {
      const limit = pageSizeFor(table);
      let from = 0;
      let copied = 0;
      let erro: string | null = null;

      try {
        // eslint-disable-next-line no-constant-condition
        while (true) {
          const { data, error } = await src
            .from(table)
            .select("*")
            .order("id", { ascending: true })
            .range(from, from + limit - 1);

          if (error) throw new Error(error.message);
          if (!data || data.length === 0) break;

          await upsertToDestination(table, data);
          copied += data.length;
          if (data.length < limit) break;
          from += limit;
        }
      } catch (e) {
        erro = e instanceof Error ? e.message : String(e);
      }

      results.push({ table, copiadas: copied, erro });
    }

    return json({ action: "copy", results });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
