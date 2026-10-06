(() => {
"use strict";
const ORDER = ["CON","PLQ","UN","PQ","ADQ","CAQ","QS","PCQ","AUT","IND"];
const col = c => `var(--c-${c})`;
const fmt = new Intl.NumberFormat("fr-CA");
const pct = (x, d = 1) => x.toLocaleString("fr-CA", {minimumFractionDigits: d, maximumFractionDigits: d}) + " %";
const $ = s => document.querySelector(s);
const cache = {};
const J = u => (cache[u] ??= fetch(u).then(r => { if (!r.ok) throw new Error(u); return r.json(); }));
const W = 800, H = 840;

const S = { els: [], parties: {}, lin: {}, i: 0, rid: null, metric: "s", data: null, geo: null, transfers: {}, view: "real", res: null };
const VIEWS = {
  real: {name: "Réel", head: "Sièges", hint: ""},
  pref: {name: "Vote préférentiel", head: "Sièges (préf.)", riding: true,
    hint: "Carte, hémicycle et sièges selon le vote préférentiel par élimination; les pourcentages de votes restent ceux du premier choix."},
  two: {name: "Deux tours", head: "Sièges (2 tours)", riding: true,
    hint: "Second tour entre les deux partis en tête de chaque circonscription; les votes des autres partis suivent la colonne « Vers »."},
  prop: {name: "Proportionnelle", head: "Sièges (prop.)",
    hint: "Sièges répartis entre les partis au prorata des votes valides (méthode d’Hondt); la carte n’a plus d’élu par circonscription."},
  mmp: {name: "Mixte compensatoire", head: "Sièges (mixte)",
    hint: "Élus de circonscription conservés (carte réelle), plus des sièges de liste (45 pour 80, comme le projet de loi 39) qui rapprochent chaque parti de sa part des votes."},
};
const ridingSim = () => !!VIEWS[S.view].riding;
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
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const pname = c => S.parties[c] || c;
const share = (e, c, m) => { const p = e.par[c]; if (!p) return 0; return m === "s" ? p.s / e.seats * 100 : p.v / e.valid * 100; };

/* ---------- frise ---------- */
function buildFrise() {
  const f = $("#frise");
  f.innerHTML = "";
  S.els.forEach((e, i) => {
    const b = document.createElement("button");
    b.className = "fb"; b.type = "button"; b.dataset.i = i;
    const segs = ORDER.filter(c => e.par[c] && e.par[c].s > 0).map(c =>
      `<i style="height:${(e.par[c].s / e.seats * 100).toFixed(2)}%;background:${col(c)}"></i>`).join("");
    b.innerHTML = `<span class="bar">${segs}</span><span class="yr"></span>`;
    const top = ORDER.filter(c => e.par[c]).sort((a, c) => e.par[c].s - e.par[a].s)[0];
    b.setAttribute("aria-label", `${e.y} : ${pname(top)} en tête avec ${e.par[top].s} sièges sur ${e.seats}`);
    b.addEventListener("click", () => select(i));
    b.addEventListener("mousemove", ev => showTip(`<b>${e.y}</b><br>${esc(pname(top))} : ${e.par[top].s} sièges / ${e.seats}`, ev));
    b.addEventListener("mouseleave", hideTip);
    f.appendChild(b);
  });
}
function updateFrise() {
  document.querySelectorAll(".fb").forEach((b, i) => {
    const near = Math.abs(i - S.i);
    b.setAttribute("aria-pressed", i === S.i);
    b.querySelector(".yr").textContent = i === S.i ? S.els[i].y : (near > 2 && i % 4 === 0 ? S.els[i].y : "");
  });
  const sel = document.querySelector('.fb[aria-pressed="true"]');
  sel?.scrollIntoView({inline: "center", block: "nearest", behavior: "smooth"});
}

/* ---------- carte ---------- */
const svg = d3.select("#map").attr("viewBox", `0 0 ${W} ${H}`);
const defs = svg.append("defs");
defs.append("pattern").attr("id", "hatch").attr("width", 6).attr("height", 6).attr("patternUnits", "userSpaceOnUse")
  .attr("patternTransform", "rotate(45)").append("rect").attr("width", 2.4).attr("height", 6).attr("fill", "rgba(255,255,255,.7)");
const gz = svg.append("g");
const gBase = gz.append("g"), gAcc = gz.append("g").style("pointer-events", "none");
let proj, pathGen, zoomB;
const zoom = d3.zoom().scaleExtent([1, 60]).on("zoom", e => gz.attr("transform", e.transform));
svg.call(zoom);
const BOX = { all: null, mtl: [7599733, 1217446, 7640247, 1276362], qc: [7745799, 1421682, 7773359, 1460523] };

async function initProj() {
  const t = await J("data/geo/ro2026.json");
  const f = topojson.feature(t, Object.values(t.objects)[0]);
  proj = d3.geoIdentity().reflectY(true).fitExtent([[8, 8], [W - 8, H - 8]], f);
  pathGen = d3.geoPath(proj);
}
function zoomTo(k) {
  let tr = d3.zoomIdentity;
  if (BOX[k]) {
    const [a, b] = proj([BOX[k][0], BOX[k][1]]), [c, d] = proj([BOX[k][2], BOX[k][3]]);
    const x0 = Math.min(a, c), x1 = Math.max(a, c), y0 = Math.min(b, d), y1 = Math.max(b, d);
    const s = Math.min(W / (x1 - x0), H / (y1 - y0)) * 0.9;
    tr = d3.zoomIdentity.translate(W / 2 - s * (x0 + x1) / 2, H / 2 - s * (y0 + y1) / 2).scale(s);
  }
  svg.transition().duration(500).call(zoom.transform, tr);
}
function outcome(r) {
  if (!r || S.view === "prop") return null;
  if (ridingSim()) { const s = S.res[S.view].by.get(r.id); if (s) return {w: s.w, m: s.m, a: r.a}; }
  return {w: r.w, m: r.m, a: r.a};
}
function riskStyle(o) {
  if (!o || !o.w) return {fill: "var(--none)", op: 1};
  const op = o.a || o.m == null ? 1 : 0.5 + 0.5 * Math.min(o.m, 30) / 30;
  return {fill: col(o.w), op};
}
function paintMap() {
  const e = S.els[S.i];
  gBase.selectAll("path")
    .style("fill", d => riskStyle(outcome(S.byId.get(d.id))).fill)
    .style("fill-opacity", d => riskStyle(outcome(S.byId.get(d.id))).op);
  gAcc.style("display", S.view === "prop" ? "none" : null);
  $("#map-cap").textContent = `Carte électorale de ${e.ro === 2026 ? "2026" : e.ro}` +
    (S.view === "real" ? "" : ` · ${VIEWS[S.view].name.toLowerCase()}`);
}
async function drawMap() {
  const e = S.els[S.i];
  const topo = await J(`data/geo/ro${e.ro}.json`);
  if (S.els[S.i] !== e) return;
  const feats = topojson.feature(topo, Object.values(topo.objects)[0]).features;
  const byId = S.byId;
  const sel = gBase.selectAll("path").data(feats, d => d.id);
  sel.exit().remove();
  const all = sel.enter().append("path").merge(sel);
  all.attr("d", pathGen)
    .attr("class", d => (byId.get(d.id) ? "hasdata hs" : "hs") + (d.id === S.rid ? " sel" : ""))
    .on("mousemove", (ev, d) => { const r = byId.get(d.id); if (r) showTip(ridingTip(r), ev); })
    .on("mouseleave", hideTip)
    .on("click", (ev, d) => { if (byId.get(d.id)) selectRiding(d.id); });
  all.filter(d => d.id === S.rid).raise();
  const acc = feats.filter(d => byId.get(d.id)?.a);
  const a = gAcc.selectAll("path").data(acc, d => d.id);
  a.exit().remove();
  a.enter().append("path").merge(a).attr("d", pathGen).style("fill", "url(#hatch)");
  paintMap();
}
function ridingTip(r) {
  const w = r.c.find(x => x[5]);
  if (!w) return `<b>${esc(r.n)}</b><br>Aucun élu`;
  const extra = r.a ? "Élu par acclamation" : (r.m != null ? `Écart : ${r.m.toLocaleString("fr-CA")} pts` : "");
  const real = `<b>${esc(r.n)}</b><br>${esc(w[0])}<br>${esc(w[2] || pname(w[1]))}<br>${extra}`;
  const s = ridingSim() && !r.a && S.res[S.view].by.get(r.id);
  if (!s) return real;
  const diff = s.w !== r.w ? ` (réel : ${esc(pname(r.w))})` : "";
  return `<b>${esc(r.n)}</b><br>${VIEWS[S.view].name} : ${esc(pname(s.w))}${diff}<br>${s.m != null ? `Écart final : ${s.m.toLocaleString("fr-CA")} pts` : ""}`;
}

/* ---------- hémicycle ---------- */
function seatCounts(e) {
  const v = S.view, R = S.res, head = VIEWS[v].head, name = VIEWS[v].name.toLowerCase();
  if (ridingSim()) return {par: R[v].seats, N: R[v].total, label: `${R[v].total} sièges · ${name}`, head};
  if (v === "prop") return {par: R.prop, N: e.seats, label: `${e.seats} sièges · ${name}`, head};
  if (v === "mmp") return {par: R.mmp.seats, N: R.mmp.total, label: `${R.mmp.total} sièges · mixte`, head,
    detail: c => `${R.mmp.riding[c] || 0} de circonscription + ${R.mmp.list[c] || 0} de liste`};
  const par = {}; ORDER.forEach(c => { if (e.par[c]) par[c] = e.par[c].s; });
  return {par, N: e.seats, label: `${e.seats} sièges`, head};
}
function drawHemi(e) {
  const h = d3.select("#hemi").attr("viewBox", "-4 -18 468 272");
  h.selectAll("*").remove();
  const {par, N, label, detail} = seatCounts(e);
  const R = N <= 70 ? 4 : N <= 100 ? 5 : 6;
  const cx = 230, cy = 238, rin = 100, rout = 214;
  const rows = d3.range(R).map(i => rin + (rout - rin) * i / (R - 1));
  const sumR = d3.sum(rows);
  let counts = rows.map(r => Math.round(N * r / sumR));
  counts[R - 1] += N - d3.sum(counts);
  const dr = (rout - rin) / (R - 1);
  const rad = Math.min(dr * 0.44, ...rows.map((r, i) => r * Math.PI / (counts[i] - 1) * 0.44));
  const seats = [];
  rows.forEach((r, i) => d3.range(counts[i]).forEach(j => {
    const th = Math.PI * (1 - j / (counts[i] - 1));
    seats.push({th, r, x: cx + r * Math.cos(th), y: cy - r * Math.sin(th)});
  }));
  seats.sort((a, b) => b.th - a.th || a.r - b.r);
  const ps = Object.keys(par).filter(c => par[c] > 0).sort((a, b) => par[b] - par[a] || ORDER.indexOf(a) - ORDER.indexOf(b) || a.localeCompare(b));
  const owners = [];
  ps.forEach(c => d3.range(par[c]).forEach(() => owners.push(c)));
  h.selectAll("circle").data(seats).join("circle").attr("class", "hs")
    .attr("cx", d => d.x).attr("cy", d => d.y).attr("r", rad)
    .style("fill", (d, i) => owners[i] ? col(owners[i]) : "var(--none)")
    .on("mousemove", (ev, d) => { const i = seats.indexOf(d), c = owners[i]; if (c) showTip(`<b>${esc(pname(c))}</b><br>${par[c]} sièges${S.view === "real" ? "" : " simulés"}${detail ? "<br>" + detail(c) : ""}`, ev); })
    .on("mouseleave", hideTip);
  h.append("text").attr("x", cx).attr("y", cy - 34).attr("text-anchor", "middle")
    .style("font", "700 34px var(--f-display)").style("fill", "var(--ink)").text(e.y);
  h.append("text").attr("x", cx).attr("y", cy - 10).attr("text-anchor", "middle")
    .style("font", "400 13px var(--f-body)").style("fill", "var(--ink2)").text(label);
  if (N > 2) {
    h.append("line").attr("x1", cx).attr("x2", cx).attr("y1", cy - rout - rad - 4).attr("y2", cy - rin + rad + 4)
      .style("stroke", "var(--ink2)").style("stroke-dasharray", "2 3").style("stroke-width", 1);
    h.append("text").attr("x", cx + 6).attr("y", -6).style("font", "400 10px var(--f-body)").style("fill", "var(--muted)")
      .text(`majorité : ${Math.floor(N / 2) + 1}`);
  }
}

/* ---------- tableau ---------- */
function drawTable(e) {
  const codes = ORDER.filter(c => e.par[c] && (e.par[c].v > 0 || e.par[c].s > 0))
    .sort((a, b) => (a === "IND" || a === "AUT" ? 1 : 0) - (b === "IND" || b === "AUT" ? 1 : 0) || e.par[b].v - e.par[a].v);
  const sc = seatCounts(e);
  const simCodes = comparisonParties(), prefs = transferPrefs(e);
  [...Object.keys(sc.par).filter(c => sc.par[c] > 0), ...simCodes].forEach(c => { if (!codes.includes(c)) codes.push(c); });
  $("#res-seats-h").textContent = sc.head;
  const tb = $("#res tbody");
  tb.innerHTML = codes.map(c => {
    const p = e.par[c] || {v: 0, s: 0}, s = sc.par[c] || 0, vs = p.v / e.valid * 100, ss = s / sc.N * 100;
    let name = esc(pname(c));
    if (c === "AUT" && e.det) {
      name = `<details><summary>${name}</summary><ul class="det">` + Object.entries(e.det).map(([k, v]) =>
        `<li><span>${esc(k)}</span><span>${v.s ? v.s + " siège" + (v.s > 1 ? "s · " : " · ") : ""}${pct(v.v / e.valid * 100)}</span></li>`).join("") + "</ul></details>";
    }
    const to = simCodes.includes(c)
      ? `<select class="to" data-party="${esc(c)}" aria-label="Destination des votes de ${esc(pname(c))} s’il est éliminé">
          <option value="__exhaust__" ${prefs[c] === "__exhaust__" ? "selected" : ""}>Aucun transfert</option>
          ${simCodes.filter(t => t !== c).map(t => `<option value="${esc(t)}" ${prefs[c] === t ? "selected" : ""}>${esc(t)} – ${esc(pname(t))}</option>`).join("")}
        </select>`
      : `<span class="na">—</span>`;
    return `<tr><td><div class="p"><span class="chip" style="background:${col(c)}"></span><div>${name}</div></div></td>
      <td><div class="cell"><div class="tr"><b style="width:${vs}%;background:${col(c)}"></b></div><span>${pct(vs)}</span></div></td>
      <td><div class="cell"><div class="tr"><b style="width:${ss}%;background:${col(c)}"></b></div><span>${s}</span></div></td>
      <td>${to}</td></tr>`;
  }).join("");
  tb.querySelectorAll("select.to").forEach(sel => sel.addEventListener("change", () => {
    prefs[sel.dataset.party] = sel.value;
    computeAll(e);
    renderComparison(e);
    refreshView(e);
  }));
}

/* ---------- comparaison des modes de scrutin ---------- */
function comparisonParties() {
  const codes = new Set();
  S.data.ridings.filter(r => !r.a).forEach(r => r.c.forEach(c => {
    if (c[3] != null) codes.add(c[1]);
  }));
  return [...codes].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b) || a.localeCompare(b));
}
function transferPrefs(e) {
  const prefs = S.transfers[e.y] || (S.transfers[e.y] = {});
  comparisonParties().forEach(code => { prefs[code] ??= "__exhaust__"; });
  return prefs;
}
const byOrder = (a, b) => (ORDER.indexOf(a) < 0 ? Infinity : ORDER.indexOf(a)) - (ORDER.indexOf(b) < 0 ? Infinity : ORDER.indexOf(b)) || a.localeCompare(b);
function partyVotes(r) {
  const v = new Map();
  r.c.forEach(c => { if (c[3] != null) v.set(c[1], (v.get(c[1]) || 0) + c[3]); });
  return v;
}
function computeRiding(e, result) {
  const prefs = transferPrefs(e), by = new Map(), seats = {};
  let total = 0;
  S.data.ridings.forEach(r => {
    const s = result(r, prefs);
    by.set(r.id, s);
    if (s.w) { seats[s.w] = (seats[s.w] || 0) + 1; total++; }
  });
  return {by, seats, total};
}
function dhondt(votes, n) {
  const codes = Object.keys(votes).filter(c => votes[c] > 0), seats = {};
  codes.forEach(c => { seats[c] = 0; });
  for (let k = 0; k < n && codes.length; k++) {
    const best = codes.reduce((a, c) => votes[c] / (seats[c] + 1) > votes[a] / (seats[a] + 1) ? c : a);
    seats[best]++;
  }
  return seats;
}
function listVotes(e) {
  const v = {};
  ORDER.forEach(c => { if (e.par[c] && c !== "AUT" && c !== "IND") v[c] = e.par[c].v; });
  return v;
}
function computeMMP(e) {
  const riding = {};
  ORDER.forEach(c => { if (e.par[c]?.s) riding[c] = e.par[c].s; });
  const L = Math.round(e.seats * 45 / 80);
  const outside = (riding.AUT || 0) + (riding.IND || 0);
  const target = dhondt(listVotes(e), e.seats + L - outside);
  const list = {}, seats = {...riding};
  Object.keys(target).forEach(c => {
    const add = Math.max(0, target[c] - (riding[c] || 0));
    if (add) { list[c] = add; seats[c] = (seats[c] || 0) + add; }
  });
  return {riding, list, seats, L, total: d3.sum(Object.values(seats))};
}
function computeAll(e) {
  S.res = {
    pref: computeRiding(e, runoffResult),
    two: computeRiding(e, twoRoundResult),
    prop: dhondt(listVotes(e), e.seats),
    mmp: computeMMP(e),
  };
}
function refreshView(e) {
  document.querySelectorAll("[data-view]").forEach(b => b.setAttribute("aria-pressed", b.dataset.view === S.view));
  $("#view-hint").textContent = VIEWS[S.view].hint;
  drawHemi(e); drawTable(e); paintMap(); drawRiding();
}
function preferenceChain(origin, prefs) {
  const chain = [origin], seen = new Set(chain);
  let next = prefs[origin];
  while (next && next !== "__exhaust__" && next !== "__unset__" && !seen.has(next)) {
    chain.push(next); seen.add(next);
    next = prefs[next];
  }
  return chain;
}
function runoffResult(r, prefs) {
  if (r.a) return {w: r.w, m: r.m};
  const initial = new Map();
  r.c.forEach(c => {
    if (c[3] == null) return;
    initial.set(c[1], (initial.get(c[1]) || 0) + c[3]);
  });
  const active = new Set(initial.keys());
  if (!active.size) return {w: r.w, m: r.m};
  const cast = d3.sum([...initial.values()]);
  const blocks = [...initial].map(([party, votes]) => ({
    votes, chain: preferenceChain(party, prefs), position: 0
  }));
  let last = null;
  while (active.size > 1) {
    const totals = new Map([...active].map(party => [party, 0]));
    blocks.forEach(block => {
      if (active.has(block.chain[block.position])) {
        totals.set(block.chain[block.position], totals.get(block.chain[block.position]) + block.votes);
      }
    });
    last = totals;
    const eliminated = [...active].sort((a, b) =>
      totals.get(a) - totals.get(b) ||
      (ORDER.indexOf(a) < 0 ? Infinity : ORDER.indexOf(a)) - (ORDER.indexOf(b) < 0 ? Infinity : ORDER.indexOf(b)) ||
      a.localeCompare(b)
    )[0];
    active.delete(eliminated);
    blocks.forEach(block => {
      if (block.chain[block.position] !== eliminated) return;
      block.position++;
      while (block.position < block.chain.length && !active.has(block.chain[block.position])) block.position++;
    });
  }
  const w = active.values().next().value || r.w;
  let m = null;
  if (last && last.size === 2 && cast > 0) {
    const [a, b] = [...last.values()].sort((x, y) => y - x);
    m = Math.round((a - b) / cast * 1000) / 10;
  }
  return {w, m};
}
function twoRoundResult(r, prefs) {
  if (r.a) return {w: r.w, m: r.m};
  const votes = partyVotes(r);
  if (!votes.size) return {w: r.w, m: r.m};
  const cast = d3.sum([...votes.values()]);
  const margin = (a, b) => Math.round((a - b) / cast * 1000) / 10;
  const ranked = [...votes.keys()].sort((a, b) => votes.get(b) - votes.get(a) || byOrder(a, b));
  if (ranked.length < 2) return {w: ranked[0], m: null};
  if (votes.get(ranked[0]) * 2 > cast) return {w: ranked[0], m: margin(votes.get(ranked[0]), votes.get(ranked[1]))};
  const totals = new Map(ranked.slice(0, 2).map(c => [c, 0]));
  votes.forEach((n, party) => {
    const dest = preferenceChain(party, prefs).find(c => totals.has(c));
    if (dest) totals.set(dest, totals.get(dest) + n);
  });
  const [w, l] = [...totals.keys()].sort((a, b) => totals.get(b) - totals.get(a) || byOrder(a, b));
  return {w, m: margin(totals.get(w), totals.get(l))};
}
function renderComparison(e) {
  const R = S.res, comparable = e.seats === e.ridings;
  $("#compare-intro").textContent = `Élection de ${e.y} · Résultat réel à un tour comparé aux quatre modes simulés.`;
  const cols = [["Préférentiel", R.pref.seats, comparable], ["Deux tours", R.two.seats, comparable], ["Proportionnelle", R.prop, true]];
  const rows = [...new Set([...Object.keys(e.par), ...cols.flatMap(c => Object.keys(c[1])), ...Object.keys(R.mmp.seats)])]
    .sort((a, b) => ((e.par[b]?.v || 0) - (e.par[a]?.v || 0)) || byOrder(a, b));
  const delta = (n, actual) => { const d = n - actual; return `<small>(${d > 0 ? "+" : ""}${d})</small>`; };
  const body = rows.map(code => {
    const actual = e.par[code]?.s || 0;
    const cells = cols.map(([, seats, cmp]) => { const n = seats[code] || 0; return `<td>${n} ${cmp ? delta(n, actual) : ""}</td>`; }).join("");
    const mm = R.mmp.seats[code] || 0, li = R.mmp.list[code] || 0;
    return `<tr><td><div class="p"><span class="chip" style="background:${col(code)}"></span>${esc(pname(code))}</div></td>
      <td>${actual}</td>${cells}<td>${mm} ${li ? `<small>dont ${li} de liste</small>` : ""}</td></tr>`;
  }).join("");
  const historicalWinners = S.data.ridings.filter(r => r.a || !r.c.some(c => c[3] != null)).length;
  const caveat = comparable ? "" : ` Les ${e.ridings} circonscriptions ne correspondent pas aux ${e.seats} sièges de cette élection; les écarts du préférentiel et des deux tours ne sont donc pas calculés.`;
  const overhang = R.mmp.total - e.seats - R.mmp.L;
  $("#compare-result").innerHTML = `<table class="compare-table"><thead><tr><th scope="col">Parti</th><th scope="col">Sièges réels</th>${cols.map(c => `<th scope="col">${c[0]}</th>`).join("")}<th scope="col">Mixte</th></tr></thead>
    <tbody>${body}</tbody></table><p class="compare-summary">Préférentiel et deux tours : ${historicalWinners} circonscriptions conservent leur élu historique faute de votes simulables (acclamation ou résultats de candidats indisponibles).${caveat}
    Mixte : ${e.seats} élus de circonscription + ${R.mmp.L} sièges de liste${overhang > 0 ? ` + ${overhang} siège${overhang > 1 ? "s" : ""} excédentaire${overhang > 1 ? "s" : ""}` : ""} = ${R.mmp.total}. Entre parenthèses : écart avec les sièges réels.</p>`;
}

/* ---------- panneau circonscription ---------- */
function drawRiding() {
  const box = $("#riding");
  const r = S.rid && S.byId.get(S.rid);
  if (!r) { box.innerHTML = `<p class="empty">Cliquez sur une circonscription de la carte pour voir ses candidats et son historique.</p>`; return; }
  const e = S.els[S.i];
  const subs = [`${fmt.format(r.e ?? 0)} inscrits`.replace("0 inscrits", "inscrits : n.d.")];
  if (r.a) subs.push("élu par acclamation");
  else if (r.t && r.e) subs.push(`participation ${pct(r.t / r.e * 100)}`);
  if (!r.a && r.m != null) subs.push(`écart ${r.m.toLocaleString("fr-CA")} pts`);
  if (r.q) subs.push("données moins certaines");
  const s = ridingSim() && !r.a && S.res[S.view].by.get(r.id);
  if (s && s.w) subs.push(`${VIEWS[S.view].name.toLowerCase()} : ${pname(s.w)}${s.w !== r.w ? ` (réel : ${pname(r.w)})` : ""}`);
  const cands = r.c.map(c => `<div class="cand"><span class="chip" style="background:${col(c[1])}"></span>
    <div class="nm ${c[5] ? "elu" : ""}">${esc(c[0])}${c[5] ? " ✓" : ""}<small>${esc(c[2] || pname(c[1]))}</small></div>
    <div class="v">${c[3] != null ? fmt.format(c[3]) + "<br>" + pct(c[4]) : "—"}</div></div>`).join("");
  const L = S.lin[r.li];
  const strip = L ? L.h.map(h => {
    const [y, w, m, n, id] = h;
    const el = S.els.find(x => x.y === y);
    const label = `${y} : ${w ? pname(w) : "aucun élu"}${n !== r.n ? ` (« ${n} »)` : ""}`;
    return `<button type="button" data-y="${y}" data-id="${id}" aria-label="${esc(label)}" title="${esc(label)}" ${y === e.y ? 'aria-current="true"' : ""} style="background:${w ? col(w) : "var(--none)"}"></button>`;
  }).join("") : "";
  box.innerHTML = `<h3>${esc(r.n)}</h3><p class="sub">${esc(e.y)} · ${subs.join(" · ")}</p>
    <div class="rgrid"><div>${cands}</div>
    <div><strong>Qui a gagné sous ce nom, élection après élection</strong><div class="strip" id="strip">${strip}</div>
    <p class="hint">Une case par élection où une circonscription portait ce nom; les frontières ont pu changer. Cliquer pour s'y rendre.</p></div></div>`;
  box.querySelectorAll("#strip button").forEach(b => {
    const y = +b.dataset.y;
    b.addEventListener("click", () => select(S.els.findIndex(x => x.y === y), b.dataset.id));
  });
}

/* ---------- navigation ---------- */
async function select(i, rid = null) {
  if (i < 0 || i >= S.els.length) return;
  S.i = i; S.rid = rid;
  const e = S.els[i];
  const d = await J(`data/r/${e.y}.json`);
  if (S.i !== i) return;
  S.data = d; S.byId = new Map(d.ridings.map(r => [r.id, r]));
  computeAll(e);
  updateFrise(); updateHeader(e); renderComparison(e); updateHistSel(); refreshView(e);
  await drawMap();
  history.replaceState(null, "", `#${e.y}${S.rid ? "/" + S.rid : ""}`);
  document.dispatchEvent(new CustomEvent("elec:changed", {detail: e.y}));
}
function selectRiding(id) {
  S.rid = S.rid === id ? null : id;
  gBase.selectAll("path").classed("sel", d => d.id === S.rid).filter(d => d.id === S.rid).raise();
  drawRiding();
  history.replaceState(null, "", `#${S.els[S.i].y}${S.rid ? "/" + S.rid : ""}`);
}
function updateHeader(e) {
  $("#elec-titre").textContent = `Élection générale de ${e.y}` + (e.date ? ` · ${new Date(e.date + "T12:00").toLocaleDateString("fr-CA", {day: "numeric", month: "long", year: "numeric"})}` : "");
  const top = ORDER.filter(c => e.par[c]).sort((a, b) => e.par[b].s - e.par[a].s || e.par[b].v - e.par[a].v)[0];
  const t = e.par[top];
  const maj = t.s > e.seats / 2 ? ", majorité absolue" : "";
  $("#elec-meta").textContent = `${pname(top)} arrive en tête : ${t.s} sièges sur ${e.seats} (${pct(t.v / e.valid * 100)} des votes${maj}). ` +
    `${e.ridings} circonscriptions` + (e.turnout ? ` · participation ${pct(e.turnout)}` : "") + ` · ${fmt.format(e.valid)} votes valides.`;
  const notes = [];
  if (e.provisoire) notes.push("Résultats du 6 octobre 2026 à 15 h 16, tirés du fil d'Élections Québec; ils deviendront officiels après la proclamation des élus.");
  if (e.acc) notes.push(`${e.acc} circonscription${e.acc > 1 ? "s" : ""} remportée${e.acc > 1 ? "s" : ""} par acclamation (hachurées); les pourcentages de votes ne portent que sur les circonscriptions disputées.`);
  if (e.y < 1940) notes.push("Les femmes n'avaient pas encore le droit de vote au Québec (obtenu en 1940).");
  const n = $("#elec-note"); n.hidden = !notes.length; n.textContent = notes.join(" ");
}

/* ---------- historique ---------- */
const HW = 1000, HH = 380, M = {l: 40, r: 8, t: 8, b: 40};
const hsvg = d3.select("#hist").attr("viewBox", `0 0 ${HW} ${HH}`);
function drawHist() {
  hsvg.selectAll("*").remove();
  const m = S.metric;
  const x = d3.scaleBand().domain(S.els.map((e, i) => i)).range([M.l, HW - M.r]).paddingInner(0.12);
  const y = d3.scaleLinear().domain([0, 100]).range([HH - M.b, M.t]);
  [0, 25, 50, 75, 100].forEach(v => {
    hsvg.append("line").attr("x1", M.l).attr("x2", HW - M.r).attr("y1", y(v)).attr("y2", y(v))
      .style("stroke", "var(--line)").style("stroke-dasharray", v === 50 ? "4 4" : null);
    hsvg.append("text").attr("x", M.l - 6).attr("y", y(v) + 4).attr("text-anchor", "end")
      .style("font", "11px var(--f-body)").style("fill", "var(--muted)").text(v + " %");
  });
  const g = hsvg.append("g");
  S.els.forEach((e, i) => {
    let acc = 0;
    ORDER.forEach(c => {
      const v = share(e, c, m); if (v <= 0) return;
      const y1 = y(acc + v), y0 = y(acc);
      g.append("rect").attr("x", x(i)).attr("width", x.bandwidth()).attr("y", y1).attr("height", Math.max(0, y0 - y1 - 1))
        .style("fill", col(c)).attr("rx", 1.5);
      acc += v;
    });
    hsvg.append("text").attr("transform", `translate(${x(i) + x.bandwidth() / 2 + 3},${HH - M.b + 8}) rotate(-90)`)
      .attr("text-anchor", "end").style("font", "10.5px var(--f-body)").style("fill", "var(--muted)").text(e.y);
    hsvg.append("rect").attr("x", x(i) - 1).attr("width", x.bandwidth() + 2).attr("y", M.t).attr("height", HH - M.b - M.t)
      .style("fill", "transparent").style("cursor", "pointer")
      .on("mousemove", ev => showTip(histTip(e), ev)).on("mouseleave", hideTip).on("click", () => select(i));
  });
  hsvg.append("rect").attr("id", "hsel").attr("height", HH - M.b - M.t + 4).attr("y", M.t - 2).attr("rx", 2)
    .style("fill", "none").style("stroke", "var(--sel)").style("stroke-width", 2).style("pointer-events", "none");
  hsvg.node().__x = x;
  updateHistSel();
  $("#hist-sub").textContent = m === "s" ? "Part des sièges de chaque parti à l'Assemblée. La ligne pointillée marque la majorité (50 %)."
    : "Part des votes valides de chaque parti, dans les circonscriptions disputées. Comparez avec la part des sièges.";
}
function histTip(e) {
  const rows = ORDER.filter(c => e.par[c] && (e.par[c].s || e.par[c].v)).sort((a, b) => e.par[b].s - e.par[a].s || e.par[b].v - e.par[a].v)
    .slice(0, 6).map(c => `<span class="chip" style="display:inline-block;background:${col(c)};width:9px;height:9px;border-radius:2px"></span> ${esc(pname(c))} : ${e.par[c].s} s. · ${pct(e.par[c].v / e.valid * 100)}`);
  return `<b>${e.y}</b><br>${rows.join("<br>")}`;
}
function updateHistSel() {
  const x = hsvg.node().__x; if (!x) return;
  d3.select("#hsel").attr("x", x(S.i) - 2).attr("width", x.bandwidth() + 4);
}
function drawLegend() {
  $("#legend").innerHTML = ORDER.map(c => `<span><i class="chip" style="background:${col(c)}"></i>${esc(pname(c))}</span>`).join("");
}

/* ---------- init ---------- */
async function init() {
  const [E, L] = await Promise.all([J("data/elections.json"), J("data/lineages.json"), initProj()]);
  S.els = E.elections; S.parties = E.parties; S.lin = L;
  buildFrise(); drawLegend(); drawHist();
  document.querySelectorAll(".seg button[data-m]").forEach(b => b.addEventListener("click", () => {
    S.metric = b.dataset.m;
    document.querySelectorAll(".seg button[data-m]").forEach(x => x.setAttribute("aria-pressed", x === b));
    drawHist();
  }));
  document.querySelectorAll("[data-view]").forEach(b => b.addEventListener("click", () => {
    S.view = b.dataset.view;
    refreshView(S.els[S.i]);
  }));
  document.querySelectorAll(".zoombtns button").forEach(b => b.addEventListener("click", () => zoomTo(b.dataset.z)));
  $("#theme").addEventListener("click", () => {
    const dark = document.documentElement.dataset.theme === "dark" ||
      (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "light" : "dark";
  });
  document.addEventListener("elec:select", ev => { const k = S.els.findIndex(e => e.y === ev.detail); if (k >= 0) { select(k); $("#elec-titre").scrollIntoView({behavior: "smooth", block: "start"}); } });
  document.addEventListener("keydown", ev => {
    if (ev.target.closest("input,textarea")) return;
    if (ev.key === "ArrowLeft") { ev.preventDefault(); select(S.i - 1); }
    if (ev.key === "ArrowRight") { ev.preventDefault(); select(S.i + 1); }
  });
  const [hy, hid] = location.hash.slice(1).split("/");
  let i = S.els.findIndex(e => String(e.y) === hy);
  select(i >= 0 ? i : S.els.length - 1, i >= 0 ? hid || null : null);
}
init().catch(err => { document.querySelector("main").insertAdjacentHTML("afterbegin", `<p class="note">Impossible de charger les données (${esc(err.message)}). Servez le site avec un serveur HTTP local, par exemple <code>python3 -m http.server</code>.</p>`); console.error(err); });
})();
