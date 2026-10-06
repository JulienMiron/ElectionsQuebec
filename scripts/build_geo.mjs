// Simplifie les frontières de chaque carte électorale (une par « ère ») pour le web.
// Entrées : Atlas (TopoJSON projeté EPSG:3347) + GeoJSON 2026 (WGS84).
// Sortie : data/geo/ro<année>.json (TopoJSON, EPSG:3347, id = geo_id).
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";
const require = createRequire(import.meta.url);
const { feature } = require(process.env.TOOLS + "/node_modules/topojson-client");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tmp = process.env.TMPGEO; mkdirSync(tmp, { recursive: true });
const ms = process.env.TOOLS + "/node_modules/.bin/mapshaper";
const PCT = process.env.PCT || "15%";
const EPSG3347 = "+proj=lcc +lat_0=63.390675 +lon_0=-91.8666666666667 +lat_1=49 +lat_2=77 +x_0=6200000 +y_0=3000000 +datum=NAD83 +units=m +no_defs";

const used = new Set(readdirSync(path.join(root, "data/r")).map(f => JSON.parse(readFileSync(path.join(root, "data/r", f))).ro));
const topo = JSON.parse(readFileSync(path.join(root, "sources/atlas-canada-elections/data/geo/QC.overview.topo.json")));
mkdirSync(path.join(root, "data/geo"), { recursive: true });
const run = (inp, out, pre = []) => execFileSync(ms, [inp, ...pre, "-simplify", "visvalingam", PCT, "keep-shapes",
  "-filter-fields", "geo_id", "-o", out, "format=topojson", "quantization=12000", "id-field=geo_id", "force"], { stdio: "pipe" });

for (const ro of [...used].sort()) {
  if (ro === 2026) continue;
  const obj = topo.objects["ro" + ro];
  if (!obj) { console.warn("pas de géométrie ro" + ro); continue; }
  const fc = feature(topo, obj);
  const f = path.join(tmp, `ro${ro}.geojson`);
  writeFileSync(f, JSON.stringify(fc));
  run(f, path.join(root, `data/geo/ro${ro}.json`));
}
// 2026
const g = JSON.parse(readFileSync(path.join(root, "sources/donnees-bleues-elections-qc/data/processed/geography/districts_2026_simplified.geojson")));
g.features.forEach(x => { x.properties = { geo_id: "QC_ro2026_" + x.properties.CO_CEP }; });
const f26 = path.join(tmp, "ro2026.geojson"); writeFileSync(f26, JSON.stringify(g));
run(f26, path.join(root, "data/geo/ro2026.json"), ["-proj", EPSG3347]);
console.log("ok");
