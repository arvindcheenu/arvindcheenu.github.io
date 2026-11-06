import fs from "node:fs";
import yaml from "js-yaml";
import markdownIt from "markdown-it";
import { fas } from "@fortawesome/free-solid-svg-icons";
import { fab } from "@fortawesome/free-brands-svg-icons";

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
  // 1-based position of a section in a view's order, 0 when that view hides it.
  eleventyConfig.addFilter("posIn", (order, key) => (order || []).indexOf(key) + 1);
  // "arvind@cheenu.net" → "arvind [at] cheenu.net"
  eleventyConfig.addFilter("newestFirst", newestFirst);
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
    html = html.replace(/<a\b([^>]*\shref="https?:[^"]*"[^>]*)>([\s\S]*?)<\/a>/g, (all, attrs, inner) =>
      /class="[^"]*\b(btn|no-ext)\b/.test(attrs) ? all : `<a${attrs}>${inner}${ext}</a>`);
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
