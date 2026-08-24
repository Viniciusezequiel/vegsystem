// FUNÇÃO TEMPORÁRIA DE MIGRAÇÃO — remover após a virada.
// Copia os arquivos dos buckets lost-items e task-attachments para o projeto destino.
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { DST_SERVICE_KEY, DST_URL, requireAdmin, requireDstKey, srcClient } from "../_shared/migracao.ts";

const BUCKETS = ["lost-items", "task-attachments"];

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Entry = { path: string; isFolder: boolean };

async function listAll(src: ReturnType<typeof srcClient>, bucket: string, prefix = ""): Promise<string[]> {
  const files: string[] = [];
  const stack: string[] = [prefix];

  while (stack.length) {
    const dir = stack.pop()!;
    let offset = 0;
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { data, error } = await src.storage.from(bucket).list(dir, { limit: 100, offset });
      if (error) throw new Error(`${bucket}/${dir}: ${error.message}`);
      if (!data || data.length === 0) break;

      for (const item of data) {
        const entry: Entry = {
          path: dir ? `${dir}/${item.name}` : item.name,
          isFolder: item.id === null,
        };
        if (entry.isFolder) stack.push(entry.path);
        else files.push(entry.path);
      }

      if (data.length < 100) break;
      offset += 100;
    }
  }
  return files;
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
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`upload ${bucket}/${path}: ${res.status} — ${body.slice(0, 300)}`);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await requireAdmin(req);
    if (!auth.ok) return json({ error: auth.error }, auth.status);

    const missing = requireDstKey();
    if (missing) return json({ error: missing }, 400);

    const body = await req.json().catch(() => ({}));
    const bucket: string = body.bucket ?? BUCKETS[0];
    if (!BUCKETS.includes(bucket)) return json({ error: "Bucket inválido" }, 400);
    const start: number = Number(body.start ?? 0);
    const batch: number = Math.min(Number(body.batch ?? 50), 200);

    const src = srcClient();
    const all = await listAll(src, bucket);
    const slice = all.slice(start, start + batch);

    let copied = 0;
    const falhas: string[] = [];

    for (const path of slice) {
      try {
        const { data, error } = await src.storage.from(bucket).download(path);
        if (error || !data) throw new Error(error?.message ?? "download vazio");
        await uploadToDestination(bucket, path, data);
        copied++;
      } catch (e) {
        falhas.push(`${path}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    const next = start + slice.length;
    return json({
      bucket,
      total: all.length,
      processados: next,
      copiados: copied,
      falhas,
      concluido: next >= all.length,
      proximo_start: next >= all.length ? null : next,
    });
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
