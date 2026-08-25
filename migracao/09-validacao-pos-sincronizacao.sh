#!/usr/bin/env bash
# VALIDAÇÃO PÓS-SINCRONIZAÇÃO — somente leitura, não altera nada.
#
# Compara ORIGEM x DESTINO em 7 dimensões:
#   1) contagem por tabela
#   2) IDs ausentes (nos dois sentidos)
#   3) registros divergentes (updated_at/created_at diferentes)
#   4) usuários Auth
#   5) arquivos Storage (lost-items, task-attachments)
#   6) foreign keys órfãs no destino
#   7) dados criados/alterados após o corte
#
#   SRC_URL, SRC_SERVICE_KEY, DST_URL, DST_SERVICE_KEY [, CORTE]
set -euo pipefail
: "${SRC_URL:?}"; : "${SRC_SERVICE_KEY:?}"; : "${DST_URL:?}"; : "${DST_SERVICE_KEY:?}"
CORTE="${CORTE:-2026-08-25T16:45:00Z}"

mkdir -p migracao/relatorios

python3 - "$SRC_URL" "$SRC_SERVICE_KEY" "$DST_URL" "$DST_SERVICE_KEY" "$CORTE" <<'PY'
import json, pathlib, re, sys, time, urllib.error, urllib.parse, urllib.request
from datetime import datetime, timezone

SRC, SKEY, DST, DKEY, CORTE = sys.argv[1:6]
STAMP = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")

sync = pathlib.Path(__file__).with_name("08-sincronizacao-final.sh").read_text() \
    if False else pathlib.Path("migracao/08-sincronizacao-final.sh").read_text()
TABLES = re.findall(r'"([a-z_]+)"', sync.split("TABLES = [")[1].split("]")[0])

HEAVY = {"lost_items","lost_items_archive","ps_event_collaborators","semester_labels","task_comments"}
def page_size(t): return 200 if t in HEAVY else 1000

def req(url, key, method="GET", body=None, extra=None, raw=False, retries=3):
    h = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json"}
    h.update(extra or {})
    data = json.dumps(body).encode() if body is not None else None
    last = None
    for a in range(retries):
        try:
            r = urllib.request.Request(url, data=data, headers=h, method=method)
            with urllib.request.urlopen(r, timeout=180) as resp:
                p = resp.read()
                return ((p if raw else (json.loads(p) if p else [])), dict(resp.headers))
        except urllib.error.HTTPError as e:
            last = RuntimeError(f"HTTP {e.code}: {e.read().decode(errors='replace')[:200]}")
            if e.code < 500: raise last
        except Exception as e:
            last = e
        time.sleep(1.5 * (a + 1))
    raise last

def count(base, key, t):
    _, h = req(f"{base}/rest/v1/{t}?select=id&limit=1", key, raw=True,
               extra={"Prefer": "count=exact", "Range-Unit": "items", "Range": "0-0"})
    cr = h.get("content-range") or h.get("Content-Range") or "0-0/0"
    return int(cr.split("/")[-1])

def fetch_all(base, key, t, select="*", filt=""):
    out, off, size = [], 0, page_size(t)
    while True:
        rows, _ = req(f"{base}/rest/v1/{t}?select={select}{filt}", key,
                      extra={"Range-Unit": "items", "Range": f"{off}-{off+size-1}"})
        out += rows
        if len(rows) < size: return out
        off += size

log = []
def say(m):
    print(m, flush=True); log.append(m)

problemas = 0
say(f"# Validação pós-sincronização — {STAMP}\nCorte: {CORTE}")

# ---------------------------------------------------------- 1/2/3 tabelas
say("\n=== 1-3) Contagens, IDs ausentes e registros divergentes ===")
ts = td = 0
for t in TABLES:
    try:
        a, b = count(SRC, SKEY, t), count(DST, DKEY, t)
    except Exception as e:
        say(f"ERRO {t}: {e}"); problemas += 1; continue
    ts += a; td += b
    try:
        cols = "id,updated_at" 
        try:
            src_rows = {r["id"]: r.get("updated_at") for r in fetch_all(SRC, SKEY, t, cols)}
            dst_rows = {r["id"]: r.get("updated_at") for r in fetch_all(DST, DKEY, t, cols)}
        except Exception:
            src_rows = {r["id"]: None for r in fetch_all(SRC, SKEY, t, "id")}
            dst_rows = {r["id"]: None for r in fetch_all(DST, DKEY, t, "id")}
    except Exception as e:
        say(f"ERRO {t} (ids): {e}"); problemas += 1; continue
    faltam_dst = [i for i in src_rows if i not in dst_rows]
    sobram_dst = [i for i in dst_rows if i not in src_rows]
    diverg = [i for i in src_rows if i in dst_rows and src_rows[i] != dst_rows[i]]
    ok = (a == b and not faltam_dst and not sobram_dst and not diverg)
    if not ok: problemas += 1
    say(f"{'OK ' if ok else 'DIF'} {t}: origem={a} destino={b} "
        f"faltando_no_destino={len(faltam_dst)} sobrando_no_destino={len(sobram_dst)} "
        f"divergentes={len(diverg)}")
    for i in (faltam_dst[:5] + sobram_dst[:5] + diverg[:5]):
        say(f"      id={i}")
say(f"TOTAL linhas: origem={ts} destino={td}")

# ---------------------------------------------------------- 4 auth
say("\n=== 4) Usuários Auth ===")
def users(base, key):
    out, page = [], 1
    while True:
        d, _ = req(f"{base}/auth/v1/admin/users?page={page}&per_page=200", key)
        batch = d.get("users", d) if isinstance(d, dict) else d
        if not batch: break
        out += batch
        if len(batch) < 200: break
        page += 1
    return out
try:
    su = {u["id"]: (u.get("email") or "").lower() for u in users(SRC, SKEY)}
    du = {u["id"]: (u.get("email") or "").lower() for u in users(DST, DKEY)}
    falta = [i for i in su if i not in du]
    email_dif = [i for i in su if i in du and su[i] != du[i]]
    say(f"{'OK ' if not falta and not email_dif else 'DIF'} origem={len(su)} destino={len(du)} "
        f"faltando={len(falta)} email_divergente={len(email_dif)}")
    for i in falta[:10]: say(f"      faltando uuid={i} email={su[i]}")
    if falta or email_dif: problemas += 1
except Exception as e:
    say(f"ERRO Auth: {e}"); problemas += 1

# ---------------------------------------------------------- 5 storage
say("\n=== 5) Arquivos Storage ===")
def listb(base, key, bucket, prefix=""):
    itens, off = [], 0
    while True:
        d, _ = req(f"{base}/storage/v1/object/list/{bucket}", key, "POST",
                   {"prefix": prefix, "limit": 100, "offset": off,
                    "sortBy": {"column": "name", "order": "asc"}})
        if not d: break
        for e in d:
            p = f"{prefix}/{e['name']}" if prefix else e["name"]
            if e.get("id") is None: itens += listb(base, key, bucket, p)
            else: itens.append((p, (e.get("metadata") or {}).get("size")))
        if len(d) < 100: break
        off += 100
    return itens
for b in ("lost-items", "task-attachments"):
    try:
        s = dict(listb(SRC, SKEY, b)); d = dict(listb(DST, DKEY, b))
        falta = [p for p in s if p not in d]
        tam = [p for p in s if p in d and s[p] is not None and d[p] is not None and s[p] != d[p]]
        ok = not falta and not tam
        if not ok: problemas += 1
        say(f"{'OK ' if ok else 'DIF'} {b}: origem={len(s)} destino={len(d)} "
            f"faltando={len(falta)} tamanho_divergente={len(tam)}")
        for p in falta[:10]: say(f"      faltando {p}")
    except Exception as e:
        say(f"ERRO storage {b}: {e}"); problemas += 1

# ---------------------------------------------------------- 6 FKs órfãs
say("\n=== 6) Foreign keys órfãs no destino ===")
FKS = [
  ("user_roles","user_id","__auth_users","id"),
  ("profiles","user_id","__auth_users","id"),
  ("task_team_members","task_id","tasks","id"),
  ("task_comments","task_id","tasks","id"),
  ("task_history","task_id","tasks","id"),
  ("checklist_answers","checklist_id","room_checklists","id"),
  ("checklist_answers","question_id","checklist_questions","id"),
  ("shift_handover_tasks","handover_id","shift_handovers","id"),
  ("shift_handover_incidents","handover_id","shift_handovers","id"),
  ("reservations","room_id","reservation_rooms","id"),
  ("reservation_logs","reservation_id","reservations","id"),
  ("reservation_reschedulings","reservation_id","reservations","id"),
  ("room_combinations","parent_room_id","reservation_rooms","id"),
  ("room_combinations","linked_room_id","reservation_rooms","id"),
  ("equipment_loans","equipment_id","equipment","id"),
  ("equipment_reservations","equipment_id","equipment","id"),
  ("inventory_movements","equipment_id","equipment","id"),
  ("locker_loans","locker_id","lockers","id"),
  ("classroom_call_room_issues","room_id","classroom_call_rooms","id"),
  ("semester_checklist_items","checklist_id","semester_checklists","id"),
  ("semester_furniture_details","checklist_id","semester_checklists","id"),
  ("semester_projectors","checklist_id","semester_checklists","id"),
  ("ps_event_collaborators","event_id","ps_events","id"),
  ("ps_event_collaborators","collaborator_id","ps_collaborators","id"),
  ("ps_evaluations","event_id","ps_events","id"),
  ("ps_general_evaluations","event_id","ps_events","id"),
  ("ps_self_evaluations","event_id","ps_events","id"),
  ("ps_candidates","event_id","ps_events","id"),
  ("ps_campus_floors","campus_id","ps_campuses","id"),
]
try:
    auth_ids = {u["id"] for u in users(DST, DKEY)}
except Exception:
    auth_ids = None
cache = {}
def ids_of(t):
    if t not in cache:
        cache[t] = {r["id"] for r in fetch_all(DST, DKEY, t, "id")}
    return cache[t]
for child, col, parent, pcol in FKS:
    try:
        alvo = auth_ids if parent == "__auth_users" else ids_of(parent)
        if alvo is None:
            say(f"--  {child}.{col}: não verificado (Auth indisponível)"); continue
        rows = fetch_all(DST, DKEY, child, f"id,{col}")
        orf = [r["id"] for r in rows if r.get(col) and r[col] not in alvo]
        if orf: problemas += 1
        say(f"{'OK ' if not orf else 'DIF'} {child}.{col} -> "
            f"{'auth.users' if parent=='__auth_users' else parent}: órfãs={len(orf)}")
        for i in orf[:5]: say(f"      id={i}")
    except Exception as e:
        say(f"ERRO FK {child}.{col}: {e}"); problemas += 1

# ---------------------------------------------------------- 7 pós-corte
say(f"\n=== 7) Registros criados/alterados após o corte ({CORTE}) ===")
for t in TABLES:
    filt = f"&or=(created_at.gte.{CORTE},updated_at.gte.{CORTE})"
    try:
        a = len(fetch_all(SRC, SKEY, t, "id", filt))
        b = len(fetch_all(DST, DKEY, t, "id", filt))
    except Exception:
        continue  # tabela sem colunas temporais
    if a or b:
        ok = a == b
        if not ok: problemas += 1
        say(f"{'OK ' if ok else 'DIF'} {t}: origem={a} destino={b}")

say(f"\n=== RESULTADO: {'TUDO CONSISTENTE' if problemas == 0 else f'{problemas} divergências'} ===")
pathlib.Path(f"migracao/relatorios/validacao-{STAMP}.md").write_text("\n".join(log) + "\n")
sys.exit(0 if problemas == 0 else 1)
PY
