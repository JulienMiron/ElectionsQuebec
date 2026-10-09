#!/usr/bin/env python3
"""Données du simulateur « Où votent les gens comme vous ? » : pour chaque circonscription de 2026, la part des
habitants dans chaque catégorie (âge, revenu, scolarité, langue, immigration, logement) et le vote de 2026.
Entrées : sources/statistiques-recensement-2021-CEP2026.xls, data/demo.json    Sortie : data/profil.json"""
import json, re, unicodedata
from pathlib import Path
import numpy as np, xlrd

ROOT = Path(__file__).resolve().parent.parent
demo = json.loads((ROOT / "data/demo.json").read_text())
RID = demo["2026"]["ridings"]; n = len(RID)
wb = xlrd.open_workbook(ROOT / "sources/statistiques-recensement-2021-CEP2026.xls")
d = wb.sheet_by_name("127 CEP 2026 ")
h1, h2 = d.row_values(1), d.row_values(2)
def norm(s):
    s = re.sub(r"[‐-―]", " ", str(s)); s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()
by = {norm(r["n"]): i for i, r in enumerate(RID)}
jmap = {}
for j in range(3, d.ncols):
    if str(h1[j]).strip():
        k = norm((str(h1[j]).strip() + " " + str(h2[j]).strip()).strip())
        i = by.get(k) if k in by else next((i for kk, i in by.items() if kk.startswith(k) or k.startswith(kk)), None)
        if i is not None: jmap[j] = i
assert len(set(jmap.values())) == n
rows = {d.cell_value(r, 0): r for r in range(d.nrows) if d.cell_value(r, 0)}
def row(code):
    v = np.zeros(n)
    for j, i in jmap.items(): v[i] = d.cell_value(rows[code], j)
    return v
G = {  # variable -> [(catégorie, libellé, code ou expression)]
 "age": [("a0", "0 à 14 ans", "TAB1CH_2b"), ("a1", "15 à 29 ans", "TAB1CH_5b"), ("a2", "30 à 44 ans", "TAB1CH_13b"), ("a3", "45 à 59 ans", "TAB1CH_16a"), ("a4", "60 à 74 ans", "TAB1CH_19b"), ("a5", "75 ans et plus", "TAB1CH_22b")],
 "rev": [("r0", "Moins de 20 000 $", "TAB2C2236_REV"), ("r1", "20 000 $ à 59 999 $", "TAB2C2240b_REV"), ("r2", "60 000 $ à 99 999 $", "TAB2C2244b_REV"), ("r3", "100 000 $ et plus", "TAB2C2247_REV")],
 "sco": [("s0", "Aucun diplôme", "TAB3C743a"), ("s1", "Diplôme d'études secondaires", "TAB3C744a"), ("s2", "Métiers ou apprentissage", "TAB3C746a"), ("s3", "Cégep ou collège", "TAB3C749a"), ("s4", "Baccalauréat", "bsc"), ("s5", "Grade supérieur au baccalauréat", "mas")],
}
out = {"n": n, "vars": {}, "ridings": []}
cols = {}
for var, cats in G.items():
    for k, lab, code in cats:
        v = np.array([r[code] for r in RID]) / 100 if code in ("bsc", "mas") else row(code)
        cols[k] = v
    s = sum(cols[k] for k, _, _ in cats)
    print(var, "somme des parts : min %.2f max %.2f" % (s.min(), s.max()))
fr = np.array([r["fr"] for r in RID]) / 100; en = np.array([r["en"] for r in RID]) / 100; imm = np.array([r["imm"] for r in RID]) / 100
loc = np.array([r["loc"] for r in RID]) / 100
cols.update(l0=fr, l1=en, l2=np.clip(1 - fr - en, 0, 1), i0=1 - imm, i1=imm, t0=1 - loc, t1=loc)
out["vars"] = {
 "age": [[k, lab] for k, lab, _ in G["age"][1:]], "rev": [[k, lab] for k, lab, _ in G["rev"]], "sco": [[k, lab] for k, lab, _ in G["sco"]],
 "lng": [["l0", "Français"], ["l1", "Anglais"], ["l2", "Autre langue"]], "imm": [["i0", "Non"], ["i1", "Oui"]], "log": [["t0", "Propriétaire"], ["t1", "Locataire"]]}
MAIN = ["CAQ", "PQ", "PLQ", "QS", "PCQ"]
for i, r in enumerate(RID):
    sh = {p: r["sh"].get(p, 0.0) for p in MAIN}; sh["AUT"] = round(max(0.0, 100 - sum(sh.values())), 2)
    out["ridings"].append({"n": r["n"], "w": r["w"], "pop": r["pop"], "sh": sh, "c": {k: round(float(v[i]), 4) for k, v in cols.items()}})
(ROOT / "data/profil.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
print({p: round(sum(r["sh"][p] * r["pop"] for r in out["ridings"]) / sum(r["pop"] for r in out["ridings"]), 1) for p in MAIN + ["AUT"]})
