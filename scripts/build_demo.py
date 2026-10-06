#!/usr/bin/env python3
"""Profil socioéconomique (Recensement 2021) des 127 circonscriptions de 2026 + vote 2026.

Entrée : sources/statistiques-recensement-2021-CEP2026.xls (Élections Québec, adaptation de
Statistique Canada, profils semi-personnalisés du Recensement 2021; licence ouverte de Statistique Canada).
Sortie : data/demo2026.json
"""
import json, re, unicodedata
from pathlib import Path
import numpy as np, xlrd

ROOT = Path(__file__).resolve().parent.parent
wb = xlrd.open_workbook(ROOT / "sources/statistiques-recensement-2021-CEP2026.xls")
d = wb.sheet_by_name("127 CEP 2026 ")

def norm(s):
    s = re.sub(r"[\u2010-\u2015]", " ", str(s)); s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()

# noms de colonnes : sur deux lignes (ex. « Anjou– » + « Louis-Riel »)
h1, h2 = d.row_values(1), d.row_values(2)
names = {j: (str(h1[j]).strip() + " " + str(h2[j]).strip()).strip() for j in range(3, d.ncols) if str(h1[j]).strip()}
rows = {d.cell_value(r, 0): r for r in range(d.nrows) if d.cell_value(r, 0)}
IND = {  # clé : (code de ligne, libellé)
    "age": "TAB3-S-C3", "p65": "TAB1CH_20b", "bac": "TAB3C751a", "nodip": "TAB3C743a",
    "inc": "TAB2C2402_REV", "hh": "TAB2C2595",
}
def val(code, j):
    v = d.cell_value(rows[code], j)
    return float(v) if isinstance(v, (int, float)) else None

ridings26 = {norm(r["n"]): r for r in json.loads((ROOT / "data/r/2026.json").read_text())["ridings"]}
# les noms du fichier peuvent être tronqués ou diverger : appariement exact, puis par préfixe unique
keys = list(ridings26)
def match(nm):
    k = norm(nm)
    if k in ridings26: return k
    c = [x for x in keys if x.startswith(k) or k.startswith(x)]
    return c[0] if len(c) == 1 else None

out, unmatched = [], []
for j, nm in names.items():
    k = match(nm)
    if not k:
        unmatched.append(nm); continue
    r = ridings26[k]
    rec = {"id": r["id"], "n": r["n"], "w": r["w"], "pop": val("TAB1CH_0", j)}
    for key, code in IND.items():
        v = val(code, j)
        rec[key] = None if v is None else (v * 100 if key in ("p65", "bac", "nodip") else v)
    sh = {}
    for c in r["c"]:
        sh[c[1]] = round(sh.get(c[1], 0) + c[4], 2)
    rec["sh"] = sh
    out.append(rec)
print("appariées :", len(out), "| non appariées :", unmatched)
missing = set(r["n"] for r in ridings26.values()) - set(o["n"] for o in out)
print("circonscriptions 2026 sans profil :", missing)

# --- statistiques : corrélation simple et régression multiple (variables centrées-réduites) ---
PARTIES = ["PQ", "PLQ", "PCQ", "CAQ", "QS"]
VARS = ["bac", "nodip", "inc", "hh", "age", "p65"]
def z(x): x = np.array(x, float); return (x - x.mean()) / x.std()
stats = {}
ok = [o for o in out if all(o[v] is not None for v in VARS)]
for p in PARTIES:
    y = np.array([o["sh"].get(p, 0) for o in ok])
    cor, slope = {}, {}
    for v in VARS:
        x = np.array([o[v] for o in ok])
        cor[v] = float(np.corrcoef(x, y)[0, 1])
        slope[v] = [float(a) for a in np.polyfit(x, y, 1)]
    X = np.column_stack([np.ones(len(ok))] + [z([o[v] for o in ok]) for v in ("bac", "inc", "age")])
    b, res, *_ = np.linalg.lstsq(X, y, rcond=None)
    r2 = 1 - ((y - X @ b) ** 2).sum() / ((y - y.mean()) ** 2).sum()
    stats[p] = {"r": cor, "fit": slope, "beta": dict(zip(("bac", "inc", "age"), map(float, b[1:]))), "r2": float(r2),
                "mean": float(y.mean()), "sd": float(y.std())}
iv = np.corrcoef(np.array([[o[v] for v in VARS] for o in ok]).T)
meta = {"n": len(ok), "vars": VARS, "cor_vars": iv.round(3).tolist()}
(ROOT / "data/demo2026.json").write_text(json.dumps({"meta": meta, "stats": stats, "ridings": out}, ensure_ascii=False, separators=(",", ":")))
for p in PARTIES:
    print(p, {k: round(v, 2) for k, v in stats[p]["r"].items()}, "R2", round(stats[p]["r2"], 2))
print("corr entre variables", dict(zip(VARS, iv[0].round(2))))
