import fs from "node:fs";
import yaml from "js-yaml";
import markdownIt from "markdown-it";
import { fas } from "@fortawesome/free-solid-svg-icons";
import { fab } from "@fortawesome/free-brands-svg-icons";
import { geoMercator, geoPath } from "d3-geo";
import { feature, mesh } from "topojson-client";

const md = markdownIt({ html: true, typographer: true });
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// Icons are Font Awesome Free paths built into the page as one SVG sprite that
// holds only the icons the page uses; each icon is a <use> of its symbol.
const usedIcons = new Map();
const pascal = (n) => "fa" + String(n).split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join("");
function svgIcon(name, brand = false, cls = "") {
  const key = `${brand ? "b" : "s"}-${name}`;
  let def = usedIcons.get(key);
  if (!def) {
    const fa = (brand ? fab : fas)[pascal(name)] || fas[pascal(name)] || fab[pascal(name)];
    if (!fa) throw new Error(`Unknown icon "${name}"`);
    const [w, h, , , d] = fa.icon;
    def = { id: `i-${key}`, w, h, d: Array.isArray(d) ? d : [d] };
    usedIcons.set(key, def);
  }
  return `<svg class="ic${cls ? " " + cls : ""}" viewBox="0 0 ${def.w} ${def.h}" aria-hidden="true" focusable="false"><use href="#${def.id}"/></svg>`;
}
// Pixel size of a local image (WebP, PNG or JPEG), read from its header so the
// gallery can reserve each picture's shape before it loads.
const dimCache = new Map();
function imgDims(src) {
  if (dimCache.has(src)) return dimCache.get(src);
  let out = null;
  try {
    const b = fs.readFileSync(new URL(`./src/${String(src).replace(/^\/+/, "")}`, import.meta.url));
    if (b.toString("ascii", 0, 4) === "RIFF" && b.toString("ascii", 8, 12) === "WEBP") {
      const t = b.toString("ascii", 12, 16);
      if (t === "VP8X") out = [1 + b.readUIntLE(24, 3), 1 + b.readUIntLE(27, 3)];
      else if (t === "VP8 ") out = [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
      else if (t === "VP8L") { const n = b.readUInt32LE(21); out = [(n & 0x3fff) + 1, ((n >> 14) & 0x3fff) + 1]; }
    } else if (b.readUInt32BE(0) === 0x89504e47) out = [b.readUInt32BE(16), b.readUInt32BE(20)];
    else if (b[0] === 0xff && b[1] === 0xd8) {
      for (let i = 2; i < b.length - 9; ) {
        if (b[i] !== 0xff) { i++; continue; }
        const m = b[i + 1];
        if (m >= 0xc0 && m <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(m)) { out = [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]; break; }
        i += 2 + b.readUInt16BE(i + 2);
      }
    }
  } catch (e) { /* missing or unreadable: the gallery falls back to 4:3 */ }
  dimCache.set(src, out);
  return out;
}
const sprite = () =>
  `<svg class="sprite" aria-hidden="true" style="position:absolute;width:0;height:0;overflow:hidden">${[...usedIcons.values()]
    .map((i) => `<symbol id="${i.id}" viewBox="0 0 ${i.w} ${i.h}">${i.d.map((d) => `<path fill="currentColor" d="${d}"/>`).join("")}</symbol>`)
    .join("")}</svg>`;

const slug = (t) => String(t ?? "").toLowerCase().normalize("NFKD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
// The id an entry answers to: its own `id`, award-<ref> for awards, or prefix-<name>.
function entryId(e, prefix) {
  if (!e) return "";
  if (e.id) return e.id;
  if (prefix === "award" && e.ref) return `award-${e.ref}`;
  return `${prefix}-${slug(e.name || e.title || e.role || e.degree || e.venue || "")}`;
}

// ── The travel map: world outlines and routes drawn once, at build time ──────
// Mercator on a 1000-unit-wide plane, the projection map apps use. Trips are drawn
// from the base (home or stay) active at their date; moves go from base to base.
const MAP_W = 1000;
const proj = geoMercator().scale(MAP_W / (2 * Math.PI)).translate([MAP_W / 2, MAP_W / 2]).precision(0.2);
let mapBase = null;
function mapGeometry() {
  if (mapBase) return mapBase;
  const topo = JSON.parse(fs.readFileSync("node_modules/world-atlas/countries-110m.json", "utf8"));
  const land = feature(topo, topo.objects.land);
  land.features = land.features.filter((f) => f.geometry); // keep everything; Antarctica sits off-frame
  const path = geoPath(proj).digits(1);
  mapBase = { land: path(land), borders: path(mesh(topo, topo.objects.countries, (a, b) => a !== b)) };
  return mapBase;
}
const dateNum = (v) => { const m = String(v ?? "").match(/(\d{4})(?:-(\d{1,2}))?(?:-(\d{1,2}))?/); return m ? +m[1] * 10000 + (+m[2] || 1) * 100 + (+m[3] || 1) : 0; };
const isoDay = (v) => (v instanceof Date ? v.toISOString().slice(0, 10) : v);
function travelMap(travel = []) {
  const ev = travel.map((e) => ({ ...e, from: isoDay(e.from), to: isoDay(e.to) })).sort((a, b) => dateNum(a.from) - dateNum(b.from));
  const isBase = (e) => e.kind === "home" || e.kind === "stay";
  const active = (e, d) => isBase(e) && dateNum(e.from) <= d && (e.to === "present" || !e.to || dateNum(e.to) >= d);
  const out = ev.map((e, i) => {
    const [x, y] = proj([e.lon, e.lat]);
    const d = dateNum(e.from);
    let origin = null;
    if (isBase(e)) {
      for (let j = i - 1; j >= 0; j--) if (ev[j].kind === "home") { origin = ev[j]; break; }
    } else {
      const bases = ev.slice(0, i).filter((b) => active(b, d));
      origin = bases.sort((a, b) => (a.kind === "stay") - (b.kind === "stay") || dateNum(a.from) - dateNum(b.from)).pop() || null;
    }
    let arc = "", ox = null, oy = null;
    if (origin) {
      [ox, oy] = proj([origin.lon, origin.lat]);
      const mx = (ox + x) / 2, my = (oy + y) / 2, dx = x - ox, dy = y - oy, len = Math.hypot(dx, dy) || 1;
      const lift = Math.min(len * 0.28, 90);
      const cx = mx + (dy / len) * lift * (dx > 0 ? -1 : 1), cy = my - Math.abs(dx / len) * lift - (dy / len) * 0;
      arc = `M${ox.toFixed(1)} ${oy.toFixed(1)}Q${cx.toFixed(1)} ${cy.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    const when = e.to ? `${ym(e.from)} – ${e.to === "present" ? "now" : ym(e.to)}` : ym(e.from);
    return { ...e, x: +x.toFixed(1), y: +y.toFixed(1), ox, oy, arc, when, base: isBase(e), d, year: String(e.from).slice(0, 4) };
  });
  return { ...mapGeometry(), W: MAP_W, events: out };
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MODES = ["research", "industry"];

// "2026-11" → "Nov 2026", "2026" → "2026"
function ym(v) {
  if (v === undefined || v === null || v === "") return "";
  const s = String(v);
  const m = s.match(/^(\d{4})-(\d{1,2})/);
  return m ? `${MONTHS[+m[2] - 1]} ${m[1]}` : s;
}

// Markdown or a { research, industry } pair → HTML. Pairs become two spans the page toggles.
function vary(v, inline = true) {
  if (v === undefined || v === null || v === "") return "";
  const render = (s) => (inline ? md.renderInline(String(s)) : md.render(String(s)));
  if (typeof v === "object" && !Array.isArray(v) && (v.research || v.industry)) {
    return MODES.filter((m) => v[m]).map((m) => `<span data-only="${m}">${render(v[m])}</span>`).join("");
  }
  return render(v);
}

function lastFirst(name) {
  const parts = String(name).trim().split(/\s+/);
  if (parts.length < 2) return name;
  return `${parts.pop()}, ${parts.join(" ")}`;
}

function bibtex(p, siteName) {
  const kindType = { journal: "article", article: "article", preprint: "misc", thesis: "mastersthesis" };
  const type = kindType[p.kind] || "inproceedings";
  const f = [["author", (p.authors || []).map(lastFirst).join(" and ")], ["title", `{${p.title}}`]];
  const venue = p.venue_long || p.venue;
  if (type === "article") f.push(["journal", venue]);
  else if (type === "inproceedings") f.push(["booktitle", venue]);
  else if (type === "mastersthesis") f.push(["school", String(p.venue || "").replace(/^MS thesis,\s*/i, "")]);
  else if (p.links?.arxiv) {
    f.push(["eprint", p.links.arxiv.replace(/.*\/abs\//, "")], ["archivePrefix", "arXiv"]);
  }
  f.push(["year", p.year], ["volume", p.volume], ["number", p.number], ["pages", p.pages && String(p.pages).replace(/[–-]+/, "--")], ["doi", p.doi]);
  if (!p.doi) f.push(["url", p.links?.arxiv || p.links?.pdf || p.links?.web]);
  const body = f.filter(([, v]) => v).map(([k, v]) => `  ${k} = {${v}}`).join(",\n");
  return `@${type}{${p.id},\n${body}\n}`;
}

// "A, B, and C" with the site owner in bold, as in ACM reference style.
function authorList(list = [], self, equal = []) {
  const fmt = (n) => {
    const mark = equal.includes(n) ? "†" : "";
    return n === self ? `<b class="self">${esc(n)}${mark}</b>` : `${esc(n)}${mark}`;
  };
  const a = list.map(fmt);
  // Very long author lists (consortium papers) show the first three, the
  // owner of the page and the last author, with a button for the rest.
  if (a.length > 12) {
    const me = list.indexOf(self);
    const keep = [...new Set([0, 1, 2, me, a.length - 1].filter((i) => i >= 0))].sort((x, y) => x - y);
    const short = keep.map((i, k) => (k && i - keep[k - 1] > 1 ? `…, ${a[i]}` : a[i])).join(", ");
    const full = `${a.slice(0, -1).join(", ")}, and ${a[a.length - 1]}`;
    return `<span class="au-s">${short}</span><span class="au-f" hidden>${full}</span>`
      + ` <button type="button" class="au-t no-print" data-action="authors" data-n="${a.length}" aria-expanded="false">(show all ${a.length})</button>`
      + `<span class="print-only"> (${a.length} authors)</span>`;
  }
  if (a.length <= 1) return a.join("");
  if (a.length === 2) return `${a[0]} and ${a[1]}`;
  return `${a.slice(0, -1).join(", ")}, and ${a[a.length - 1]}`;
}

// One publication as a citation: authors. year. title. venue details. award. doi.
function cite(p, self, refs) {
  const md1 = (x) => md.renderInline(String(x));
  const url = titleUrl(p);
  const title = url ? `<a class="ct" href="${esc(url)}">${esc(p.title)}</a>` : `<span class="ct">${esc(p.title)}</span>`;
  const venue = esc(p.venue_long || p.venue || "");
  const proc = p.proc ? ` (Proc. ${esc(p.proc)})` : "";
  let where;
  if (p.status === "under-review") where = `Submitted to <i>${venue}</i>.`;
  else if (p.kind === "journal" || p.kind === "article") {
    let vol = p.volume ? ` ${esc(p.volume)}` : "";
    if (p.volume && p.number) vol += `, ${esc(p.number)}`;
    const pages = p.pages ? `${p.volume ? ":" : ","} ${esc(p.pages)}` : "";
    where = `<i>${venue}</i>${proc}${vol}${pages}.`;
  } else if (p.kind === "preprint") where = `<i>${venue}</i>.`;
  else if (p.kind === "thesis") where = `${venue}.`;
  else where = `In <i>${venue}</i>${proc}${p.pages ? `, ${esc(p.pages)}` : ""}.`;
  const status = p.status === "to-appear" ? " To appear." : "";
  const award = p.award ? ` ${awardBadge(p.award, awardHref(p, refs))}` : "";
  let id = "";
  if (p.doi) id = ` <a class="cid" href="https://doi.org/${esc(p.doi)}">doi:${esc(p.doi)}</a>`;
  else if (p.links?.arxiv) id = ` <a class="cid" href="${esc(p.links.arxiv)}">arXiv:${esc(p.links.arxiv.replace(/.*\/abs\//, ""))}</a>`;
  return `${authorList(p.authors, self, p.equal || [])}. ${esc(p.year)}. ${title}. ${where}${status}${award}${id}`;
}

function titleUrl(p) {
  if (p.url) return p.url;
  if (p.doi) return `https://doi.org/${p.doi}`;
  const l = p.links || {};
  return l.arxiv || l.pdf || l.web || l.code || l.poster || "";
}

// The group a publication belongs to: its status first (under review), then its kind.
function groupOf(p, groups) {
  return (
    groups.findIndex((g) => g.status && g.status === p.status) + 1 ||
    groups.findIndex((g) => !g.status && (g.kinds || []).includes(p.kind) && p.status !== "under-review") + 1
  ) - 1;
}

// One row per publication, newest first, with its type label (J3, C2, …) or icon
// and the heading it sits under when listed by year ("Under review", "2026", …).
function pubRows(pubs = [], groups = []) {
  const count = groups.map(() => 0);
  const gi = pubs.map((p) => groupOf(p, groups));
  gi.forEach((g) => { if (g >= 0) count[g]++; });
  const seen = groups.map(() => 0);
  return pubs
    .map((p, i) => {
      const g = gi[i];
      if (g < 0) return null;
      const grp = groups[g];
      seen[g]++;
      return {
        p,
        gi: g,
        group: grp.title,
        label: grp.prefix ? `${grp.prefix}${count[g] - seen[g] + 1}` : "",
        icon: grp.icon || "",
        year: p.status === "under-review" ? grp.title : String(p.year),
      };
    })
    .filter(Boolean)
    .map((r, i, all) => ({ ...r, head: i === 0 || all[i - 1].year !== r.year }));
}

// The publication as industry readers scan it: venue, year and award on one line.
function venueLine(p, refs) {
  const bits = [esc(p.venue || p.venue_long || "")];
  if (p.status === "under-review") bits[0] = `Submitted to ${bits[0]}`;
  else if (!String(p.venue || "").includes(String(p.year))) bits.push(esc(p.year));
  if (p.status === "to-appear") bits.push("To appear");
  if (p.award) bits.push(awardBadge(p.award, awardHref(p, refs)));
  return bits.filter(Boolean).join('<span class="sep">·</span>');
}

function awardBadge(text, href) {
  const inner = `${svgIcon("trophy")}${esc(text)}`;
  return href ? `<a class="award" href="${href}">${inner}</a>` : `<span class="award">${inner}</span>`;
}
const awardHref = (p, refs) => ((refs || []).includes(p.id) ? `#award-${p.id}` : "");

// A sort key from whatever dates an entry carries: "2026-11", "Spring 2025",
// "2024 — 2026", "ACM CHI 2027", end: present. Later is larger.
const MONTH_WORDS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12, winter: 1, spring: 4, summer: 7, autumn: 10, fall: 10 };
function dateKey(e) {
  if (!e || typeof e !== "object") return 0;
  if (e.end === "present") return 999999;
  let best = 0;
  for (const f of ["end", "date", "when", "year", "start", "venue"]) {
    const v = e[f];
    if (v === undefined || v === null || v === "") continue;
    const str = String(v);
    if (/present|now/i.test(str)) return 999999;
    const ym = str.match(/(\d{4})-(\d{1,2})/);
    if (ym) { best = Math.max(best, +ym[1] * 100 + +ym[2]); continue; }
    const years = str.match(/\b(19|20)\d{2}\b/g);
    if (!years) continue;
    const y = Math.max(...years.map(Number));
    const word = (str.toLowerCase().match(/[a-z]+/g) || []).map((w) => MONTH_WORDS[w.slice(0, 3)] || MONTH_WORDS[w]).find(Boolean);
    best = Math.max(best, y * 100 + (word || (years.length > 1 ? 12 : 0)));
  }
  return best;
}
// Newest first; entries with the same date keep their order from site.yaml.
const newestFirst = (list = []) => list.map((e, i) => ({ e, i, k: dateKey(e) })).sort((a, b) => b.k - a.k || a.i - b.i).map((x) => x.e);

// "20,000 DKK", "US$400", "€500" → { v: 20000, c: "DKK" }. Anything else → null.
const SYMBOLS = { "US$": "USD", "$": "USD", "€": "EUR", "£": "GBP", "₹": "INR", "¥": "JPY" };
function money(s) {
  const str = String(s ?? "");
  const num = str.match(/\d[\d,.\s]*/);
  if (!num) return null;
  let c = (str.match(/\b([A-Z]{3})\b/) || [])[1];
  if (!c) for (const [sym, code] of Object.entries(SYMBOLS)) if (str.includes(sym)) { c = code; break; }
  if (!c) return null;
  const v = Number(num[0].replace(/[,\s]/g, ""));
  return Number.isFinite(v) ? { v, c } : null;
}
function fmtMoney(v, c) {
  try { return new Intl.NumberFormat("en-GB", { style: "currency", currency: c, maximumFractionDigits: 0 }).format(v); }
  catch (e) { return `${Math.round(v).toLocaleString("en-GB")} ${c}`; }
}
function convert(m, to, fx) {
  const r = fx?.rates || {};
  const from = m.c === "EUR" ? 1 : r[m.c], dest = to === "EUR" ? 1 : r[to];
  if (!from || !dest) return null;
  return (m.v / from) * dest;
}

export default function (eleventyConfig) {
  eleventyConfig.addDataExtension("yaml,yml", (contents) => yaml.load(contents));

  eleventyConfig.addFilter("md", (s) => vary(s));
  eleventyConfig.addFilter("mdblock", (s) => vary(s, false));
  eleventyConfig.addFilter("ym", ym);
  eleventyConfig.addFilter("esc", esc);
  eleventyConfig.addFilter("bibtex", bibtex);
  eleventyConfig.addFilter("authorList", (list, self, equal) => authorList(list, self, equal || []));
  eleventyConfig.addFilter("titleUrl", titleUrl);
  eleventyConfig.addFilter("cite", cite);
  eleventyConfig.addFilter("pubRows", pubRows);
  // The legend under the Publications heading: one entry per type in use, with
  // its letter (J, C, W, P) or icon, in the order of pub_groups.
  eleventyConfig.addFilter("pubKey", (pubs, groups) => {
    const used = new Set((pubs || []).map((p) => groupOf(p, groups)));
    return groups.map((g, i) => ({ ...g, i })).filter((g) => used.has(g.i))
      .map((g) => ({ prefix: g.prefix || "", icon: g.icon || "", name: g.key || g.title }));
  });
  eleventyConfig.addFilter("venueLine", venueLine);
  eleventyConfig.addFilter("money", money);
  eleventyConfig.addFilter("fmtMoney", fmtMoney);
  eleventyConfig.addFilter("convert", convert);
  // Every section key either view shows, in the default view's order first.
  eleventyConfig.addFilter("sectionKeys", (tailor) => {
    const views = Object.values(tailor?.views || {});
    const keys = [];
    for (const v of views) for (const k of v.order || []) if (!keys.includes(k)) keys.push(k);
    return keys;
  });
  // Sections another view shows that this one leaves out, in page order, skipping
  // any without content.
  eleventyConfig.addFilter("leftOut", (tailor, view, site) => {
    const order = tailor?.views?.[view]?.order || [];
    const all = [];
    for (const v of Object.values(tailor?.views || {})) for (const k of v.order || []) if (!all.includes(k)) all.push(k);
    return all.filter((k) => !order.includes(k) && site?.[k] && (site[k].length || k === "biography"));
  });
  // 1-based position of a section in a view's order, 0 when that view hides it.
  eleventyConfig.addFilter("posIn", (order, key) => (order || []).indexOf(key) + 1);
  // "arvind@cheenu.net" → "arvind [at] cheenu.net"
  eleventyConfig.addFilter("newestFirst", newestFirst);
  eleventyConfig.addFilter("travelMap", travelMap);
  // Each entry with its 1-based position among entries of the same tag (work by default).
  eleventyConfig.addFilter("byTag", (list = []) => {
    const seen = {};
    return list.map((n) => { const tag = n.tag || "work"; seen[tag] = (seen[tag] || 0) + 1; return { n, tag, ti: seen[tag] }; });
  });
  eleventyConfig.addFilter("countTag", (list = [], tag) => list.filter((n) => (n.tag || "work") === tag).length);
  // Selected entries first, then the rest, each group keeping its order.
  eleventyConfig.addFilter("selectedFirst", (list = []) => [...list.filter((e) => e.selected), ...list.filter((e) => !e.selected)]);
  // An update counts as new for two months after its date.
  eleventyConfig.addFilter("imgDims", imgDims);
  eleventyConfig.addFilter("isNew", (v, months = 2) => {
    const m = String(v).match(/^(\d{4})-(\d{1,2})/);
    if (!m) return false;
    const now = new Date();
    return (now.getFullYear() - +m[1]) * 12 + (now.getMonth() + 1 - +m[2]) < months;
  });
  // The acceptance rate for the year a paper appeared at its venue.
  eleventyConfig.addFilter("rateFor", (p, venues) => {
    if (p.rate) return { rate: p.rate, year: "" };
    const v = venues && p.venue_key ? venues[p.venue_key] : null;
    const year = (String(p.proc || p.venue || "").match(/\b(19|20)\d{2}\b/) || [String(p.year)])[0];
    const rate = v && v.rates ? v.rates[year] : "";
    return rate ? { rate, year } : null;
  });
  eleventyConfig.addFilter("svgIcon", svgIcon);
  eleventyConfig.addFilter("entryId", entryId);
  eleventyConfig.addFilter("pluck", (list = [], key) => list.map((e) => e && e[key]).filter(Boolean));
  eleventyConfig.addFilter("ymd", (v) => { const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${+m[3]} ${MONTHS[+m[2] - 1]} ${m[1]}` : String(v); });
  eleventyConfig.addFilter("keys", (o) => Object.keys(o || {}));
  eleventyConfig.addFilter("atSign", (e) => String(e).replace("@", " [at] "));
  eleventyConfig.addFilter("paras", (s) => String(s ?? "").trim().split(/\n\s*\n/).map((x) => x.replace(/\s*\n\s*/g, " ").trim()).filter(Boolean));
  eleventyConfig.addFilter("isOn", (v) => v === true || v === "on" || v === "true" || v === "yes");
  eleventyConfig.addFilter("year", (v) => String(v ?? "").slice(0, 4));
  // Ranges read as years, Swiss-style: "2022 — 2023", "2024 — Now".
  eleventyConfig.addFilter("period", (e) => {
    if (e.duration && !e.start) return e.duration;
    const a = String(e.start ?? "").slice(0, 4);
    const b = e.end === "present" ? "Now" : String(e.end ?? "").slice(0, 4);
    if (a && b && a === b) return a;
    return [a, b].filter(Boolean).join(" — ");
  });
  eleventyConfig.addFilter("host", (u) => String(u).replace(/^mailto:/, "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""));
  eleventyConfig.addFilter("json", (v) => JSON.stringify(v));
  eleventyConfig.addFilter("sameAs", (links = []) => JSON.stringify(links.map((l) => l.url).filter((u) => /^https?:/.test(u))));
  eleventyConfig.addFilter("year4", (v) => (String(v).match(/\b(19|20)\d{2}\b/) || [""])[0]);
  eleventyConfig.addFilter("noYear", (v) => String(v).replace(/\s*\b(19|20)\d{2}\b\s*/, " ").trim());
  eleventyConfig.on("eleventy.before", () => usedIcons.clear());

  // Last pass over the page:
  // 1. every link to the web gets an external-link icon (email links do not);
  // 2. a link to an entry on the page takes the colour of the section it points into;
  // 3. the icon sprite goes in, holding only the icons used.
  eleventyConfig.addTransform("links-and-icons", function (html) {
    if (!String(this.page?.outputPath || "").endsWith(".html")) return html;
    const ext = svgIcon("arrow-up-right-from-square", false, "ext");
    // Keep the icon on the same line as the link's last word, so it never wraps on its own.
    const glue = (inner) => {
      const m = inner.match(/^([\s\S]*?)([^\s<>]+)$/);
      return m && !/<[^>]*$/.test(m[1]) ? `${m[1]}<span class="nw">${m[2]}${ext}</span>` : `${inner}${ext}`;
    };
    html = html.replace(/<a\b([^>]*\shref="https?:[^"]*"[^>]*)>([\s\S]*?)<\/a>/g, (all, attrs, inner) =>
      /class="[^"]*\b(btn|no-ext)\b/.test(attrs) ? all : `<a${attrs}>${glue(inner)}</a>`);
    const colourOf = {};
    for (const m of html.matchAll(/<section\b[^>]*?\sid="([^"]+)"[^>]*?\sdata-c="([^"]+)"[^>]*>([\s\S]*?)<\/section>/g)) {
      const [, sid, c, body] = m;
      colourOf[sid] = c;
      for (const x of body.matchAll(/\sid="([^"]+)"/g)) if (!colourOf[x[1]]) colourOf[x[1]] = c;
    }
    html = html.replace(/<a\b([^>]*?)\shref="#([^"]+)"([^>]*)>/g, (all, pre, id, post) =>
      /\sdata-c=/.test(pre + post) || !colourOf[id] ? all : `<a${pre} href="#${id}"${post} data-c="${colourOf[id]}">`);
    return html.replace("<body>", `<body>\n${sprite()}`);
  });

  eleventyConfig.addShortcode("buildDate", () => {
    const d = new Date();
    return `${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
  });
  eleventyConfig.addShortcode("buildYear", () => String(new Date().getFullYear()));
  // Inline a file from src/_includes so the page ships as one request.
  eleventyConfig.addShortcode("inline", (file) => fs.readFileSync(`src/_includes/${file}`, "utf8"));

  eleventyConfig.addPassthroughCopy({
    "src/assets": "assets",
    "src/favicon.png": "favicon.png",
    "src/apple-touch-icon.png": "apple-touch-icon.png",
    "src/robots.txt": "robots.txt",
    "src/CNAME": "CNAME",
    "src/_redirects": "_redirects",
    "src/accrete": "accrete",
    "src/chimistry": "chimistry",
  });

  // Finished static apps that live under subpaths: copy as-is, never template them.
  eleventyConfig.ignores.add("src/accrete/**");
  eleventyConfig.ignores.add("src/chimistry/**");

  eleventyConfig.addWatchTarget("./src/_includes/");
  eleventyConfig.addWatchTarget("./src/_data/");

  eleventyConfig.setServerOptions({ showAllHosts: true, port: process.env.PORT || 8080 });

  return {
    dir: { input: "src", output: "_site", includes: "_includes", data: "_data" },
    templateFormats: ["njk", "md", "html"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
  };
}
