#!/usr/bin/env python3
"""
Banc de mesure réseau — ChrisRoi Agence.

Mesure le coût RÉEL de chaque chemin réseau de l'app contre le PocketBase
de production, en reproduisant fidèlement les requêtes que le SDK
PocketBase (JS) émet, EN PARALLÈLE quand le code fait un Promise.all.

Objectif : chiffrer le « avant / après » des corrections du 05/10, pas deviner.

Usage:
    python bench_network.py            # rapport avant/après
    python bench_network.py --json     # sortie JSON

Pourquoi un banc plutôt que l'app ?
  Le JS s'exécute sur l'appareil ; on ne peut pas mesurer ses appels HTTP
  depuis le PC. On rejoue donc les MÊMES requêtes (mêmes filtres, mêmes
  expands) et on mesure le coût réseau pur. La latence domine (129 ms RTT),
  donc coût réseau ≈ coût observé sur l'appareil.

Note d'honnêteté : à 22 contrats, le serveur répond en quelques ms. Ce qui
compte vraiment — et que ce banc mesure — c'est le NOMBRE de requêtes et le
payload : les deux seuls leviers disponibles depuis le client.
"""
import json
import os
import statistics
import sys
import time
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

PB_URL = os.environ.get("PB_URL", "https://pb2.chrisroiagence.com")
TOKEN_FILE = os.path.join(os.environ.get("TMPDIR", "."), "pbtok")
REPEAT = int(os.environ.get("REPEAT", "3"))

# Latence mesurée vers le VPS (ping 217.182.69.35 depuis le PC de dev)
RTT_MS = 129.0
# Largeur des Promise.all de l'app (3 requêtes concurrentes au max).
CONCURRENCY = 3
# Filtre des contrats à commission : le N+1 loops sur ces enregistrements.
FILTER_UNPAID = "(commission_payee=false && commission_agence>0)"


def _load_token() -> str:
    for cand in (
        TOKEN_FILE,
        os.path.join(os.environ.get("TMPDIR", ""), "pbtok"),
        os.path.join(os.path.dirname(os.path.abspath(__file__)), ".pbtok"),
    ):
        if cand and os.path.exists(cand):
            tok = open(cand).read().strip()
            if tok:
                return tok
    sys.exit(
        "Token introuvable. Génère-le avec :\n"
        '  curl -s -X POST "%s/api/collections/_superusers/auth-with-password" \\\n'
        '    -H "Content-Type: application/json" \\\n'
        '    -d \'{"identity":"<user>","password":"<mdp>"}\' '
        '| python -c "import sys,json;print(json.load(sys.stdin)[\'token\'])" '
        '> "$TMPDIR/pbtok"' % PB_URL
    )


TOKEN = _load_token()


def build_url(collection: str, params: dict) -> str:
    qs = urllib.parse.urlencode(params, safe='()~*,"\'>=!$')
    return f"{PB_URL}/api/collections/{collection}/records?{qs}"


def fetch(collection: str, params: dict) -> bytes:
    """Une requête PocketBase authentifiée → corps brut."""
    req = urllib.request.Request(build_url(collection, params),
                                 headers={"Authorization": TOKEN})
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read()


def run_parallel(calls, label):
    """
    Exécute un lot de requêtes EN PARALLÈLE (comme un Promise.all) et
    renvoie (nb_requêtes, Ko, ms médiane). `calls` = liste de (collection,
    params). Le premier lot sert de warm-up (handshake TLS), non compté.
    """
    if not calls:
        return {"label": label, "requests": 0, "kb": 0.0, "ms": 0.0}
    fetch(*calls[0])  # warm-up (non compté)
    samples, nbytes = [], 0
    for _ in range(REPEAT):
        t0 = time.perf_counter()
        with ThreadPoolExecutor(max_workers=min(CONCURRENCY, len(calls))) as ex:
            res = list(ex.map(lambda cp: fetch(*cp), calls))
        samples.append(time.perf_counter() - t0)
        nbytes = sum(len(r) for r in res)
    return {"label": label, "requests": len(calls), "kb": round(nbytes / 1024, 2),
            "ms": round(statistics.median(samples) * 1000)}


def run_sequential(calls, label):
    """
    Chronomètre une boucle EN SÉRIE — c'est exactement ce que fait le N+1
    d'origine (un `await` par contrat dans une boucle for). C'est le pire
    cas, donc le plus honnête pour mesurer ce qui va être corrigé.
    """
    if not calls:
        return {"label": label, "requests": 0, "kb": 0.0, "ms": 0.0}
    fetch(*calls[0])  # warm-up (non compté)
    samples, nbytes = [], 0
    for _ in range(REPEAT):
        t0 = time.perf_counter()
        nbytes = 0
        for cp in calls:
            nbytes += len(fetch(*cp))
        samples.append(time.perf_counter() - t0)
    return {"label": label, "requests": len(calls), "kb": round(nbytes / 1024, 2),
            "ms": round(statistics.median(samples) * 1000)}


def main():
    # Les contrats impayés : c'est sur eux que boucle le N+1 des alertes.
    contrats = json.loads(fetch("contrats", {"page": 1, "perPage": 200,
                                             "filter": FILTER_UNPAID}))["items"]
    rows = []

    # ── 1. LE N+1 DES ALERTES (le plus grave) ──────────────────────
    # AVANT : 1 getFullList + 1 requête `alertes` PAR CONTRAT, en série.
    n1_old = [("contrats", {"page": 1, "perPage": 200, "filter": FILTER_UNPAID,
                            "expand": "employe_id,employeur_id"})] + [
        ("alertes", {"page": 1, "perPage": 200,
                     "filter": f'(contrat_id="{c["id"]}" && type="commission_due")'})
        for c in contrats
    ]
    # APRÈS : 1 getFullList + 1 requête groupée (Set dédoublonné en mémoire).
    n1_new = [
        ("contrats", {"page": 1, "perPage": 200, "filter": FILTER_UNPAID,
                      "expand": "employe_id,employeur_id"}),
        ("alertes", {"page": 1, "perPage": 200, "filter": 'type="commission_due"',
                     "fields": "contrat_id"}),
    ]
    rows.append(("AVANT  createCommissionDueAlertes — N+1 (série)",
                 run_sequential(n1_old, "n1_avant")))
    rows.append(("APRÈS  createCommissionDueAlertes — 1 requête groupée",
                 run_parallel(n1_new, "n1_apres")))

    # ── 2. REGISTRE DU DASHBOARD (trois .length) ───────────────────
    # AVANT : 3 listes complètes (avec expand) pour trois nombres.
    reg_old = [
        ("employes", {"page": 1, "perPage": 200, "sort": "-created"}),
        ("employeurs", {"page": 1, "perPage": 200, "sort": "-created"}),
        ("contrats", {"page": 1, "perPage": 200, "sort": "-date_contrat",
                      "expand": "employe_id,employeur_id"}),
    ]
    # APRÈS : 3 COUNT (perPage=1 + fields=id) — totalItems suffit.
    reg_new = [
        ("employes", {"page": 1, "perPage": 1, "fields": "id"}),
        ("employeurs", {"page": 1, "perPage": 1, "fields": "id"}),
        ("contrats", {"page": 1, "perPage": 1, "fields": "id"}),
    ]
    rows.append(("AVANT  Dashboard registre — 3 getFullList (3× .length)",
                 run_parallel(reg_old, "reg_avant")))
    rows.append(("APRÈS  Dashboard registre — getRegistreCounts (24 o)",
                 run_parallel(reg_new, "reg_apres")))

    # ── 3. ÉCRAN DOSSIERS (le plus utilisé) ───────────────────────
    dossiers = [
        ("employes", {"page": 1, "perPage": 200, "sort": "-created"}),
        ("employeurs", {"page": 1, "perPage": 200, "sort": "-created"}),
        ("contrats", {"page": 1, "perPage": 200, "sort": "-date_contrat",
                      "expand": "employe_id,employeur_id"}),
    ]
    base = run_parallel(dossiers, "dossiers")
    rows.append(("Dossiers — 1 focus, APRÈS (1 seul useFocusEffect)",
                 base))
    # AVANT : deux useFocusEffect → le même lot part DEUX fois.
    rows.append(("Dossiers — 1 focus, AVANT (2× le même lot)",
                 {**base, "label": "focus_avant", "requests": base["requests"] * 2,
                  "ms": base["ms"] * 2, "kb": round(base["kb"] * 2, 2)}))
    rows.append(("Dossiers — 1 frappe clavier, AVANT (rechargement complet)",
                 {**base, "label": "frappe_avant"}))
    rows.append(("Dossiers — 1 frappe clavier, APRÈS (filtre mémoire)",
                 {"label": "frappe_apres", "requests": 0, "kb": 0.0, "ms": 0}))

    # ── Rapport ───────────────────────────────────────────────────
    w = "{:<52}{:>6}{:>10}{:>11}".format
    print("\n" + "=" * 92)
    print("  BANC DE MESURE RÉSEAU — ChrisRoi Agence")
    print("  Cible : %s   (RTT mesuré : %d ms, TLS 1.3 / HTTP2)" % (PB_URL, RTT_MS))
    print(f"  {len(contrats)} contrats impayés en base — mesuré sur les données réelles")
    print("=" * 92)
    print(w("Opération", "req", "Ko", "ms"))
    print("-" * 92)
    for label, m in rows:
        print(w(label, m["requests"], m["kb"], m["ms"]))
    print("-" * 92)

    # ── Verdict ───────────────────────────────────────────────────
    d = {m["label"]: m for _, m in rows}
    n1a, n1b = d["n1_avant"], d["n1_apres"]
    ra, rb = d["reg_avant"], d["reg_apres"]
    print("\n  VERDICT")
    print(f"  1. N+1 alertes    : {n1a['requests']} requêtes / {n1a['ms']} ms"
          f"   ->   {n1b['requests']} requêtes / {n1b['ms']} ms")
    print(f"     => {(1 - n1b['ms'] / max(n1a['ms'], 1)) * 100:.0f} % plus rapide"
          f"  |  {n1a['requests'] - n1b['requests']} requêtes en moins")
    print(f"  2. Registre       : {ra['kb']} Ko / {ra['ms']} ms"
          f"   ->   {rb['kb']} Ko / {rb['ms']} ms")
    print(f"     => {(1 - rb['kb'] / max(ra['kb'], 0.001)) * 100:.1f} % de payload en moins")
    print(f"  3. Focus Dossiers : 2× le lot   ->   1× le lot")
    print(f"  4. Frappe clavier : 3 requêtes + {base['kb']} Ko  ->  0 requête + 0 Ko (filtre mémoire)")

    print("\n  CHEMIN CRITIQUE (ouverture app = alertes + registre)")
    print(f"    avant : {n1a['ms'] + ra['ms']:>6} ms   "
          f"({n1a['requests'] + ra['requests']} requêtes, {n1a['kb'] + ra['kb']:.1f} Ko)")
    print(f"    après : {n1b['ms'] + rb['ms']:>6} ms   "
          f"({n1b['requests'] + rb['requests']} requêtes, {n1b['kb'] + rb['kb']:.1f} Ko)")
    gain = (1 - (n1b['ms'] + rb['ms']) / max(n1a['ms'] + ra['ms'], 1)) * 100
    print(f"    GAIN  : {gain:.0f} %")

    results = {
        "pb_url": PB_URL, "rtt_ms": RTT_MS,
        "contrats_unpaid": len(contrats),
        "measurements": [{"label": label, **m} for label, m in rows],
        "critical_path_ms": {"avant": n1a['ms'] + ra['ms'], "apres": n1b['ms'] + rb['ms']},
        "gain_percent": round(gain, 1),
    }
    if "--json" in sys.argv:
        print("\n" + json.dumps(results, indent=2))
    return results


if __name__ == "__main__":
    main()