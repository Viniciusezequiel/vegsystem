// Copia os arquivos dos buckets da origem para o destino.
// Uso: source migracao/.env.migracao && node migracao/03-storage-copy.mjs
import { createClient } from "@supabase/supabase-js";

const {
  SRC_URL,
  SRC_SERVICE_KEY,
  DST_URL,
  DST_SERVICE_KEY,
} = process.env;

for (const [k, v] of Object.entries({ SRC_URL, SRC_SERVICE_KEY, DST_URL, DST_SERVICE_KEY })) {
  if (!v) {
    console.error(`Variável ${k} não definida. Veja migracao/README.md`);
    process.exit(1);
  }
}

const src = createClient(SRC_URL, SRC_SERVICE_KEY, { auth: { persistSession: false } });
const dst = createClient(DST_URL, DST_SERVICE_KEY, { auth: { persistSession: false } });

const BUCKETS = [
  { name: "lost-items", public: false },
  { name: "task-attachments", public: false },
];

async function ensureBucket(bucket) {
  const { error } = await dst.storage.createBucket(bucket.name, { public: bucket.public });
  if (error && !/already exists/i.test(error.message)) throw error;
}

async function* walk(bucket, prefix = "") {
  let offset = 0;
  const limit = 100;
  for (;;) {
    const { data, error } = await src.storage.from(bucket).list(prefix, { limit, offset });
    if (error) throw error;
    if (!data?.length) return;
    for (const entry of data) {
      const path = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) {
        yield* walk(bucket, path); // pasta
      } else {
        yield path;
      }
    }
    if (data.length < limit) return;
    offset += limit;
  }
}

for (const bucket of BUCKETS) {
  console.log(`\n=== Bucket ${bucket.name} ===`);
  await ensureBucket(bucket);

  let ok = 0;
  let fail = 0;
  for await (const path of walk(bucket.name)) {
    try {
      const { data: file, error: dlErr } = await src.storage.from(bucket.name).download(path);
      if (dlErr) throw dlErr;
      const buffer = Buffer.from(await file.arrayBuffer());
      const { error: upErr } = await dst.storage
        .from(bucket.name)
        .upload(path, buffer, { upsert: true, contentType: file.type || "application/octet-stream" });
      if (upErr) throw upErr;
      ok += 1;
      if (ok % 25 === 0) console.log(`  ${ok} arquivos copiados...`);
    } catch (err) {
      fail += 1;
      console.error(`  FALHA em ${path}: ${err.message}`);
    }
  }
  console.log(`Bucket ${bucket.name}: ${ok} copiados, ${fail} falhas.`);
}

console.log("\nCópia de arquivos finalizada.");
