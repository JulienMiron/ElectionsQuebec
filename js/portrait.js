// Section « Compétition, participation et disproportion » : trois graphiques sur les 44 élections.
(() => {
"use strict";
const $ = s => document.querySelector(s);
const nf = (x, d = 1) => x.toLocaleString("fr-CA", {minimumFractionDigits: d, maximumFractionDigits: d});
const W = 1000, M = {l: 44, r: 8, t: 10, b: 40};
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
let E = [], X, sel = null;
const marks = [];

function frame(id, H, yDomain, yTicks, fmtY) {
  const svg = d3.select(id).attr("viewBox", `0 0 ${W} ${H}`);
  svg.selectAll("*").remove();
  const y = d3.scaleLinear().domain(yDomain).range([H - M.b, M.t]);
  yTicks.forEach(v => {
    svg.append("line").attr("x1", M.l).attr("x2", W - M.r).attr("y1", y(v)).attr("y2", y(v)).style("stroke", "var(--line)");
    svg.append("text").attr("x", M.l - 8).attr("y", y(v) + 4).attr("text-anchor", "end").style("font", "11px var(--f-body)").style("fill", "var(--muted)").text(fmtY(v));
  });
  E.forEach((e, i) => svg.append("text").attr("transform", `translate(${X(i) + X.bandwidth() / 2 + 3},${H - M.b + 8}) rotate(-90)`)
    .attr("text-anchor", "end").style("font", "10.5px var(--f-body)").style("fill", "var(--muted)").text(e.y));
  const m = svg.append("rect").attr("y", M.t - 2).attr("height", H - M.b - M.t + 4).attr("rx", 2).attr("width", X.bandwidth() + 4)
    .style("fill", "none").style("stroke", "var(--sel)").style("stroke-width", 2).style("pointer-events", "none").style("display", "none");
  marks.push({m, svg});
  return {svg, y, H};
}
function hit(f, tipFn) {
  E.forEach((e, i) => f.svg.append("rect").attr("x", X(i) - 1).attr("width", X.bandwidth() + 2).attr("y", M.t).attr("height", f.H - M.b - M.t)
    .style("fill", "transparent").style("cursor", "pointer")
    .on("mousemove", ev => showTip(tipFn(e), ev)).on("mouseleave", hideTip)
    .on("click", () => document.dispatchEvent(new CustomEvent("elec:select", {detail: e.y}))));
}
function highlight() {
  const i = E.findIndex(e => e.y === sel);
  marks.forEach(({m}) => i < 0 ? m.style("display", "none") : m.style("display", null).attr("x", X(i) - 2));
}

function drawComp() {
  const f = frame("#pt-comp", 260, [0, 100], [0, 25, 50, 75, 100], v => v + " %");
  const seg = [["lt5", "seq-1"], ["lt15", "seq-2"], ["ge15", "seq-3"]];
  E.forEach((e, i) => {
    if (!e.comp) return;
    let acc = 0;
    seg.forEach(([k, c]) => {
      const v = e.comp[k] / e.comp.n * 100, y1 = f.y(acc + v), y0 = f.y(acc);
      f.svg.append("rect").attr("x", X(i)).attr("width", X.bandwidth()).attr("y", y1).attr("height", Math.max(0, y0 - y1 - 1)).style("fill", `var(--${c})`).attr("rx", 1.5);
      acc += v;
    });
  });
  hit(f, e => e.comp ? `<b>${e.y}</b><br>${e.comp.lt5} course${e.comp.lt5 > 1 ? "s" : ""} serrée${e.comp.lt5 > 1 ? "s" : ""} (moins de 5 pts)<br>${e.comp.lt15} entre 5 et 15 pts<br>${e.comp.ge15} de 15 pts et plus<br>Écart moyen : ${nf(e.comp.mean)} pts · médian : ${nf(e.comp.med)} pts<br>${e.acc ? e.acc + " acclamation" + (e.acc > 1 ? "s" : "") + " (exclues)" : ""}` : `<b>${e.y}</b>`);
}
function drawPart() {
  const f = frame("#pt-part", 260, [40, 100], [40, 50, 60, 70, 80, 90, 100], v => v + " %");
  const line = d3.line().x((e, i) => X(i) + X.bandwidth() / 2).y(e => f.y(e.turnout)).defined(e => e.turnout);
  const post = E.map((e, i) => ({e, i})).filter(o => o.e.y >= 1944);
  const pre = E.map((e, i) => ({e, i})).filter(o => o.e.y < 1944);
  const lg = (arr, dash) => f.svg.append("path").attr("d", d3.line().x(o => X(o.i) + X.bandwidth() / 2).y(o => f.y(o.e.turnout))(arr))
    .style("fill", "none").style("stroke", "var(--ink)").style("stroke-width", 2).style("stroke-dasharray", dash);
  lg(pre, "3 4"); lg(post, null);
  const x1940 = (X(E.findIndex(e => e.y === 1939)) + X(E.findIndex(e => e.y === 1944)) + X.bandwidth()) / 2;
  f.svg.append("line").attr("x1", x1940).attr("x2", x1940).attr("y1", M.t).attr("y2", f.H - M.b).style("stroke", "var(--muted)").style("stroke-dasharray", "2 3");
  f.svg.append("text").attr("x", x1940 + 6).attr("y", M.t + 12).style("font", "11px var(--f-body)").style("fill", "var(--ink2)").text("1940 : droit de vote des femmes");
  E.forEach((e, i) => f.svg.append("circle").attr("cx", X(i) + X.bandwidth() / 2).attr("cy", f.y(e.turnout)).attr("r", e.y === 2026 ? 5 : 3.5)
    .style("fill", e.y < 1944 ? "var(--panel)" : "var(--ink)").style("stroke", "var(--ink)").style("stroke-width", 1.8));
  hit(f, e => `<b>${e.y}</b><br>Participation : ${nf(e.turnout)} %<br>${e.y < 1944 ? "Droit de vote restreint; " + (e.acc ? e.acc + " acclamations" : "") : ""}`);
}
function drawGal() {
  const mx = Math.ceil(d3.max(E, e => e.gal) / 10) * 10;
  const f = frame("#pt-gal", 260, [0, mx], d3.range(0, mx + 1, 10), v => v);
  E.forEach((e, i) => f.svg.append("rect").attr("x", X(i)).attr("width", X.bandwidth()).attr("y", f.y(e.gal)).attr("height", f.y(0) - f.y(e.gal)).attr("rx", 1.5).style("fill", "var(--ink)"));
  hit(f, e => {
    const top = Object.entries(e.par).sort((a, b) => b[1].s - a[1].s)[0];
    return `<b>${e.y}</b><br>Indice de Gallagher : ${nf(e.gal)}<br>Le parti en tête (${top[0]}) : ${nf(top[1].v / e.valid * 100)} % des votes, ${nf(top[1].s / e.seats * 100)} % des sièges`;
  });
}
function draw() {
  marks.length = 0;
  drawComp(); drawPart(); drawGal(); highlight();
}
fetch("data/elections.json").then(r => r.json()).then(d => {
  E = d.elections.filter(e => e.gal != null);
  X = d3.scaleBand().domain(E.map((e, i) => i)).range([M.l, W - M.r]).paddingInner(0.12);
  draw();
  document.addEventListener("elec:changed", ev => { sel = ev.detail; highlight(); });
  const m = location.hash.match(/^#(\d{4})/); if (m) { sel = +m[1]; highlight(); }
}).catch(err => console.error(err));
})();
