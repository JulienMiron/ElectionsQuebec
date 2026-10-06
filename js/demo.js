// Section « Le vote selon le profil des circonscriptions » (données : data/demo2026.json)
(() => {
"use strict";
const $ = s => document.querySelector(s);
const col = c => `var(--c-${c})`;
const nf = (x, d = 0) => x.toLocaleString("fr-CA", {minimumFractionDigits: d, maximumFractionDigits: d});
const sg = (x, d = 2) => (x < 0 ? "−" : x > 0 ? "+" : "") + nf(Math.abs(x), d);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const PARTIES = {PQ: "Parti québécois", PLQ: "Parti libéral du Québec", PCQ: "Parti conservateur du Québec", CAQ: "Coalition avenir Québec", QS: "Québec solidaire"};
const IND = {
  bac:   {tab: "Scolarité", label: "Part des 25–64 ans titulaires d'un baccalauréat ou plus", short: "baccalauréat ou plus", unit: 10, fmtX: v => nf(v) + " %", per: "10 points de diplômés universitaires de plus", ticks: 6},
  inc:   {tab: "Revenu",    label: "Revenu total moyen des personnes de 15 ans et plus (2020)", short: "revenu moyen", unit: 10000, fmtX: v => nf(v / 1000) + " k$", per: "10 000 $ de revenu moyen de plus", ticks: 6},
  age:   {tab: "Âge",       label: "Âge médian de la population", short: "âge médian", unit: 5, fmtX: v => nf(v), per: "5 ans d'âge médian de plus", ticks: 6},
};
const S = {d: null, x: "bac", p: "PQ"};
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

const W = 760, H = 440, M = {l: 52, r: 16, t: 14, b: 48};
const svg = d3.select("#demo-plot").attr("viewBox", `0 0 ${W} ${H}`);

function draw() {
  const D = S.d, X = IND[S.x], R = D.ridings;
  const st = D.stats[S.p], fit = st.fit[S.x], r = st.r[S.x];
  svg.selectAll("*").remove();
  const xs = R.map(o => o[S.x]);
  const x = d3.scaleLinear().domain(d3.extent(xs)).nice().range([M.l, W - M.r]);
  const yMax = Math.ceil(d3.max(R, o => o.sh[S.p] || 0) / 10) * 10;
  const y = d3.scaleLinear().domain([0, Math.max(yMax, 20)]).range([H - M.b, M.t]);
  y.ticks(5).forEach(v => {
    svg.append("line").attr("x1", M.l).attr("x2", W - M.r).attr("y1", y(v)).attr("y2", y(v)).style("stroke", "var(--line)");
    svg.append("text").attr("x", M.l - 8).attr("y", y(v) + 4).attr("text-anchor", "end").style("font", "11px var(--f-body)").style("fill", "var(--muted)").text(v + " %");
  });
  x.ticks(X.ticks).forEach(v => {
    svg.append("text").attr("x", x(v)).attr("y", H - M.b + 18).attr("text-anchor", "middle").style("font", "11px var(--f-body)").style("fill", "var(--muted)").text(X.fmtX(v));
  });
  svg.append("text").attr("x", (M.l + W - M.r) / 2).attr("y", H - 8).attr("text-anchor", "middle").style("font", "12px var(--f-body)").style("fill", "var(--ink2)").text(X.label);
  svg.append("text").attr("transform", `translate(14,${(M.t + H - M.b) / 2}) rotate(-90)`).attr("text-anchor", "middle").style("font", "12px var(--f-body)").style("fill", "var(--ink2)").text(`Vote ${S.p} (% des votes valides)`);
  const [slope, icpt] = fit, [x0, x1] = x.domain();
  const clamp = v => Math.max(y.domain()[0], Math.min(y.domain()[1], v));
  svg.append("line").attr("x1", x(x0)).attr("x2", x(x1)).attr("y1", y(clamp(icpt + slope * x0))).attr("y2", y(clamp(icpt + slope * x1)))
    .style("stroke", col(S.p)).style("stroke-width", 3).style("stroke-linecap", "round").style("opacity", .9);
  svg.append("g").selectAll("circle").data(R).join("circle")
    .attr("cx", o => x(o[S.x])).attr("cy", o => y(o.sh[S.p] || 0)).attr("r", 5)
    .style("fill", o => o.w ? col(o.w) : "var(--none)").style("stroke", "var(--panel)").style("stroke-width", 1.5).style("fill-opacity", .85)
    .on("mousemove", (ev, o) => showTip(`<b>${esc(o.n)}</b><br>Élu : ${esc(PARTIES[o.w] || o.w)}<br>${esc(X.short)} : ${X.fmtX(o[S.x])}<br>Vote ${S.p} : ${nf(o.sh[S.p] || 0, 1)} %`, ev))
    .on("mouseleave", hideTip);
  const per = slope * X.unit;
  const strength = Math.abs(r) >= .6 ? "forte" : Math.abs(r) >= .35 ? "modérée" : "faible";
  $("#demo-read").innerHTML = `<strong>${esc(PARTIES[S.p])} et ${esc(X.short)} :</strong> corrélation ${strength} (r = ${sg(r)}). ` +
    `En moyenne, ${X.per} va de pair avec ${nf(Math.abs(per), 1)} point${Math.abs(per) >= 2 ? "s" : ""} de vote ${per < 0 ? "en moins" : "en plus"} pour ce parti. ` +
    `Ce facteur seul explique ${r * r < 0.01 ? "moins de 1" : nf(r * r * 100)} % des écarts de vote entre circonscriptions.`;
}

function drawMatrix() {
  const D = S.d, keys = ["bac", "inc", "age"];
  const rows = Object.keys(PARTIES).map(p => {
    const cells = keys.map(k => {
      const r = D.stats[p].r[k];
      const w = Math.abs(r) * 50;
      return `<td><div class="rbar" title="r = ${sg(r)}"><span class="rv">${sg(r)}</span><div class="rtr"><b style="${r < 0 ? `right:50%;width:${w}%` : `left:50%;width:${w}%`};background:${col(p)}"></b></div></div></td>`;
    }).join("");
    return `<tr><th scope="row"><span class="chip" style="background:${col(p)}"></span>${esc(PARTIES[p])}</th>${cells}<td class="r2">${nf(D.stats[p].r2 * 100)} %</td></tr>`;
  }).join("");
  $("#demo-matrix").innerHTML = `<caption class="sr">Corrélation entre le vote de chaque parti et le profil des circonscriptions</caption>
    <thead><tr><th scope="col">Parti</th>${keys.map(k => `<th scope="col">${esc(IND[k].tab)}</th>`).join("")}<th scope="col" title="Part des écarts de vote expliquée par les trois facteurs ensemble">Les trois ensemble (R²)</th></tr></thead><tbody>${rows}</tbody>`;
  const beta = Object.keys(PARTIES).map(p => {
    const b = D.stats[p].beta;
    return `<tr><th scope="row"><span class="chip" style="background:${col(p)}"></span>${esc(PARTIES[p])}</th><td>${sg(b.bac, 1)}</td><td>${sg(b.inc, 1)}</td><td>${sg(b.age, 1)}</td></tr>`;
  }).join("");
  $("#demo-beta").innerHTML = `<thead><tr><th scope="col">Parti</th><th scope="col">Scolarité</th><th scope="col">Revenu</th><th scope="col">Âge</th></tr></thead><tbody>${beta}</tbody>`;
}

function controls() {
  const seg = $("#demo-x");
  seg.innerHTML = Object.entries(IND).map(([k, v]) => `<button type="button" data-k="${k}" aria-pressed="${k === S.x}">${esc(v.tab)}</button>`).join("");
  seg.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; S.x = b.dataset.k; seg.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); draw(); });
  const ch = $("#demo-p");
  ch.innerHTML = Object.entries(PARTIES).map(([k, v]) => `<button type="button" class="pchip" data-k="${k}" aria-pressed="${k === S.p}"><span class="chip" style="background:${col(k)}"></span>${esc(v)}</button>`).join("");
  ch.addEventListener("click", e => { const b = e.target.closest("button"); if (!b) return; S.p = b.dataset.k; ch.querySelectorAll("button").forEach(x => x.setAttribute("aria-pressed", x === b)); draw(); });
}

fetch("data/demo2026.json").then(r => r.json()).then(d => { S.d = d; controls(); draw(); drawMatrix(); })
  .catch(err => { $("#demo-read").textContent = "Impossible de charger le profil des circonscriptions."; console.error(err); });
})();
