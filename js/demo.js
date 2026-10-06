// Section « Le vote selon le profil des circonscriptions » (données : data/demo.json, produites par scripts/build_demo.py)
(() => {
"use strict";
const $ = s => document.querySelector(s);
const col = c => `var(--c-${c})`;
const nf = (x, d = 0) => x.toLocaleString("fr-CA", {minimumFractionDigits: d, maximumFractionDigits: d});
const sg = (x, d = 2) => (x < -0.0049 ? "−" : x > 0.0049 ? "+" : "") + nf(Math.abs(x), d);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const PARTIES = {PQ: "Parti québécois", PLQ: "Parti libéral du Québec", PCQ: "Parti conservateur du Québec", CAQ: "Coalition avenir Québec", QS: "Québec solidaire"};
const pctF = v => nf(v) + " %";
const IND = {
  bac:  {tab: "Bac ou plus", label: "Part des 25–64 ans titulaires d'un baccalauréat ou plus", short: "baccalauréat ou plus", unit: 10, per: "10 points de diplômés universitaires de plus", fmt: pctF},
  bsc:  {tab: "Bac seul", label: "Part des 25–64 ans dont le plus haut grade est le baccalauréat", short: "baccalauréat seulement", unit: 5, per: "5 points de plus de titulaires d'un baccalauréat seulement", fmt: pctF},
  mas:  {tab: "Maîtrise ou plus", label: "Part des 25–64 ans avec un grade supérieur au baccalauréat (certificat universitaire supérieur, médecine, maîtrise, doctorat)", short: "grade supérieur au baccalauréat", unit: 5, per: "5 points de plus de titulaires d'un grade supérieur au baccalauréat", fmt: pctF},
  ceg:  {tab: "Cégep", label: "Part des 25–64 ans dont le plus haut diplôme vient d'un collège ou cégep", short: "diplôme collégial", unit: 5, per: "5 points de plus de diplômés collégiaux", fmt: pctF},
  met:  {tab: "Métiers", label: "Part des 25–64 ans titulaires d'un diplôme ou certificat d'apprenti ou d'école de métiers", short: "formation de métier", unit: 5, per: "5 points de plus de diplômés de métiers", fmt: pctF},
  nod:  {tab: "Sans diplôme", label: "Part des 25–64 ans sans certificat, diplôme ni grade", short: "aucun diplôme", unit: 5, per: "5 points de plus de personnes sans diplôme", fmt: pctF},
  inc:  {tab: "Revenu", label: "Revenu total moyen des personnes de 15 ans et plus (2020)", short: "revenu moyen", unit: 10000, per: "10 000 $ de revenu moyen de plus", fmt: v => nf(v / 1000) + " k$"},
  age:  {tab: "Âge", label: "Âge médian de la population", short: "âge médian", unit: 5, per: "5 ans d'âge médian de plus", fmt: v => nf(v)},
  fr:   {tab: "Langue française", label: "Part de la population de langue maternelle française", short: "langue maternelle française", unit: 10, per: "10 points de francophones de plus", fmt: pctF},
  en:   {tab: "Langue anglaise", label: "Part de la population de langue maternelle anglaise", short: "langue maternelle anglaise", unit: 10, per: "10 points d'anglophones de plus", fmt: pctF},
  imm:  {tab: "Immigration", label: "Part de la population immigrante", short: "immigration", unit: 10, per: "10 points d'immigrants de plus", fmt: pctF},
  loc:  {tab: "Locataires", label: "Part des ménages locataires de leur logement", short: "ménages locataires", unit: 10, per: "10 points de locataires de plus", fmt: pctF},
  dens: {tab: "Densité", label: "Densité de population (habitants par km², échelle logarithmique)", short: "densité", log: true, per: "une densité multipliée par 10", fmt: v => nf(v)},
};
const KEYS = Object.keys(IND);
const MULTI = {bac: "Scolarité", inc: "Revenu", age: "Âge", fr: "Langue fr.", imm: "Immigration", loc: "Locataires", ldens: "Densité (log)"};
const S = {d: null, y: "2026", x: "bac", p: "PQ"};
const tip = $("#tip");
function showTip(html, ev) {
  tip.innerHTML = html; tip.hidden = false;
  const r = tip.getBoundingClientRect();
  let x = ev.clientX + 14, y = ev.clientY + 14;
  if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - 14;
  if (y + r.height > innerHeight - 8) y = ev.clientY - r.height - 14;
  tip.style.left = Math.max(8, x) + "px"; tip.style.top = Math.max(8, y) + "px";
}
const hideTip = () => { tip.hidden = true; };
const cur = () => S.d[S.y];

let W = 760, H = 440;
const M = {l: 52, r: 16, t: 14, b: 48};
const svg = d3.select("#demo-plot");
function size() {
  W = Math.max(560, Math.round(document.querySelector("#demo-plot").parentNode.clientWidth || 760));
  H = Math.max(300, Math.min(460, innerHeight - 300));
  svg.attr("viewBox", `0 0 ${W} ${H}`);
}

function draw() {
  size();
  const Y = cur(), X = IND[S.x], R = Y.ridings, st = Y.stats[S.p];
  const [slope, icpt] = st.fit[S.x], r = st.r[S.x];
  svg.selectAll("*").remove();
  const val = o => o[S.x];
  const x = X.log ? d3.scaleLog().domain(d3.extent(R, val)).range([M.l, W - M.r])
                  : d3.scaleLinear().domain(d3.extent(R, val)).nice().range([M.l, W - M.r]);
  const yMax = Math.ceil(d3.max(R, o => o.sh[S.p] || 0) / 10) * 10;
  const y = d3.scaleLinear().domain([0, Math.max(yMax, 20)]).range([H - M.b, M.t]);
  y.ticks(5).forEach(v => {
    svg.append("line").attr("x1", M.l).attr("x2", W - M.r).attr("y1", y(v)).attr("y2", y(v)).style("stroke", "var(--line)");
    svg.append("text").attr("x", M.l - 8).attr("y", y(v) + 4).attr("text-anchor", "end").style("font", "11px var(--f-body)").style("fill", "var(--muted)").text(v + " %");
  });
  const xt = X.log ? x.ticks(5).filter(v => v >= 1 && Math.log10(v) % 1 === 0) : x.ticks(6);
  xt.forEach(v => svg.append("text").attr("x", x(v)).attr("y", H - M.b + 18).attr("text-anchor", "middle").style("font", "11px var(--f-body)").style("fill", "var(--muted)").text(X.fmt(v)));
  svg.append("text").attr("x", (M.l + W - M.r) / 2).attr("y", H - 8).attr("text-anchor", "middle").style("font", "12px var(--f-body)").style("fill", "var(--ink2)").text(X.label);
  svg.append("text").attr("transform", `translate(14,${(M.t + H - M.b) / 2}) rotate(-90)`).attr("text-anchor", "middle").style("font", "12px var(--f-body)").style("fill", "var(--ink2)").text(`Vote ${S.p} (% des votes valides)`);
  const [x0, x1] = x.domain();
  const f = v => icpt + slope * (X.log ? Math.log10(v) : v);
  const clamp = v => Math.max(0, Math.min(y.domain()[1], v));
  svg.append("line").attr("x1", x(x0)).attr("x2", x(x1)).attr("y1", y(clamp(f(x0)))).attr("y2", y(clamp(f(x1))))
    .style("stroke", col(S.p)).style("stroke-width", 3).style("stroke-linecap", "round").style("opacity", .9);
  svg.append("g").selectAll("circle").data(R).join("circle")
    .attr("cx", o => x(val(o))).attr("cy", o => y(o.sh[S.p] || 0)).attr("r", 5)
    .style("fill", o => o.w ? col(o.w) : "var(--none)").style("stroke", "var(--panel)").style("stroke-width", 1.5).style("fill-opacity", .85)
    .on("mousemove", (ev, o) => showTip(`<b>${esc(o.n)}</b><br>Élu : ${esc(PARTIES[o.w] || o.w)}<br>${esc(X.short)} : ${X.fmt(val(o))}<br>Vote ${S.p} : ${nf(o.sh[S.p] || 0, 1)} %`, ev))
    .on("mouseleave", hideTip);
  const per = X.log ? slope : slope * X.unit;
  const strength = Math.abs(r) >= .6 ? "forte" : Math.abs(r) >= .35 ? "modérée" : "faible";
  $("#demo-read").innerHTML = `<strong>${esc(PARTIES[S.p])} et ${esc(X.short)} (${S.y === "2022" ? "2022, profil estimé" : "2026"}) :</strong> corrélation ${strength} (r = ${sg(r)}). ` +
    `En moyenne, ${X.per} va de pair avec ${nf(Math.abs(per), 1)} point${Math.abs(per) >= 2 ? "s" : ""} de vote ${per < 0 ? "en moins" : "en plus"} pour ce parti. ` +
    `Ce facteur seul explique ${r * r < 0.01 ? "moins de 1" : nf(r * r * 100)} % des écarts de vote entre circonscriptions.`;
  $("#demo-y22").hidden = S.y !== "2022";
}

function drawMatrix() {
  const Y = cur();
  const rows = Object.keys(PARTIES).map(p => {
    const cells = KEYS.map(k => {
      const r = Y.stats[p].r[k], w = Math.abs(r) * 50;
      return `<td><div class="rbar" title="r = ${sg(r)}"><span class="rv">${sg(r)}</span><div class="rtr"><b style="${r < 0 ? `right:50%;width:${w}%` : `left:50%;width:${w}%`};background:${col(p)}"></b></div></div></td>`;
    }).join("");
    return `<tr><th scope="row"><span class="chip" style="background:${col(p)}"></span>${esc(PARTIES[p])}</th>${cells}<td class="r2">${nf(Y.stats[p].r2 * 100)} %</td></tr>`;
  }).join("");
  $("#demo-matrix").innerHTML = `<caption class="sr">Corrélation entre le vote de chaque parti et le profil des circonscriptions</caption>
    <thead><tr><th scope="col">Parti</th>${KEYS.map(k => `<th scope="col">${esc(IND[k].tab)}</th>`).join("")}<th scope="col" title="Part des écarts de vote expliquée par sept facteurs ensemble">Ensemble (R²)</th></tr></thead><tbody>${rows}</tbody>`;
  const b = Object.keys(PARTIES).map(p => {
    const cells = Object.keys(MULTI).map(k => {
      const [c, se] = Y.stats[p].beta[k], sig = Math.abs(c) >= 1.96 * se;
      return `<td class="${sig ? "sig" : "ns"}" title="IC à 95 % : ${sg(c - 1.96 * se, 1)} à ${sg(c + 1.96 * se, 1)}">${sg(c, 1)}</td>`;
    }).join("");
    return `<tr><th scope="row"><span class="chip" style="background:${col(p)}"></span>${esc(PARTIES[p])}</th>${cells}</tr>`;
  }).join("");
  $("#demo-beta").innerHTML = `<thead><tr><th scope="col">Parti</th>${Object.values(MULTI).map(v => `<th scope="col">${esc(v)}</th>`).join("")}</tr></thead><tbody>${b}</tbody>`;
}

function drawCompare() {
  const a = S.d["2022"].stats, b = S.d["2026"].stats;
  const head = Object.keys(PARTIES).map(p => `<th scope="col"><span class="chip" style="background:${col(p)}"></span>${esc(p)}</th>`).join("");
  const rows = KEYS.map(k => {
    const cells = Object.keys(PARTIES).map(p => {
      const r1 = a[p].r[k], r2 = b[p].r[k], d = r2 - r1, big = Math.abs(d) >= 0.2;
      return `<td class="${big ? "big" : ""}"><span class="cmp">${sg(r1)} → ${sg(r2)}</span><span class="dl ${d > 0 ? "up" : "down"}">${Math.abs(d) < 0.05 ? "≈" : (d > 0 ? "▲ " : "▼ ") + nf(Math.abs(d), 2)}</span></td>`;
    }).join("");
    return `<tr><th scope="row">${esc(IND[k].tab)}</th>${cells}</tr>`;
  }).join("");
  $("#demo-cmp").innerHTML = `<caption class="sr">Corrélations de 2022 et de 2026 par parti et par facteur</caption><thead><tr><th scope="col">Facteur</th>${head}</tr></thead><tbody>${rows}</tbody>
    <tfoot><tr><th scope="row">R² (7 facteurs)</th>${Object.keys(PARTIES).map(p => `<td><span class="cmp">${nf(a[p].r2 * 100)} % → ${nf(b[p].r2 * 100)} %</span></td>`).join("")}</tr></tfoot>`;
}

function controls() {
  const ys = $("#demo-y");
  ys.innerHTML = [["2026", "2026"], ["2022", "2022 (estimé)"]].map(([k, v]) => `<button type="button" data-k="${k}" aria-pressed="${k === S.y}">${v}</button>`).join("");
  ys.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; S.y = b.dataset.k; ys.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); draw(); drawMatrix(); });
  const seg = $("#demo-x");
  seg.innerHTML = KEYS.map(k => `<button type="button" data-k="${k}" aria-pressed="${k === S.x}">${esc(IND[k].tab)}</button>`).join("");
  seg.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; S.x = b.dataset.k; seg.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); draw(); });
  const ch = $("#demo-p");
  ch.innerHTML = Object.entries(PARTIES).map(([k, v]) => `<button type="button" class="pchip" data-k="${k}" aria-pressed="${k === S.p}"><span class="chip" style="background:${col(k)}"></span>${esc(v)}</button>`).join("");
  ch.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; S.p = b.dataset.k; ch.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); draw(); });
}

fetch("data/demo.json").then(r => r.json()).then(d => {
  S.d = d; controls(); draw(); drawMatrix(); drawCompare();
  const m = d.meta;
  $("#demo-rob").textContent = `Contrôle : sur les ${m.n_stable} circonscriptions de 2022 presque identiques à celles de 2026 (au moins 90 % de superficie commune dans les deux sens), où l'estimation est quasi exacte, les corrélations de 2022 diffèrent en moyenne de ${nf(m.mean_dr_stable, 2)} (au plus ${nf(m.max_dr_stable, 2)}) de celles calculées sur les 125 circonscriptions.`;
}).catch(err => { $("#demo-read").textContent = "Impossible de charger le profil des circonscriptions."; console.error(err); });
let _rt; addEventListener("resize", () => { clearTimeout(_rt); _rt = setTimeout(() => draw(), 150); });
})();
