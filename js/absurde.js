// Section « Laboratoire de corrélations absurdes » (données : data/absurde.json, produites par scripts/build_absurd.py)
(() => {
"use strict";
const $ = s => document.querySelector(s);
const col = c => `var(--c-${c})`;
const nf = (x, d = 0) => x.toLocaleString("fr-CA", {minimumFractionDigits: d, maximumFractionDigits: d});
const sg = (x, d = 2) => (x < -0.0049 ? "−" : x > 0.0049 ? "+" : "") + nf(Math.abs(x), d);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const PARTIES = {PQ: "Parti québécois", PLQ: "Parti libéral du Québec", PCQ: "Parti conservateur du Québec", CAQ: "Coalition avenir Québec", QS: "Québec solidaire"};
const S = {d: null, p: "QS", k: null, only: "all", adj: false};
const W = 700, M = {l: 52, r: 14, t: 12, b: 44};
let H = 340;

function list() {
  const P = S.d.parties[S.p];
  return P.top.filter(t => S.only === "all" || S.d.vars[t.k].kind === "absurde").slice(0, S.only === "all" ? 14 : 20);
}
function drawList() {
  const P = S.d.parties[S.p], L = list();
  if (!L.some(t => t.k === S.k)) S.k = L[0].k;
  $("#ab-list").innerHTML = L.map(t => {
    const v = S.d.vars[t.k], r = S.adj ? t.rp : t.r, w = Math.min(50, Math.abs(r) * 50);
    return `<button type="button" class="ab-row" data-k="${esc(t.k)}" aria-pressed="${t.k === S.k}">
      <span class="ab-lab">${esc(v.label)}${v.kind === "absurde" ? ' <em class="tag">sans aucun sens</em>' : ""}</span>
      <span class="ab-val">${sg(r)}</span>
      <span class="rtr"><b style="${r < 0 ? `right:50%;width:${w}%` : `left:50%;width:${w}%`};background:${col(S.p)}"></b></span></button>`;
  }).join("");
  const nb = S.d.pool;
  $("#ab-read").innerHTML = `Parmi <b>${nb}</b> variables du recensement et de la carte, <b>${P.n_over_05}</b> ont une corrélation d'au moins 0,5 (en valeur absolue) avec le vote ${esc(PARTIES[S.p])}; le meilleur score atteint ${nf(P.max, 2)}. Du pur bruit, sur ${S.d.n} circonscriptions, ne dépasserait presque jamais ${nf(S.d.bruit95, 2)} même en essayant ${nb} variables. Après avoir tenu compte de sept facteurs (scolarité, revenu, âge, langue, immigration, locataires, densité), il n'en reste que <b>${P.n_over_05_adj}</b>.`;
}
function drawPlot() {
  const svg = d3.select("#ab-plot"); svg.selectAll("*").remove();
  const v = S.d.vars[S.k], t = S.d.parties[S.p].top.find(q => q.k === S.k);
  const R = S.d.ridings.map((r, i) => ({x: v.v[i], y: r.sh[S.p] || 0, n: r.n, w: r.w}));
  const w = Math.max(520, $("#ab-plot").parentNode.clientWidth || W);
  H = Math.max(280, Math.min(380, innerHeight - 300));
  svg.attr("viewBox", `0 0 ${w} ${H}`);
  const x = d3.scaleLinear().domain(d3.extent(R, d => d.x)).nice().range([M.l, w - M.r]);
  const y = d3.scaleLinear().domain([0, d3.max(R, d => d.y) * 1.05]).nice().range([H - M.b, M.t]);
  y.ticks(5).forEach(tk => {
    svg.append("line").attr("x1", M.l).attr("x2", w - M.r).attr("y1", y(tk)).attr("y2", y(tk)).style("stroke", "var(--line)");
    svg.append("text").attr("x", M.l - 8).attr("y", y(tk) + 4).attr("text-anchor", "end").style("font", "11px var(--f-body)").style("fill", "var(--muted)").text(tk + " %");
  });
  x.ticks(6).forEach(tk => svg.append("text").attr("x", x(tk)).attr("y", H - M.b + 18).attr("text-anchor", "middle").style("font", "11px var(--f-body)").style("fill", "var(--muted)").text(nf(tk)));
  svg.append("text").attr("x", (M.l + w - M.r) / 2).attr("y", H - 8).attr("text-anchor", "middle").style("font", "12px var(--f-body)").style("fill", "var(--ink2)").text(v.label.length > 95 ? v.label.slice(0, 92) + "…" : v.label);
  svg.append("text").attr("transform", `translate(14,${(M.t + H - M.b) / 2}) rotate(-90)`).attr("text-anchor", "middle").style("font", "12px var(--f-body)").style("fill", "var(--ink2)").text(`Vote ${S.p} (% des votes valides)`);
  const n = R.length, mx = d3.mean(R, d => d.x), my = d3.mean(R, d => d.y);
  const sl = d3.sum(R, d => (d.x - mx) * (d.y - my)) / (d3.sum(R, d => (d.x - mx) ** 2) || 1), ic = my - sl * mx, [a, b] = x.domain();
  svg.append("line").attr("x1", x(a)).attr("x2", x(b)).attr("y1", y(ic + sl * a)).attr("y2", y(ic + sl * b)).style("stroke", col(S.p)).style("stroke-width", 2.5);
  svg.selectAll("circle").data(R).join("circle").attr("cx", d => x(d.x)).attr("cy", d => y(d.y)).attr("r", 4.5)
    .style("fill", d => col(d.w)).style("stroke", "var(--bg)").style("stroke-width", 1.2).append("title").text(d => `${d.n} : ${nf(d.x, 1)} → ${nf(d.y, 1)} %`);
  $("#ab-cap").textContent = `r = ${sg(t.r)} (brute) · ${sg(t.rp)} après contrôle des sept facteurs. Couleur d'un point : parti élu.`;
}
function draw() { drawList(); drawPlot(); }
function controls() {
  const ch = $("#ab-p");
  ch.innerHTML = Object.entries(PARTIES).map(([k, v]) => `<button type="button" class="pchip" data-k="${k}" aria-pressed="${k === S.p}"><span class="chip" style="background:${col(k)}"></span>${esc(v)}</button>`).join("");
  ch.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; S.p = b.dataset.k; ch.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); draw(); });
  const mk = (id, opts, key) => { const el = $(id); el.innerHTML = opts.map(([k, l]) => `<button type="button" data-k="${k}" aria-pressed="${String(S[key]) === k}">${l}</button>`).join("");
    el.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; S[key] = key === "adj" ? b.dataset.k === "true" : b.dataset.k; el.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); draw(); }); };
  mk("#ab-adj", [["false", "Corrélation brute"], ["true", "Après contrôle de 7 facteurs"]], "adj");
  mk("#ab-only", [["all", "Les plus fortes"], ["absurde", "Les vraiment absurdes"]], "only");
  $("#ab-list").addEventListener("click", e => { const b = e.target.closest(".ab-row"); if (!b) return; S.k = b.dataset.k; drawList(); drawPlot(); });
}
fetch("data/absurde.json").then(r => r.json()).then(d => { S.d = d; controls(); draw();
  let t; addEventListener("resize", () => { clearTimeout(t); t = setTimeout(drawPlot, 150); });
}).catch(e => { $("#ab-read").textContent = "Impossible de charger le laboratoire."; console.error(e); });
})();
