#!/usr/bin/env bash
# SINCRONIZAÇÃO INCREMENTAL FINAL — NÃO RODAR ANTES DA JANELA DE VIRADA.
#
# Cobre 4 frentes, nesta ordem:
#   1) DADOS      — upsert por id de tudo criado/alterado na ORIGEM após o corte (com paginação real)
#   2) EXCLUSÕES  — relatório de ids presentes no DESTINO e ausentes na ORIGEM (aplicação opcional e gated)
#   3) STORAGE    — cópia incremental de arquivos novos/alterados (lost-items, task-attachments)
#   4) AUTH       — criação dos usuários novos da origem preservando UUID/e-mail/metadata
#
# NÃO altera a origem. NÃO ativa cron. NÃO troca variáveis da aplicação.
#
# Uso (janela de virada):
#   CONFIRMO_SINCRONIZACAO=SIM bash migracao/08-sincronizacao-final.sh
# Para também aplicar as exclusões detectadas (depois de revisar o relatório):
#   CONFIRMO_SINCRONIZACAO=SIM APLICAR_EXCLUSOES=SIM bash migracao/08-sincronizacao-final.sh
#
# Variáveis necessárias:
#   SRC_URL, SRC_SERVICE_KEY   (backend atual)
#   DST_URL, DST_SERVICE_KEY   (destino)
#   CORTE                      (default abaixo — instante da clonagem inicial)
set -euo pipefail

[ "${CONFIRMO_SINCRONIZACAO:-}" = "SIM" ] || {
  echo "Bloqueado: rode com CONFIRMO_SINCRONIZACAO=SIM apenas na janela de virada."; exit 1; }

: "${SRC_URL:?}"; : "${SRC_SERVICE_KEY:?}"; : "${DST_URL:?}"; : "${DST_SERVICE_KEY:?}"
CORTE="${CORTE:-2026-08-25T16:45:00Z}"
APLICAR_EXCLUSOES="${APLICAR_EXCLUSOES:-NAO}"

mkdir -p migracao/relatorios

python3 - "$SRC_URL" "$SRC_SERVICE_KEY" "$DST_URL" "$DST_SERVICE_KEY" "$CORTE" "$APLICAR_EXCLUSOES" <<'PY'
import csv, json, sys, time, urllib.error, urllib.parse, urllib.request
from datetime import datetime, timezone

SRC, SKEY, DST, DKEY, CORTE, APLICAR = sys.argv[1:7]
APLICAR = (APLICAR == "SIM")
STAMP = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

# ---------------------------------------------------------------- tabelas
# Todas as 58 tabelas do schema public, em ordem de dependência (pais antes de filhos).
TABLES = [
 "profiles","user_roles","role_permissions","app_settings","activity_logs",
 "rooms","reservation_rooms","room_combinations","classroom_call_rooms","classroom_call_room_issues",
 "classroom_calls","classroom_call_responses","external_users","reservations","reservation_logs",
 "reservation_reschedulings","equipment","equipment_loans","equipment_reservations",
 "external_equipment_requests","inventory_movements","lockers","locker_loans","locker_exchanges",
 "lost_items","lost_items_archive","material_requests","tasks","task_team_members","task_comments",
 "task_history","checklist_questions","room_checklists","checklist_answers","shift_handovers",
 "shift_handover_tasks","shift_handover_incidents","semester_competencies","semester_checklists",
 "semester_checklist_items","semester_furniture_details","semester_projectors","semester_item_options",
 "semester_labels","uber_requests","ps_campuses","ps_campus_floors","ps_roles","ps_collaborators",
 "ps_events","ps_event_collaborators","ps_candidates","ps_evaluations","ps_general_evaluations",
 "ps_self_evaluations","ps_evaluation_retifications","ps_fiscal_bank_config","ps_fiscal_bank_applications",
]
# Ordem inversa para exclusões (filhos antes de pais).
DELETE_ORDER = list(reversed(TABLES))

# Tabelas propositalmente FORA da sincronização (nenhuma do schema public):
#   auth.*, storage.*, realtime.*, vault.* -> gerenciadas pelo Supabase (auth tratada na etapa 4,
#   storage na etapa 3); cron.job -> ativado manualmente na virada por 05b-ativar-cron-na-virada.sql.
EXCLUIDAS = {
  "auth.*": "gerenciado pelo Supabase; usuários tratados na ETAPA 4 (Auth incremental)",
  "storage.objects": "tratado na ETAPA 3 (Storage incremental)",
  "cron.job": "ativado manualmente na virada (05b-ativar-cron-na-virada.sql)",
}

# Páginas menores em tabelas com colunas grandes (base64/assinaturas).
HEAVY = {"lost_items","lost_items_archive","ps_event_collaborators","semester_labels","task_comments"}
def page_size(t): return 200 if t in HEAVY else 1000
def upsert_chunk(t): return 50 if t in HEAVY else 200

# ---------------------------------------------------------------- http
def req(url, key, method="GET", body=None, extra=None, raw=False, retries=3):
    h = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    h.update(extra or {})
    data = json.dumps(body).encode() if body is not None else None
    last = None
    for attempt in range(retries):
        try:
            r = urllib.request.Request(url, data=data, headers=h, method=method)
            with urllib.request.urlopen(r, timeout=180) as resp:
                payload = resp.read()
                if raw:
                    return payload, dict(resp.headers)
                return (json.loads(payload) if payload else []), dict(resp.headers)
        except urllib.error.HTTPError as e:
            detail = e.read().decode(errors="replace")[:300]
            last = RuntimeError(f"HTTP {e.code} {url.split('?')[0]} :: {detail}")
            if e.code < 500:
                raise last
        except Exception as e:  # rede/timeout
            last = e
        time.sleep(1.5 * (attempt + 1))
    raise last

def fetch_all(base, key, table, select="*", filt="", limit=None):
    """Paginação real por Range — nada é truncado silenciosamente."""
    out, offset, size = [], 0, page_size(table)
    while True:
        url = f"{base}/rest/v1/{table}?select={select}{filt}"
        rows, _ = req(url, key, extra={"Range-Unit": "items",
                                       "Range": f"{offset}-{offset+size-1}"})
        out.extend(rows)
        if len(rows) < size:
            return out
        offset += size
        if limit and len(out) >= limit:
            return out

def count_rows(base, key, table):
    _, headers = req(f"{base}/rest/v1/{table}?select=id&limit=1", key, raw=True,
                     extra={"Prefer": "count=exact", "Range-Unit": "items", "Range": "0-0"})
    cr = headers.get("content-range") or headers.get("Content-Range") or "0-0/0"
    v = cr.split("/")[-1]
    return None if v == "*" else int(v)

log = []
def say(msg):
    print(msg, flush=True)
    log.append(msg)

say(f"# Sincronização incremental final — {STAMP}")
say(f"Corte: {CORTE} | aplicar exclusões: {'SIM' if APLICAR else 'NÃO (somente relatório)'}")

# ================================================================ ETAPA 1 — DADOS
say("\n=== ETAPA 1 — DADOS (upsert por id, paginado) ===")
total_upsert = 0
erros = []
for t in TABLES:
    try:
        filt = f"&or=(created_at.gte.{CORTE},updated_at.gte.{CORTE})"
        try:
            rows = fetch_all(SRC, SKEY, t, filt=filt)
        except Exception:
            # tabela sem created_at/updated_at: copia tudo por upsert (idempotente)
            rows = fetch_all(SRC, SKEY, t)
    except Exception as e:
        say(f"  {t}: ERRO leitura — {e}"); erros.append(t); continue
    if not rows:
        say(f"  {t}: 0"); continue
    step = upsert_chunk(t)
    try:
        for i in range(0, len(rows), step):
            req(f"{DST}/rest/v1/{t}", DKEY, "POST", rows[i:i+step],
                {"Prefer": "resolution=merge-duplicates,return=minimal"})
    except Exception as e:
        say(f"  {t}: ERRO escrita — {e}"); erros.append(t); continue
    total_upsert += len(rows)
    say(f"  {t}: {len(rows)} sincronizados")
say(f"TOTAL upsert: {total_upsert}")

# ================================================================ ETAPA 2 — EXCLUSÕES
say("\n=== ETAPA 2 — EXCLUSÕES (relatório primeiro, nunca cego) ===")
rel_path = f"migracao/relatorios/exclusoes-{STAMP}.csv"
candidatos = {}
inseguros = 0
for t in TABLES:
    try:
        src_ids = {r["id"] for r in fetch_all(SRC, SKEY, t, select="id")}
        dst_rows = fetch_all(DST, DKEY, t, select="id")
    except Exception as e:
        say(f"  {t}: ERRO comparação — {e}"); erros.append(t); continue
    faltando = [r["id"] for r in dst_rows if r["id"] not in src_ids]
    if faltando:
        candidatos[t] = faltando
    say(f"  {t}: origem={len(src_ids)} destino={len(dst_rows)} ausentes_na_origem={len(faltando)}")

with open(rel_path, "w", newline="") as f:
    w = csv.writer(f)
    w.writerow(["tabela", "id", "situacao"])
    for t, ids in candidatos.items():
        for i in ids:
            w.writerow([t, i, "presente_no_destino_ausente_na_origem"])
say(f"Relatório de divergências: {rel_path} "
    f"({sum(len(v) for v in candidatos.values())} registros em {len(candidatos)} tabelas)")

if not candidatos:
    say("Nenhuma exclusão a aplicar.")
elif not APLICAR:
    say("Exclusões NÃO aplicadas (rode novamente com APLICAR_EXCLUSOES=SIM após revisar o CSV).")
elif erros:
    say("Exclusões BLOQUEADAS: houve erro de leitura/escrita nesta execução — "
        "não é seguro afirmar que os ids sumiram da origem.")
else:
    apagados = 0
    for t in DELETE_ORDER:
        ids = candidatos.get(t)
        if not ids:
            continue
        # Reconfirma na ORIGEM, em lotes, antes de apagar (proteção contra leitura parcial).
        confirmados = []
        for i in range(0, len(ids), 100):
            lote = ids[i:i+100]
            lista = ",".join(f'"{x}"' for x in lote)
            ainda, _ = req(f"{SRC}/rest/v1/{t}?select=id&id=in.({lista})", SKEY)
            presentes = {r["id"] for r in ainda}
            confirmados += [x for x in lote if x not in presentes]
        for i in range(0, len(confirmados), 100):
            lista = ",".join(f'"{x}"' for x in confirmados[i:i+100])
            req(f"{DST}/rest/v1/{t}?id=in.({lista})", DKEY, "DELETE",
                extra={"Prefer": "return=minimal"})
        apagados += len(confirmados)
        say(f"  {t}: {len(confirmados)} excluídos no destino")
    say(f"TOTAL excluído: {apagados}")

# ================================================================ ETAPA 3 — STORAGE
say("\n=== ETAPA 3 — STORAGE incremental ===")
BUCKETS = ["lost-items", "task-attachments"]

def list_bucket(base, key, bucket, prefix=""):
    """Lista recursiva de objetos com metadados (name, updated_at, size)."""
    itens, offset = [], 0
    while True:
        body = {"prefix": prefix, "limit": 100, "offset": offset,
                "sortBy": {"column": "name", "order": "asc"}}
        data, _ = req(f"{base}/storage/v1/object/list/{bucket}", key, "POST", body)
        if not data:
            break
        for e in data:
            path = f"{prefix}/{e['name']}" if prefix else e["name"]
            if e.get("id") is None:
                itens += list_bucket(base, key, bucket, path)
            else:
                itens.append({"path": path,
                              "updated_at": e.get("updated_at") or e.get("created_at") or "",
                              "size": (e.get("metadata") or {}).get("size")})
        if len(data) < 100:
            break
        offset += 100
    return itens

def download(base, key, bucket, path):
    payload, headers = req(f"{base}/storage/v1/object/{bucket}/{urllib.parse.quote(path)}",
                           key, raw=True)
    return payload, headers.get("content-type", "application/octet-stream")

storage_resumo = []
for b in BUCKETS:
    try:
        src_files = list_bucket(SRC, SKEY, b)
        dst_files = {f["path"]: f for f in list_bucket(DST, DKEY, b)}
    except Exception as e:
        say(f"  {b}: ERRO listagem — {e}"); erros.append(f"storage:{b}"); continue
    antes = len(dst_files)
    pend = []
    for f in src_files:
        d = dst_files.get(f["path"])
        if d is None:
            pend.append(f)
        elif f["updated_at"] and d["updated_at"] and f["updated_at"] > d["updated_at"]:
            pend.append(f)
        elif f.get("size") is not None and d.get("size") is not None and f["size"] != d["size"]:
            pend.append(f)
    ok = fail = 0
    for f in pend:
        try:
            blob, ctype = download(SRC, SKEY, b, f["path"])
            url = f"{DST}/storage/v1/object/{b}/{urllib.parse.quote(f['path'])}"
            r = urllib.request.Request(url, data=blob, method="POST", headers={
                "apikey": DKEY, "Authorization": f"Bearer {DKEY}",
                "Content-Type": ctype, "x-upsert": "true"})
            with urllib.request.urlopen(r, timeout=180):
                ok += 1
        except Exception as e:
            fail += 1
            say(f"    FALHA {b}/{f['path']}: {e}")
    depois = antes + ok if ok else antes
    try:
        depois = len(list_bucket(DST, DKEY, b))
    except Exception:
        pass
    say(f"  {b}: origem={len(src_files)} destino_antes={antes} pendentes={len(pend)} "
        f"copiados={ok} falhas={fail} destino_depois={depois}")
    storage_resumo.append((b, len(src_files), antes, depois, fail))
    if fail:
        erros.append(f"storage:{b}")

# ================================================================ ETAPA 4 — AUTH
say("\n=== ETAPA 4 — AUTH incremental ===")
def list_users(base, key):
    users, page = [], 1
    while True:
        data, _ = req(f"{base}/auth/v1/admin/users?page={page}&per_page=200", key)
        batch = data.get("users", data) if isinstance(data, dict) else data
        if not batch:
            break
        users += batch
        if len(batch) < 200:
            break
        page += 1
    return users

try:
    src_users = list_users(SRC, SKEY)
    dst_users = {u["id"] for u in list_users(DST, DKEY)}
    novos = [u for u in src_users if u["id"] not in dst_users]
    say(f"  origem={len(src_users)} destino={len(dst_users)} novos={len(novos)}")
    criados = falhas = 0
    for u in novos:
        payload = {
            "id": u["id"],
            "email": u.get("email"),
            "phone": u.get("phone") or None,
            "email_confirm": bool(u.get("email_confirmed_at")),
            "user_metadata": u.get("user_metadata") or {},
            "app_metadata": {k: v for k, v in (u.get("app_metadata") or {}).items()
                             if k not in ("provider", "providers")},
        }
        payload = {k: v for k, v in payload.items() if v not in (None, "")
                   or k in ("email_confirm", "user_metadata", "app_metadata")}
        try:
            req(f"{DST}/auth/v1/admin/users", DKEY, "POST", payload)
            criados += 1
        except Exception as e:
            falhas += 1
            say(f"    FALHA usuário {u.get('email')}: {e}")
    say(f"  usuários criados={criados} falhas={falhas} "
        f"(senhas/sessões não são migráveis — usar recuperação de senha)")
    if falhas:
        erros.append("auth")
    # profiles/user_roles já vieram por UUID na ETAPA 1; reforça o vínculo dos novos usuários.
    if criados:
        for t in ("profiles", "user_roles"):
            ids = {u["id"] for u in novos}
            rows = [r for r in fetch_all(SRC, SKEY, t)
                    if r.get("user_id") in ids or r.get("id") in ids]
            if rows:
                req(f"{DST}/rest/v1/{t}", DKEY, "POST", rows,
                    {"Prefer": "resolution=merge-duplicates,return=minimal"})
                say(f"  {t}: {len(rows)} vínculos reenviados para os novos UUIDs")
except Exception as e:
    say(f"  ERRO Auth: {e}")
    erros.append("auth")

# ================================================================ RESUMO
say("\n=== RESUMO ===")
say(f"Tabelas sincronizadas: {len(TABLES)} (todas as 58 do schema public)")
for k, v in EXCLUIDAS.items():
    say(f"Fora da sincronização — {k}: {v}")
say(f"Erros: {sorted(set(erros)) if erros else 'nenhum'}")
say("Próximo passo: bash migracao/09-validacao-pos-sincronizacao.sh")

with open(f"migracao/relatorios/sincronizacao-{STAMP}.md", "w") as f:
    f.write("\n".join(log) + "\n")

sys.exit(1 if erros else 0)
PY

echo "Sincronização incremental concluída. Rode: bash migracao/09-validacao-pos-sincronizacao.sh"
