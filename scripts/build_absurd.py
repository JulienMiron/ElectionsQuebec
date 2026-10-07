#!/usr/bin/env python3
"""Laboratoire de corrélations absurdes : sort, parmi des centaines de variables du recensement et quelques
variables sans aucun sens (longueur du nom, position géographique…), celles qui « expliquent » le mieux le vote de 2026.
Entrées : sources/statistiques-recensement-2021-CEP2026.xls, data/demo.json, data/r/2026.json, data/geo/ro2026.json
Sortie : data/absurde.json"""
import json, re
from pathlib import Path
import numpy as np, xlrd

ROOT = Path(__file__).resolve().parent.parent
rng = np.random.default_rng(2026)
demo = json.loads((ROOT / "data/demo.json").read_text())
RID = demo["2026"]["ridings"]; n = len(RID)
PARTIES = list(demo["meta"]["parties"])
MULTI = ["bac", "inc", "age", "fr", "imm", "loc"]
Xc = np.column_stack([np.ones(n)] + [np.array([r[k] for r in RID], float) for k in MULTI] + [np.log10([r["dens"] for r in RID])])
Y = {p: np.array([r["sh"].get(p, 0.0) for r in RID], float) for p in PARTIES}
resid = lambda v: v - Xc @ np.linalg.lstsq(Xc, v, rcond=None)[0]

# --- pool du recensement : toutes les lignes en pourcentage, nommées par leur contexte (indentation = parent)
wb = xlrd.open_workbook(ROOT / "sources/statistiques-recensement-2021-CEP2026.xls")
d = wb.sheet_by_name("127 CEP 2026 ")
h1, h2 = d.row_values(1), d.row_values(2)
colid = {}
for j in range(3, d.ncols):
    if str(h1[j]).strip():
        colid[j] = (str(h1[j]).strip() + " " + str(h2[j]).strip()).strip()
import unicodedata
def norm(s):
    s = re.sub(r"[‐-―]", " ", str(s)); s = unicodedata.normalize("NFD", s).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", " ", s).strip()
by = {norm(r["n"]): i for i, r in enumerate(RID)}
jmap = {}
for j, nm in colid.items():
    k = norm(nm); i = by.get(k) if k in by else next((i for kk, i in by.items() if kk.startswith(k) or k.startswith(kk)), None)
    if i is not None: jmap[j] = i
assert len(set(jmap.values())) == n, (len(jmap), n)
EXCL = {"TAB3C751a", "TAB3C743a", "TAB3C746a", "TAB3C749a", "TAB1CH_217a", "TAB1CH_216a", "TAB2C18a", "TAB2C2515a", "TAB2C2514a"}
section, stack, pool = "", [], []
for r in range(3, d.nrows):
    code, txt = str(d.cell_value(r, 0)).strip(), str(d.cell_value(r, 1))
    if code and not txt.strip() and not isinstance(d.cell_value(r, 2), float): section = code; continue
    if not txt.strip():
        if code: section = code
        continue
    ind = len(txt) - len(txt.lstrip()); t = txt.strip()
    while stack and stack[-1][0] >= ind: stack.pop()
    stack.append((ind, t))
    if not t.endswith("(pourcentage)") or code in EXCL: continue
    vals = [d.cell_value(r, j) for j in jmap]
    if not all(isinstance(v, float) for v in vals): continue
    v = np.zeros(n)
    for j, i in jmap.items(): v[i] = d.cell_value(r, j)
    if v.std() < 1e-6 or v.max() > 1.0 + 1e-9: continue
    pool.append({"id": code, "leaf": t.replace(" (pourcentage)", ""), "ctx": [s_[1] for s_ in stack[:-1]], "v": v * 100, "kind": "recensement"})

# --- variables sans aucun sens (propres à la circonscription, sans rapport avec le vote)
geo = json.loads((ROOT / "data/geo/ro2026.json").read_text())
sc, tr = geo["transform"]["scale"], geo["transform"]["translate"]
arcs = []
for a in geo["arcs"]:
    x = y = 0; pts = []
    for dx, dy in a:
        x += dx; y += dy; pts.append((x * sc[0] + tr[0], y * sc[1] + tr[1]))
    arcs.append(pts)
def geom_pts(g):
    out = []
    def walk(a):
        for e in a:
            if isinstance(e, int): out.extend(arcs[e if e >= 0 else ~e])
            else: walk(e)
    walk(g["arcs"]); return np.array(out)
cen = {}
for g in geo["objects"]["ro2026"]["geometries"]:
    p = geom_pts(g); cen[g["properties"]["geo_id"].split("_")[-1]] = ((p[:, 0].min() + p[:, 0].max()) / 2, (p[:, 1].min() + p[:, 1].max()) / 2)
cx = np.array([cen[r["id"].split("_")[-1]][0] for r in RID]) / 1000; cy = np.array([cen[r["id"].split("_")[-1]][1] for r in RID]) / 1000
names = [r["n"] for r in RID]
absurd = [
    ("nom_long", "Nombre de lettres dans le nom de la circonscription", np.array([len(re.sub(r"[^A-Za-zÀ-ÿ]", "", s)) for s in names], float)),
    ("nom_mots", "Nombre de mots dans le nom de la circonscription", np.array([len(re.findall(r"[^\s\-–]+", s)) for s in names], float)),
    ("nom_saint", "Le nom contient « Saint » ou « Sainte » (0 ou 1)", np.array([1.0 if re.search(r"\bSainte?\b", s) else 0.0 for s in names])),
    ("nom_e", "Nombre de « e » dans le nom", np.array([s.lower().count("e") + s.lower().count("é") for s in names], float)),
    ("nom_trait", "Le nom contient un trait d'union (0 ou 1)", np.array([1.0 if "-" in s or "–" in s else 0.0 for s in names])),
    ("alpha", "Rang alphabétique de la circonscription (1 à 127)", np.array(sorted(range(n), key=lambda i: norm(names[i]))).argsort() + 1.0),
    ("nord", "Position nord–sud du centre (km, vers le nord)", cy),
    ("est", "Position est–ouest du centre (km, vers l'est)", cx),
    ("lpop", "Population totale (milliers)", np.array([r["pop"] for r in RID], float) / 1000),
]
CURATED = {
    "TAB3C252a": "Va au travail à vélo", "TAB3C251a": "Va au travail à pied", "TAB3C250a": "Va au travail en transport en commun",
    "TAB3C248a": "Va au travail en auto, comme conducteur", "TAB3C269a": "Trajet domicile-travail de moins de 15 minutes", "TAB3C273a": "Trajet domicile-travail de plus de 60 minutes",
    "TAB3C117a": "Travaille en arts, culture, sports et loisirs", "TAB3C119a": "Travaille dans les métiers, le transport et la machinerie",
    "TAB3C120a": "Travaille en ressources naturelles et agriculture", "TAB3C115a": "Travaille dans la santé",
    "TAB3C151a": "Travaille en agriculture, foresterie, pêche et chasse", "TAB3C152a": "Travaille dans les mines et le pétrole",
    "TAB3C154a": "Travaille dans la construction", "TAB3C155a": "Travaille en fabrication", "TAB3C157a": "Travaille dans le commerce de détail",
    "TAB3C159a": "Travaille dans l'information et la culture", "TAB3C160a": "Travaille en finance et assurances", "TAB3C162a": "Travaille en services professionnels et techniques",
    "TAB3C167a": "Travaille en arts, spectacles et loisirs (industrie)", "TAB3C168a": "Travaille en hébergement et restauration", "TAB3C170a": "Travaille dans les administrations publiques",
    "TAB2C2450c_REV": "Part du revenu venant des prestations COVID d'urgence", "TAB2C2450a_REV": "Part du revenu venant de l'assurance emploi",
    "TAB2C2450_REV": "Part du revenu venant des transferts gouvernementaux", "TAB2C2449_REV": "Part du revenu venant d'un emploi",
    "TAB2C2495a": "Logements construits en 1960 ou avant", "TAB2C2501z": "Logements construits de 2017 à 2021", "TAB2C2543": "Propriétaires avec hypothèque",
    "TAB1CH_2b": "Enfants de 0 à 14 ans", "TAB1CH_16a": "Personnes de 45 à 59 ans", "TAB1CH_27b": "Part d'hommes",
    "TAB2C1352a": "Identité autochtone", "TAB2C458a": "Minorités visibles", "TAB2C2a": "Citoyens canadiens", "TAB2C2516a": "Logements fournis par un gouvernement local ou une bande",
}
from collections import Counter
cnt = Counter(q["leaf"] for q in pool)
def clean(x):
    x = re.sub(r"à l[’']exclusion des pensionnaires.*?\(Données intégrales\)\s*\d*\s*[-–]?", "", x)
    x = re.sub(r"\(pourcentage\)|\(nombre\)|Population (totale )?(âgée de [\d\w ]+ )?dans les ménages privés|selon (le|la|les|l[’'])?\s*", "", x)
    return re.sub(r"\s+", " ", x).strip(" -–›")
for q in pool:
    ctx = [clean(c) for c in q["ctx"]]; ctx = [c for c in ctx if c and c != q["leaf"] and not c.startswith("Toutes les")]
    q["label"] = q["leaf"] if cnt[q["leaf"]] == 1 or not ctx else f'{q["leaf"]} ({" ; ".join(ctx[-2:])[:70]})'
for k, lab, v in absurd: pool.append({"id": k, "label": lab, "v": v, "kind": "farfelu" if k in ("lpop", "nord", "est") else "absurde"})

V = np.array([p["v"] for p in pool]); Vz = (V - V.mean(1, keepdims=True)) / V.std(1, keepdims=True)
Vr = np.array([resid(v) for v in V]); Vrz = (Vr - Vr.mean(1, keepdims=True)) / np.where(Vr.std(1, keepdims=True) < 1e-9, 1, Vr.std(1, keepdims=True))
def cors(Z, y): yz = (y - y.mean()) / y.std(); return Z @ yz / n
out = {"n": n, "pool": len(pool), "parties": {}, "vars": {}}
noise_max = np.sort([np.abs(rng.standard_normal((len(pool), n)) @ ((y := Y["PQ"]) - y.mean()) / y.std() / n).max() for _ in range(400)])
out["bruit95"] = round(float(noise_max[int(.95 * 400)]), 3)
keep = set()
for p in PARTIES:
    r = cors(Vz, Y[p]); yr = resid(Y[p])
    rp = cors(Vrz, yr) if yr.std() > 1e-9 else np.zeros(len(pool))
    order = np.argsort(-np.abs(r))
    for i, q in enumerate(pool):
        if q["id"] in CURATED: q["label"] = CURATED[q["id"]]; q["kind"] = "farfelu"
    cand = [i for i, q in enumerate(pool) if q["kind"] != "recensement"]
    top = sorted(cand, key=lambda i: -abs(r[i]))
    out["parties"][p] = {"max": round(float(np.abs(r).max()), 3), "n_over_05": int((np.abs(r) >= .5).sum()),
        "n_over_05_adj": int((np.abs(rp) >= .5).sum()),
        "top": [{"k": pool[i]["id"], "r": round(float(r[i]), 3), "rp": round(float(rp[i]), 3)} for i in top]}
    keep.update(top)
for i in keep:
    q = pool[i]; out["vars"][q["id"]] = {"label": q["label"], "kind": q["kind"], "v": [round(float(x), 2) for x in q["v"]]}
out["ridings"] = [{"n": r["n"], "w": r["w"], "sh": r["sh"]} for r in RID]
(ROOT / "data/absurde.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")))
for p in PARTIES:
    print(p, out["parties"][p]["max"], out["parties"][p]["n_over_05"], out["parties"][p]["n_over_05_adj"])
print("pool", len(pool), "bruit95", out["bruit95"])
for t in out["parties"]["PQ"]["top"][:8]: print(t, out["vars"][t["k"]]["label"][:90])
for t in out["parties"]["PQ"]["top"][14:]: print(t, out["vars"][t["k"]]["label"][:60])
