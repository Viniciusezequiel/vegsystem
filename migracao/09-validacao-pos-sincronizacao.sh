#!/usr/bin/env bash
# Compara contagens de ORIGEM x DESTINO após a sincronização incremental final.
# Somente leitura — não altera dados.
#   SRC_URL, SRC_SERVICE_KEY, DST_URL, DST_SERVICE_KEY
set -euo pipefail
: "${SRC_URL:?}"; : "${SRC_SERVICE_KEY:?}"; : "${DST_URL:?}"; : "${DST_SERVICE_KEY:?}"

python3 - "$SRC_URL" "$SRC_SERVICE_KEY" "$DST_URL" "$DST_SERVICE_KEY" <<'PY'
import sys, urllib.request
SRC, SKEY, DST, DKEY = sys.argv[1:5]
TABLES = open(__file__).read() if False else None
import re, pathlib
sync = pathlib.Path(__file__).with_name("08-sincronizacao-final.sh").read_text()
TABLES = re.findall(r'"([a-z_]+)"', sync.split("TABLES = [")[1].split("]")[0])

def count(base, key, t):
    r = urllib.request.Request(f"{base}/rest/v1/{t}?select=id&limit=1",
        headers={"apikey": key, "Authorization": f"Bearer {key}", "Prefer": "count=exact",
                 "Range-Unit": "items", "Range": "0-0"})
    with urllib.request.urlopen(r) as resp:
        return int(resp.headers.get("Content-Range", "0-0/0").split("/")[-1])

diff = 0; ts = td = 0
for t in TABLES:
    try:
        a, b = count(SRC, SKEY, t), count(DST, DKEY, t)
    except Exception as e:
        print(f"{t}: ERRO {e}"); diff += 1; continue
    ts += a; td += b
    flag = "OK " if a == b else "DIF"
    if a != b: diff += 1
    print(f"{flag} {t}: origem={a} destino={b}")
print(f"\nTOTAL origem={ts} destino={td} | tabelas divergentes={diff}")
sys.exit(0 if diff == 0 else 1)
PY
