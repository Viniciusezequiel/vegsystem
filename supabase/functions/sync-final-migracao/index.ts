// FUNÇÃO TEMPORÁRIA DE MIGRAÇÃO — remover após a virada.
// Sincronização incremental + validação entre a origem (backend atual) e o destino.
// Não altera a origem. Não aplica exclusões (apenas relatório).
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import {
  DST_SERVICE_KEY,
  DST_URL,
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

const dstHeaders = (extra: Record<string, string> = {}) => ({
  apikey: DST_SERVICE_KEY,
  Authorization: `Bearer ${DST_SERVICE_KEY}`,
  "Content-Type": "application/json",
  ...extra,
});

async function dstSelect(table: string, select: string, filter = ""): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  const size = 1000;
  let off = 0;
  for (;;) {
    const res = await fetch(`${DST_URL}/rest/v1/${table}?select=${select}${filter}`, {
      headers: dstHeaders({ "Range-Unit": "items", Range: `${off}-${off + size - 1}` }),
    });
    if (!res.ok) throw new Error(`${table}: destino ${res.status} — ${(await res.text()).slice(0, 200)}`);
    const rows = (await res.json()) as Record<string, unknown>[];
    out.push(...rows);
    if (rows.length < size) return out;
    off += size;
  }
}

async function dstCount(table: string): Promise<number | null> {
  const res = await fetch(`${DST_URL}/rest/v1/${table}?select=id&limit=1`, {
    headers: dstHeaders({ Prefer: "count=exact", "Range-Unit": "items", Range: "0-0" }),
  });
  if (!res.ok) return null;
  const cr = res.headers.get("content-range");
  if (!cr) return null;
  const total = cr.split("/")[1];
  return total === "*" ? null : Number(total);
}

async function srcAll(
  table: string,
  select: string,
  corte?: string,
): Promise<Record<string, unknown>[]> {
  const src = srcClient();
  const size = pageSizeFor(table);
  const out: Record<string, unknown>[] = [];
  let from = 0;
  let mode: "both" | "created" | "all" = corte ? "both" : "all";

  for (;;) {
    let q = src.from(table).select(select).order("id", { ascending: true }).range(from, from + size - 1);
    if (mode === "both") q = q.or(`created_at.gte.${corte},updated_at.gte.${corte}`);
    if (mode === "created") q = q.gte("created_at", corte!);
    const { data, error } = await q;
    if (error) {
      if (mode === "both") { mode = "created"; continue; }
      if (mode === "created") { mode = "all"; continue; }
      throw new Error(`${table}: ${error.message}`);
    }
    const rows = (data ?? []) as Record<string, unknown>[];
    out.push(...rows);
    if (rows.length < size) return out;
    from += size;
  }
}

async function srcCount(table: string): Promise<number | null> {
  const src = srcClient();
  const { count, error } = await src.from(table).select("*", { count: "exact", head: true });
  if (error) return null;
  return count ?? 0;
}

type SFile = { path: string; size: number | null; updated: string | null };

async function srcListBucket(bucket: string): Promise<SFile[]> {
  const src = srcClient();
  const files: SFile[] = [];
  const stack = [""];
  while (stack.length) {
    const dir = stack.pop()!;
    let offset = 0;
    for (;;) {
      const { data, error } = await src.storage.from(bucket).list(dir, { limit: 100, offset });
      if (error) throw new Error(`${bucket}/${dir}: ${error.message}`);
      if (!data || data.length === 0) break;
      for (const it of data) {
        const path = dir ? `${dir}/${it.name}` : it.name;
        if (it.id === null) stack.push(path);
        else files.push({
          path,
          size: (it.metadata as Record<string, number> | null)?.size ?? null,
          updated: (it as { updated_at?: string }).updated_at ?? null,
        });
      }
      if (data.length < 100) break;
      offset += 100;
    }
  }
  return files;
}

async function dstListBucket(bucket: string): Promise<Map<string, number | null>> {
  const map = new Map<string, number | null>();
  const stack = [""];
  while (stack.length) {
    const dir = stack.pop()!;
    let offset = 0;
    for (;;) {
      const res = await fetch(`${DST_URL}/storage/v1/object/list/${bucket}`, {
        method: "POST",
        headers: dstHeaders(),
        body: JSON.stringify({ prefix: dir, limit: 100, offset, sortBy: { column: "name", order: "asc" } }),
      });
      if (!res.ok) throw new Error(`destino storage ${bucket}: ${res.status}`);
      const data = (await res.json()) as Array<Record<string, unknown>>;
      if (!data.length) break;
      for (const it of data) {
        const path = dir ? `${dir}/${it.name}` : String(it.name);
        if (it.id === null || it.id === undefined) stack.push(path);
        else map.set(path, ((it.metadata as Record<string, number> | null)?.size) ?? null);
      }
      if (data.length < 100) break;
      offset += 100;
    }
  }
  return map;
}

async function uploadToDestination(bucket: string, path: string, blob: Blob) {
  const res = await fetch(`${DST_URL}/storage/v1/object/${bucket}/${encodeURI(path)}`, {
    method: "POST",
    headers: {
      apikey: DST_SERVICE_KEY,
      Authorization: `Bearer ${DST_SERVICE_KEY}`,
      "Content-Type": blob.type || "application/octet-stream",
      "x-upsert": "true",
    },
    body: blob,
  });
  if (!res.ok) throw new Error(`upload ${path}: ${res.status} — ${(await res.text()).slice(0, 200)}`);
}

async function listUsersSrc() {
  const src = srcClient();
  const users: Array<Record<string, unknown>> = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await src.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw new Error(error.message);
    const batch = data?.users ?? [];
    users.push(...(batch as unknown as Array<Record<string, unknown>>));
    if (batch.length < 200) break;
  }
  return users;
}

async function listUsersDst() {
  const users: Array<Record<string, unknown>> = [];
  for (let page = 1; page <= 50; page++) {
    const res = await fetch(`${DST_URL}/auth/v1/admin/users?page=${page}&per_page=200`, {
      headers: dstHeaders(),
    });
    if (!res.ok) throw new Error(`destino auth ${res.status}`);
    const data = await res.json();
    const batch = (data.users ?? data) as Array<Record<string, unknown>>;
    if (!batch.length) break;
    users.push(...batch);
    if (batch.length < 200) break;
  }
  return users;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return json({ error: auth.error }, auth.status);
    const missing = requireDstKey();
    if (missing) return json({ error: missing }, 400);

    const body = await req.json().catch(() => ({}));
    const step: string = body.step ?? "data";
    const corte: string = body.corte ?? "2026-08-25T16:45:00Z";
    const tables: string[] = Array.isArray(body.tables) ? body.tables : [];

    // 1) DADOS — upsert incremental
    if (step === "data") {
      const results: Array<Record<string, unknown>> = [];
      for (const t of tables) {
        try {
          const rows = await srcAll(t, "*", corte);
          for (let i = 0; i < rows.length; i += 200) {
            await upsertToDestination(t, rows.slice(i, i + 200));
          }
          results.push({ table: t, enviados: rows.length, erro: null });
        } catch (e) {
          results.push({ table: t, enviados: 0, erro: e instanceof Error ? e.message : String(e) });
        }
      }
      return json({ step, corte, results });
    }

    // 2) EXCLUSÕES — apenas relatório
    if (step === "exclusoes") {
      const results: Array<Record<string, unknown>> = [];
      for (const t of tables) {
        try {
          const s = new Set((await srcAll(t, "id")).map((r) => String(r.id)));
          const d = (await dstSelect(t, "id")).map((r) => String(r.id));
          const extra = d.filter((i) => !s.has(i));
          results.push({ table: t, origem: s.size, destino: d.length, so_no_destino: extra.length, ids: extra.slice(0, 50) });
        } catch (e) {
          results.push({ table: t, erro: e instanceof Error ? e.message : String(e) });
        }
      }
      return json({ step, results });
    }

    // 3) STORAGE — incremental
    if (step === "storage") {
      const bucket: string = body.bucket;
      const batch = Math.min(Number(body.batch ?? 60), 200);
      const start = Number(body.start ?? 0);
      const srcFiles = await srcListBucket(bucket);
      const dstMap = await dstListBucket(bucket);
      const pend = srcFiles.filter((f) => !dstMap.has(f.path) || (f.size !== null && dstMap.get(f.path) !== null && dstMap.get(f.path) !== f.size));
      const slice = pend.slice(start, start + batch);
      const src = srcClient();
      let copiados = 0;
      const falhas: string[] = [];
      for (const f of slice) {
        try {
          const { data, error } = await src.storage.from(bucket).download(f.path);
          if (error || !data) throw new Error(error?.message ?? "download vazio");
          await uploadToDestination(bucket, f.path, data);
          copiados++;
        } catch (e) {
          falhas.push(`${f.path}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      const next = start + slice.length;
      return json({
        step, bucket,
        origem_total: srcFiles.length,
        destino_total: dstMap.size,
        pendentes: pend.length,
        copiados,
        falhas,
        concluido: next >= pend.length,
        proximo_start: next >= pend.length ? null : next,
      });
    }

    // 4) AUTH — usuários novos
    if (step === "auth") {
      const su = await listUsersSrc();
      const du = await listUsersDst();
      const dIds = new Set(du.map((u) => String(u.id)));
      const novos = su.filter((u) => !dIds.has(String(u.id)));
      const criados: string[] = [];
      const falhas: string[] = [];
      for (const u of novos) {
        try {
          const res = await fetch(`${DST_URL}/auth/v1/admin/users`, {
            method: "POST",
            headers: dstHeaders(),
            body: JSON.stringify({
              id: u.id,
              email: u.email,
              email_confirm: Boolean(u.email_confirmed_at),
              user_metadata: u.user_metadata ?? {},
            }),
          });
          if (!res.ok) {
            const txt = await res.text();
            if (!/already been registered|already exists|duplicate/i.test(txt)) throw new Error(`${res.status} ${txt.slice(0, 200)}`);
          }
          criados.push(String(u.email ?? u.id));
        } catch (e) {
          falhas.push(e instanceof Error ? e.message : String(e));
        }
      }
      return json({ step, origem: su.length, destino_antes: du.length, novos: novos.length, criados: criados.length, emails: criados, falhas });
    }

    // 5) VALIDAÇÃO de tabelas
    if (step === "validar") {
      const results: Array<Record<string, unknown>> = [];
      for (const t of tables) {
        try {
          const a = await srcCount(t);
          const b = await dstCount(t);
          let sRows: Record<string, unknown>[];
          let dRows: Record<string, unknown>[];
          try {
            sRows = await srcAll(t, "id,updated_at");
            dRows = await dstSelect(t, "id,updated_at");
          } catch {
            sRows = await srcAll(t, "id");
            dRows = await dstSelect(t, "id");
          }
          const sMap = new Map(sRows.map((r) => [String(r.id), r.updated_at ?? null]));
          const dMap = new Map(dRows.map((r) => [String(r.id), r.updated_at ?? null]));
          const faltando: string[] = [];
          const divergentes: string[] = [];
          for (const [id, up] of sMap) {
            if (!dMap.has(id)) faltando.push(id);
            else if (dMap.get(id) !== up) divergentes.push(id);
          }
          const sobrando = [...dMap.keys()].filter((id) => !sMap.has(id));
          // pós-corte
          let posSrc: number | null = null, posDst: number | null = null;
          try {
            posSrc = (await srcAll(t, "id", corte)).length;
            posDst = (await dstSelect(t, "id", `&or=(created_at.gte.${corte},updated_at.gte.${corte})`)).length;
          } catch { /* tabela sem colunas temporais */ }
          results.push({
            table: t, origem: a, destino: b,
            faltando_no_destino: faltando.length, sobrando_no_destino: sobrando.length,
            divergentes: divergentes.length,
            exemplos: [...faltando.slice(0, 5), ...sobrando.slice(0, 5), ...divergentes.slice(0, 5)],
            pos_corte_origem: posSrc, pos_corte_destino: posDst,
            ok: a === b && !faltando.length && !sobrando.length && !divergentes.length,
          });
        } catch (e) {
          results.push({ table: t, erro: e instanceof Error ? e.message : String(e), ok: false });
        }
      }
      return json({ step, corte, results });
    }

    // 6) VALIDAÇÃO auth + storage
    if (step === "validar_auth") {
      const su = await listUsersSrc();
      const du = await listUsersDst();
      const sMap = new Map(su.map((u) => [String(u.id), String(u.email ?? "").toLowerCase()]));
      const dMap = new Map(du.map((u) => [String(u.id), String(u.email ?? "").toLowerCase()]));
      const faltando = [...sMap.keys()].filter((i) => !dMap.has(i));
      const emailDif = [...sMap.keys()].filter((i) => dMap.has(i) && dMap.get(i) !== sMap.get(i));
      return json({ step, origem: sMap.size, destino: dMap.size, faltando, email_divergente: emailDif, ok: !faltando.length && !emailDif.length });
    }

    if (step === "validar_storage") {
      const bucket: string = body.bucket;
      const s = await srcListBucket(bucket);
      const d = await dstListBucket(bucket);
      const faltando = s.filter((f) => !d.has(f.path)).map((f) => f.path);
      const tamanho = s.filter((f) => d.has(f.path) && f.size !== null && d.get(f.path) !== null && d.get(f.path) !== f.size).map((f) => f.path);
      return json({
        step, bucket, origem: s.length, destino: d.size,
        faltando: faltando.length, exemplos_faltando: faltando.slice(0, 10),
        tamanho_divergente: tamanho.length, exemplos_tamanho: tamanho.slice(0, 10),
        ok: !faltando.length && !tamanho.length,
      });
    }

    // 7) FKs órfãs no destino
    if (step === "fks") {
      const fks: Array<[string, string, string]> = body.fks ?? [];
      const cache = new Map<string, Set<string>>();
      const authIds = new Set((await listUsersDst()).map((u) => String(u.id)));
      const results: Array<Record<string, unknown>> = [];
      for (const [child, col, parent] of fks) {
        try {
          let alvo: Set<string>;
          if (parent === "__auth_users") alvo = authIds;
          else {
            if (!cache.has(parent)) cache.set(parent, new Set((await dstSelect(parent, "id")).map((r) => String(r.id))));
            alvo = cache.get(parent)!;
          }
          const rows = await dstSelect(child, `id,${col}`);
          const orf = rows.filter((r) => r[col] && !alvo.has(String(r[col]))).map((r) => String(r.id));
          results.push({ child, col, parent, orfas: orf.length, exemplos: orf.slice(0, 5) });
        } catch (e) {
          results.push({ child, col, parent, erro: e instanceof Error ? e.message : String(e) });
        }
      }
      return json({ step, results });
    }

    if (step === "peek") {
      const t: string = body.table;
      const id: string = body.id;
      const rows = await dstSelect(t, "*", `&id=eq.${id}`);
      return json({ step, destino: rows[0] ?? null });
    }

    return json({ error: `step desconhecido: ${step}` }, 400);
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
