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
  const w = Math.max(320, $("#pf-out").clientWidth || 640), h = w < 480 ? 300 : 340, m = {l: 40, r: 10, t: 24, b: w < 480 ? 62 : 46};
  const svg = d3.select("#pf-out").attr("viewBox", `0 0 ${w} ${h}`); svg.selectAll("*").remove();
  const x = d3.scaleBand().domain(res.map(r => r.k)).range([m.l, w - m.r]).padding(0.28);
  const y = d3.scaleLinear().domain([0, max]).range([h - m.b, m.t]);
  y.ticks(5).forEach(t => {
    svg.append("line").attr("x1", m.l).attr("x2", w - m.r).attr("y1", y(t)).attr("y2", y(t)).style("stroke", "var(--line)");
    svg.append("text").attr("x", m.l - 6).attr("y", y(t) + 4).attr("text-anchor", "end").style("font", "11px var(--f-body)").style("fill", "var(--muted)").text(t + " %");
  });
  const g = svg.selectAll("g.pb").data(res, d => d.k).join("g").attr("class", "pb");
  g.append("rect").attr("x", d => x(d.k)).attr("width", x.bandwidth()).attr("y", d => y(d.v)).attr("height", d => h - m.b - y(d.v)).attr("rx", 3).style("fill", d => col(d.k))
    .append("title").text(d => `${NAMES[d.k]} : ${nf(d.v, 1)} % (moyenne du Québec : ${nf(avg[d.k], 1)} %)`);
  g.append("line").attr("x1", d => x(d.k) - 4).attr("x2", d => x(d.k) + x.bandwidth() + 4).attr("y1", d => y(avg[d.k])).attr("y2", d => y(avg[d.k])).style("stroke", "var(--ink)").style("stroke-width", 2).style("stroke-dasharray", "4 3");
  g.append("text").attr("x", d => x(d.k) + x.bandwidth() / 2).attr("y", d => Math.min(y(d.v), y(avg[d.k])) - 6).attr("text-anchor", "middle").style("font", "600 13px var(--f-body)").style("fill", "var(--ink)").text(d => nf(d.v, 1) + " %");
  g.each(function (d) {
    const t = d3.select(this).append("text").attr("text-anchor", "middle").style("font", "12px var(--f-body)").style("fill", "var(--ink2)");
    const words = (w < 480 ? d.k === "AUT" ? "Autres" : d.k : NAMES[d.k]).split(" "), cx = x(d.k) + x.bandwidth() / 2;
    const lines = []; let cur = "";
    words.forEach(wd => { if ((cur + " " + wd).trim().length > (x.bandwidth() > 90 ? 16 : 11) && cur) { lines.push(cur); cur = wd; } else cur = (cur + " " + wd).trim(); });
    lines.push(cur);
    lines.forEach((l, i) => t.append("tspan").attr("x", cx).attr("y", h - m.b + 18 + i * 14).text(l));
  });
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
let _t; addEventListener("resize", () => { clearTimeout(_t); _t = setTimeout(() => D && draw(), 150); });
fetch("data/profil.json").then(r => r.json()).then(d => { D = d; init(); }).catch(e => { $("#pf-top").textContent = "Impossible de charger le simulateur."; console.error(e); });
})();
