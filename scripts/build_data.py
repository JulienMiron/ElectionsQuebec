#!/usr/bin/env python3
"""Construit les JSON du site à partir des deux jeux de données sources.

Sources (voir README) :
  - Atlas of Canadian Elections (Zack Taylor, Western) : résultats par circonscription 1867-2022
  - Données bleues (A. Nicosia, U. Laval) : résultats officiels 2026, circonscriptions 2026
Usage : python3 scripts/build_data.py   (après scripts/fetch_sources.sh)
"""
import json, re, unicodedata
from pathlib import Path
import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
ATLAS = ROOT / "sources/atlas-canada-elections/data"
BLEU = ROOT / "sources/donnees-bleues-elections-qc/data/processed"
OUT = ROOT / "data"
(OUT / "r").mkdir(parents=True, exist_ok=True)

# ---- Familles de partis -> codes d'affichage -------------------------------
MAIN = {  # code: (libellé, famille Atlas)
    "PLQ": "Parti libéral du Québec", "PQ": "Parti québécois", "CAQ": "Coalition avenir Québec",
    "QS": "Québec solidaire", "UN": "Union nationale", "ADQ": "Action démocratique du Québec",
    "PCQ": "Parti conservateur du Québec", "CON": "Parti conservateur (historique)",
}
FAM2CODE = {"Liberal": "PLQ", "Parti québécois": "PQ", "Coalition avenir Québec": "CAQ",
            "Québec solidaire": "QS", "Union nationale": "UN",
            "Action démocratique du Québec": "ADQ", "Conservative": "CON", "Independent": "IND"}
FAM_FR = {"CCF-NDP": "CCF / NPD", "Social Credit": "Crédit social", "Communist": "Communiste",
          "Green": "Verts", "Equality Party": "Parti Égalité", "Independent": "Indépendants"}

def code_of(family, year):
    if family == "Conservative" and year >= 2012:
        return "PCQ"
    return FAM2CODE.get(family, "AUT")

def norm(s):
    s = unicodedata.normalize("NFD", str(s)).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()

# ---- Atlas 1867-2022 ------------------------------------------------------------
els = pd.read_parquet(ATLAS / "elections.parquet").query("prabbr=='QC'").set_index("eyear")
dis = pd.read_parquet(ATLAS / "districts.parquet").query("prabbr=='QC'")
can = pd.read_parquet(ATLAS / "candidates.parquet").query("prabbr=='QC'")
lin = pd.read_parquet(ATLAS / "lineages.parquet").query("prabbr=='QC'").set_index("lineage_id")

can = can.assign(code=[code_of(f, y) for f, y in zip(can.family, can.eyear)])

def ridings_for_year(y):
    d = dis[dis.eyear == y]
    c = can[can.eyear == y]
    out = []
    for _, r in d.iterrows():
        cc = c[(c.pedid == r.pedid) & c.name.notna()].copy()
        cc["v"] = cc.votes_first.fillna(0)
        cc = cc.sort_values(["elected", "v"], ascending=False)
        tot = cc.v.sum()
        winner = cc[cc.elected]
        wcode = winner.code.iloc[0] if len(winner) else None
        acc = bool(r.acclaimed)
        margin = None
        if not acc and tot > 0 and len(cc) > 1:
            margin = round(float((cc.v.iloc[0] - cc.v.iloc[1]) / tot * 100), 1)
        cands = [[row["name"], row.code, row.party_raw if isinstance(row.party_raw, str) else "",
                  int(row.v) if not pd.isna(row.votes_first) else None,
                  round(float(row.v / tot * 100), 1) if tot > 0 and not pd.isna(row.votes_first) else None,
                  int(bool(row.elected))] for _, row in cc.iterrows()]
        item = {"id": r.geo_id, "n": r.pedname_fr, "li": norm(r.pedname_fr),
                "e": None if pd.isna(r.electorate) else int(r.electorate),
                "t": None if pd.isna(r.votes_total) else int(r.votes_total),
                "a": int(acc), "m": margin, "w": wcode, "c": cands}
        if r.quality != "A":
            item["q"] = r.quality
        out.append(item)
    return out

# ---- 2026 : Données bleues ---------------------------------------------------
def build_2026():
    cand = pd.read_csv(BLEU / "results_candidate_2026.csv")
    snap = cand.sort_values("observed_at").snapshot_id.iloc[-1]
    cand = cand[cand.snapshot_id == snap]
    tr = pd.read_csv(BLEU / "turnout.csv")
    tr = tr[(tr.election_id == "qc-prov-2026-10-05-general") & (tr.data_status == "final")]
    tr = tr[tr.snapshot_id == tr.sort_values("observed_at").snapshot_id.iloc[-1]].set_index("district_id")
    code26 = {"PQ": "PQ", "PLQ/QLP": "PLQ", "ÉCF-CAQ": "CAQ", "QS": "QS", "PCOQ": "PCQ", "Ind.": "IND"}
    names = {"PQ": "Parti québécois", "PLQ/QLP": "Parti libéral du Québec", "ÉCF-CAQ": "Coalition avenir Québec",
             "QS": "Québec solidaire", "PCOQ": "Parti conservateur du Québec", "Ind.": "Indépendant"}
    rp = pd.read_csv(BLEU / "results_party_2026.csv")
    pname = rp.drop_duplicates("party_abbreviation").set_index("party_abbreviation").party_name.to_dict()
    ridings = []
    for did, g in cand.groupby("district_id"):
        g = g.sort_values("votes", ascending=False)
        t = tr.loc[did]
        tot = g.votes.sum()
        code = int(t.district_code)
        cands = [[f"{r.first_name} {r.last_name}", code26.get(r.party_abbreviation, "AUT"),
                  pname.get(r.party_abbreviation, r.party_abbreviation), int(r.votes),
                  round(r.votes / tot * 100, 1), int(i == 0)] for i, (_, r) in enumerate(g.iterrows())]
        ridings.append({"id": f"QC_ro2026_{code}", "n": t.district_name, "li": None, "e": int(t.registered),
                        "t": int(tot), "a": 0, "m": round((g.votes.iloc[0] - g.votes.iloc[1]) / tot * 100, 1),
                        "w": cands[0][1], "c": cands})
    meta = {"snapshot": snap, "observed_at": str(cand.observed_at.max())}
    return ridings, meta

# ---- Assemblage -------------------------------------------------------------------
elections, lineages = [], {}
def summarize(y, ro, ridings, extra=None):
    par = {}
    det = {}
    for r in ridings:
        for n, code, praw, v, sh, el in r["c"]:
            p = par.setdefault(code, {"v": 0, "s": 0, "c": 0})
            p["v"] += v or 0; p["c"] += 1; p["s"] += el
            if code == "AUT":
                dd = det.setdefault(praw or "Autres", {"v": 0, "s": 0})
                dd["v"] += v or 0; dd["s"] += el
    valid = sum(p["v"] for p in par.values())
    cont = [r for r in ridings if r["t"] and r["e"]]
    elec = sum(r["e"] for r in ridings if r["e"])
    turn = sum(r["t"] for r in cont) / sum(r["e"] for r in cont) * 100 if cont else None
    # compétitivité : écart entre les deux premiers, circonscriptions disputées seulement
    ms = sorted(r["m"] for r in ridings if r["m"] is not None and not r["a"])
    comp = None
    if ms:
        n = len(ms)
        comp = {"n": n, "lt5": sum(m < 5 for m in ms), "lt15": sum(5 <= m < 15 for m in ms),
                "ge15": sum(m >= 15 for m in ms), "mean": round(sum(ms) / n, 1),
                "med": round(ms[n // 2] if n % 2 else (ms[n // 2 - 1] + ms[n // 2]) / 2, 1)}
    tot_s = sum(p["s"] for p in par.values())
    gal = None
    if valid and tot_s:  # indice de Gallagher (points de %), tous partis; « autres partis » regroupés
        gal = round((0.5 * sum((p["v"] / valid * 100 - p["s"] / tot_s * 100) ** 2 for p in par.values())) ** 0.5, 2)
    e = {"y": y, "ro": ro, "comp": comp, "gal": gal, "seats": sum(p["s"] for p in par.values()), "ridings": len(ridings),
         "electorate": elec, "valid": valid, "turnout": round(turn, 1) if turn else None,
         "acc": sum(r["a"] for r in ridings), "par": par}
    if det:
        e["det"] = dict(sorted(det.items(), key=lambda kv: -kv[1]["v"])[:12])
    if extra: e.update(extra)
    return e

for y in sorted(dis.eyear.unique()):
    rs = ridings_for_year(int(y))
    (OUT / "r" / f"{y}.json").write_text(json.dumps({"y": int(y), "ro": int(els.loc[y].ro_year), "ridings": rs}, ensure_ascii=False, separators=(",", ":")))
    elections.append(summarize(int(y), int(els.loc[y].ro_year), rs))
    for r in rs:
        l = lineages.setdefault(r["li"], {"n": r["n"], "h": []})
        l["n"] = r["n"]
        l["h"].append([int(y), r["w"], r["m"], r["n"], r["id"]])

r26, meta26 = build_2026()
# historique par circonscription : on suit le NOM (les frontières changent d'une carte à l'autre)
new = []
for r in r26:
    r["li"] = norm(r["n"])
    if r["li"] not in lineages:
        new.append(r["n"]); lineages[r["li"]] = {"n": r["n"], "h": []}
    lineages[r["li"]]["n"] = r["n"]
    lineages[r["li"]]["h"].append([2026, r["w"], r["m"], r["n"], r["id"]])
print(f"2026 : {len(r26)} circonscriptions, {len(new)} nouveaux noms : {new}")
(OUT / "r/2026.json").write_text(json.dumps({"y": 2026, "ro": 2026, "ridings": r26}, ensure_ascii=False, separators=(",", ":")))
e26 = summarize(2026, 2026, r26, {"date": "2026-10-05", "provisoire": True, "source_obs": meta26["observed_at"]})
elections.append(e26)
for l in lineages.values():
    l["h"].sort(key=lambda x: x[0])

parties = {  # métadonnées d'affichage (les couleurs sont dans le CSS)
    "PLQ": "Parti libéral du Québec", "PQ": "Parti québécois", "CAQ": "Coalition avenir Québec",
    "QS": "Québec solidaire", "UN": "Union nationale", "ADQ": "Action démocratique du Québec",
    "PCQ": "Parti conservateur du Québec", "CON": "Parti conservateur (historique)",
    "AUT": "Autres partis", "IND": "Indépendants"}
(OUT / "elections.json").write_text(json.dumps({"parties": parties, "elections": elections}, ensure_ascii=False, separators=(",", ":"), default=lambda o: o.item()))
(OUT / "lineages.json").write_text(json.dumps(lineages, ensure_ascii=False, separators=(",", ":")))
print("élections :", len(elections), "lignées :", len(lineages))
