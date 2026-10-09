// Section « Où votent les gens qui vous ressemblent ? » (données : data/profil.json, produites par scripts/build_profil.py)
(() => {
"use strict";
const $ = s => document.querySelector(s);
const col = c => c === "AUT" ? "var(--muted)" : `var(--c-${c})`;
const nf = (x, d = 0) => x.toLocaleString("fr-CA", {minimumFractionDigits: d, maximumFractionDigits: d});
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const NAMES = {PQ: "Parti québécois", PLQ: "Parti libéral du Québec", PCQ: "Parti conservateur du Québec", CAQ: "Coalition avenir Québec", QS: "Québec solidaire", AUT: "Autres partis"};
const ageBand = a => a < 30 ? "a1" : a < 45 ? "a2" : a < 60 ? "a3" : a < 75 ? "a4" : "a5";
const revBand = v => v < 20000 ? "r0" : v < 60000 ? "r1" : v < 100000 ? "r2" : "r3";
const S = {age: 40, rev: 50000, sco: "s4", lng: "l0", imm: "i0", log: "t0"};
let D, avg;

function compute() {
  const ks = [ageBand(S.age), revBand(S.rev), S.sco, S.lng, S.imm, S.log];
  const w = D.ridings.map(r => r.pop * ks.reduce((a, k) => a * r.c[k], 1));
  const tot = w.reduce((a, b) => a + b, 0);
  const p = w.map(x => x / tot);
  const res = Object.keys(NAMES).map(k => ({k, v: D.ridings.reduce((a, r, i) => a + p[i] * r.sh[k], 0)}));
  const top = p.map((x, i) => ({n: D.ridings[i].n, x})).sort((a, b) => b.x - a.x).slice(0, 4);
  return {res: res.sort((a, b) => b.v - a.v), eff: 1 / p.reduce((a, x) => a + x * x, 0), top};
}
function draw() {
  const {res, eff, top} = compute(), max = Math.max(40, Math.ceil(Math.max(...res.map(r => r.v), ...Object.values(avg)) / 10) * 10);
  $("#pf-out").innerHTML = res.map((r, i) => {
    const d = r.v - avg[r.k];
    return `<li class="pf-row"><span class="pf-name"><span class="chip" style="background:${col(r.k)}"></span>${esc(NAMES[r.k])}</span>
      <span class="pf-bar"><b style="width:${r.v / max * 100}%;background:${col(r.k)}"></b><i style="left:${avg[r.k] / max * 100}%" title="Moyenne du Québec : ${nf(avg[r.k], 1)} %"></i></span>
      <span class="pf-v">${nf(r.v, 1)} %</span><span class="pf-d ${d > 0.5 ? "up" : d < -0.5 ? "down" : ""}">${Math.abs(d) < 0.5 ? "≈" : (d > 0 ? "+" : "−") + nf(Math.abs(d), 1)}</span></li>`;
  }).join("");
  $("#pf-top").textContent = `Circonscriptions qui pèsent le plus dans le résultat : ${top.map(t => `${t.n} (${nf(t.x * 100)} %)`).join(", ")}. En tout, ce profil donne un poids réel à l'équivalent d'environ ${nf(eff)} circonscriptions sur ${D.n}.`;
  $("#pf-age-v").textContent = `${S.age} ans`;
  $("#pf-rev-v").textContent = S.rev >= 200000 ? "200 000 $ et plus" : `${nf(S.rev)} $`;
}
function init() {
  const sel = (id, key, list) => { const el = $(id); el.innerHTML = list.map(([k, l]) => `<option value="${k}"${S[key] === k ? " selected" : ""}>${esc(l)}</option>`).join(""); el.addEventListener("change", () => { S[key] = el.value; draw(); }); };
  sel("#pf-sco", "sco", D.vars.sco); sel("#pf-lng", "lng", D.vars.lng); sel("#pf-imm", "imm", D.vars.imm); sel("#pf-log", "log", D.vars.log);
  $("#pf-age").addEventListener("input", e => { S.age = +e.target.value; draw(); });
  $("#pf-rev").addEventListener("input", e => { S.rev = +e.target.value; draw(); });
  const tp = D.ridings.reduce((a, r) => a + r.pop, 0);
  avg = Object.fromEntries(Object.keys(NAMES).map(k => [k, D.ridings.reduce((a, r) => a + r.pop * r.sh[k], 0) / tp]));
  draw();
}
fetch("data/profil.json").then(r => r.json()).then(d => { D = d; init(); }).catch(e => { $("#pf-top").textContent = "Impossible de charger le simulateur."; console.error(e); });
})();
