#!/usr/bin/env python3
"""Profil socioéconomique des circonscriptions (Recensement 2021) et vote 2026 / 2022.

Entrées :
  sources/statistiques-recensement-2021-CEP2026.xls  (Élections Québec; adapté de Statistique Canada, licence ouverte)
  sources/donnees-bleues-elections-qc/.../district_map_changes_spatial.csv  (intersections carte 2017 × carte 2026)
  data/r/2022.json, data/r/2026.json  (résultats, produits par build_data.py)
Sortie : data/demo.json

Le profil existe officiellement pour la carte de 2026 seulement. Pour les 125 circonscriptions de 2022 (carte de 2017),
il est ESTIMÉ : chaque ancienne circonscription reçoit la moyenne des profils des nouvelles circonscriptions qu'elle
recoupe, pondérée par la population estimée de l'intersection (population de la nouvelle circonscription × part de sa
superficie située dans l'ancienne). Le drapeau « stable » marque les anciennes circonscriptions presque identiques
(≥ 90 % de superficie commune dans les deux sens) pour lesquelles l'estimation est quasi exacte.
"""
import json, re, unicodedata
from pathlib import Path
import numpy as np, pandas as pd, xlrd

ROOT = Path(__file__).resolve().parent.parent
BLEU = ROOT / "sources/donnees-bleues-elections-qc/data/processed"

def norm(s):
    s = re.sub(r"[‐-―]", " ", str(s)); s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()

wb = xlrd.open_workbook(ROOT / "sources/statistiques-recensement-2021-CEP2026.xls")
d = wb.sheet_by_name("127 CEP 2026 ")
h1, h2 = d.row_values(1), d.row_values(2)
names = {j: (str(h1[j]).strip() + " " + str(h2[j]).strip()).strip() for j in range(3, d.ncols) if str(h1[j]).strip()}
rows = {d.cell_value(r, 0): r for r in range(d.nrows) if d.cell_value(r, 0)}
# facteur : (code de ligne du fichier, multiplicateur)
IND = {
    "bac": ("TAB3C751a", 100),     # % des 25-64 ans avec baccalauréat ou plus
    "bsc": ((["TAB3C752"], "TAB3C742"), 100),                          # baccalauréat seulement
    "mas": ((["TAB3C753", "TAB3C754", "TAB3C755", "TAB3C756"], "TAB3C742"), 100),  # au-dessus du bac : certificat sup., médecine, maîtrise, doctorat
    "ceg": ("TAB3C749a", 100),     # collège / cégep
    "met": ("TAB3C746a", 100),     # métiers / apprentis
    "nod": ("TAB3C743a", 100),     # aucun certificat, diplôme ou grade
    "inc": ("TAB2C2402_REV", 1),   # revenu total moyen des 15 ans et plus, 2020 ($)
    "age": ("TAB3-S-C3", 1),       # âge médian
    "fr":  ("TAB1CH_217a", 100),   # % langue maternelle française
    "en":  ("TAB1CH_216a", 100),   # % langue maternelle anglaise
    "imm": ("TAB2C18a", 100),      # % immigrants
    "loc": ("TAB2C2515a", 100),    # % ménages locataires
}
FACT = list(IND) + ["dens"]
def val(code, j):
    if isinstance(code, tuple):
        nums = [val(c, j) for c in code[0]]; den = val(code[1], j)
        return None if den in (None, 0) or None in nums else sum(nums) / den
    v = d.cell_value(rows[code], j)
    return float(v) if isinstance(v, (int, float)) else None

cw = pd.read_csv(BLEU / "district_map_changes_spatial.csv")
cw["ocode"] = cw.old_district_id.str.split("-").str[-1].astype(int)
cw["ncode"] = cw.new_district_id.str.split("-").str[-1].astype(int)
new_area = cw.drop_duplicates("ncode").set_index("ncode").new_area_km2.to_dict()
old_area = cw.drop_duplicates("ocode").set_index("ocode").old_area_km2.to_dict()
old_name = cw.drop_duplicates("ocode").set_index("ocode").old_name_source.to_dict()

R26 = json.loads((ROOT / "data/r/2026.json").read_text())["ridings"]
R22 = json.loads((ROOT / "data/r/2022.json").read_text())["ridings"]
by26 = {norm(r["n"]): r for r in R26}
code26 = {int(r["id"].split("_")[-1]): r for r in R26}

def shares(r):
    sh = {}
    for c in r["c"]:
        sh[c[1]] = round(sh.get(c[1], 0) + (c[4] or 0), 2)
    return sh

# --- 2026 : profil officiel ---
rec26 = {}
for j, nm in names.items():
    k = norm(nm)
    r = by26.get(k) or next((v for kk, v in by26.items() if kk.startswith(k) or k.startswith(kk)), None)
    assert r, nm
    code = int(r["id"].split("_")[-1])
    rec = {"id": r["id"], "n": r["n"], "w": r["w"], "pop": val("TAB1CH_0", j)}
    for key, (rc, mult) in IND.items():
        v = val(rc, j)
        rec[key] = None if v is None else v * mult
    rec["dens"] = rec["pop"] / new_area[code]
    rec["sh"] = shares(r)
    rec26[code] = rec
assert len(rec26) == 127

# --- 2022 : profil estimé par pondération surfacique ---
by22 = {norm(r["n"]): r for r in R22}
rec22, unmatched = {}, []
for oc, g in cw.groupby("ocode"):
    nm = old_name[oc]
    r = by22.get(norm(nm)) or by22.get(norm("Les " + nm))   # ex. « Chutes-de-la-Chaudière » / « Les Chutes-de-la-Chaudière »
    if r is None:
        unmatched.append(nm); continue
    w = np.array([rec26[n]["pop"] * f for n, f in zip(g.ncode, g.new_area_fraction)])
    rec = {"id": r["id"], "n": r["n"], "w": r["w"], "pop": float(w.sum())}
    for key in IND:
        xs = [rec26[n][key] for n in g.ncode]
        ok = [i for i, x in enumerate(xs) if x is not None]
        rec[key] = float(sum(w[i] * xs[i] for i in ok) / sum(w[i] for i in ok))
    rec["dens"] = rec["pop"] / old_area[oc]
    rec["stable"] = bool(((g.old_area_fraction >= .9) & (g.new_area_fraction >= .9)).any())
    rec["sh"] = shares(r)
    rec22[oc] = rec
print("2022 : appariées", len(rec22), "| non appariées", unmatched, "| stables", sum(r["stable"] for r in rec22.values()))

PARTIES = ["PQ", "PLQ", "PCQ", "CAQ", "QS"]
MULTI = ["bac", "inc", "age", "fr", "imm", "loc", "ldens"]   # « en » exclue : colinéaire avec « fr »

def stats(recs):
    for r in recs: r["ldens"] = float(np.log10(r["dens"]))
    X = {k: np.array([r[k] for r in recs], float) for k in FACT + ["ldens"]}
    out = {}
    for p in PARTIES:
        y = np.array([r["sh"].get(p, 0) for r in recs])
        cor, fit = {}, {}
        for k in FACT:
            xk = X["ldens"] if k == "dens" else X[k]
            cor[k] = float(np.corrcoef(xk, y)[0, 1])
            fit[k] = [float(a) for a in np.polyfit(xk, y, 1)]
        Z = np.column_stack([np.ones(len(y))] + [(X[k] - X[k].mean()) / X[k].std() for k in MULTI])
        b = np.linalg.lstsq(Z, y, rcond=None)[0]
        res = y - Z @ b
        dof = len(y) - Z.shape[1]
        s2 = (res ** 2).sum() / dof
        se = np.sqrt(np.diag(s2 * np.linalg.inv(Z.T @ Z)))
        r2 = 1 - (res ** 2).sum() / ((y - y.mean()) ** 2).sum()
        out[p] = {"r": cor, "fit": fit, "r2": float(r2), "n": len(y),
                  "beta": {k: [float(b[i + 1]), float(se[i + 1])] for i, k in enumerate(MULTI)}}
    return out

rl26 = list(rec26.values()); rl22 = list(rec22.values())
S26 = stats(rl26); S22 = stats(rl22)
stable = [r for r in rl22 if r["stable"]]
S22s = stats(stable) if len(stable) >= 30 else None
# colinéarité entre facteurs (2026)
M = np.corrcoef(np.array([[r[k] for k in FACT[:-1]] + [r["ldens"]] for r in rl26]).T)

def clean(rs):
    keep = ["id", "n", "w", "pop"] + FACT + ["sh"]
    o = []
    for r in rs:
        e = {k: (round(r[k], 3) if isinstance(r[k], float) else r[k]) for k in keep}
        if "stable" in r: e["stable"] = r["stable"]
        o.append(e)
    return o

dr = [abs(S22[p]["r"][k] - S22s[p]["r"][k]) for p in PARTIES for k in FACT] if S22s else []
out = {"meta": {"max_dr_stable": round(max(dr), 3) if dr else None, "mean_dr_stable": round(sum(dr) / len(dr), 3) if dr else None, "factors": FACT, "multi": MULTI, "parties": PARTIES, "cor_2026": M.round(3).tolist(), "n_stable": len(stable)},
       "2026": {"ridings": clean(rl26), "stats": S26},
       "2022": {"ridings": clean(rl22), "stats": S22, "stats_stable": S22s}}
(ROOT / "data/demo.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
print("n stable:", len(stable))
for p in PARTIES:
    print(p, "2026", {k: round(v, 2) for k, v in S26[p]["r"].items()})
    print(p, "2022", {k: round(v, 2) for k, v in S22[p]["r"].items()}, "R2", round(S22[p]["r2"], 2), round(S26[p]["r2"], 2))
