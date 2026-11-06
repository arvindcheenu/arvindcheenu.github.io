import fs from "node:fs";
import yaml from "js-yaml";
import markdownIt from "markdown-it";

const md = markdownIt({ html: true, typographer: true });
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
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

// Author list with the site owner in bold, equal contribution marked with †, long lists folded.
function authors(list, self, equal = []) {
  const fmt = (n) => {
    const mark = equal.includes(n) ? "†" : "";
    return n === self ? `<b class="self">${esc(n)}${mark}</b>` : `${esc(n)}${mark}`;
  };
  if (!list) return "";
  if (list.length <= 8) return list.map(fmt).join(", ");
  const i = list.indexOf(self);
  const head = list.slice(0, 3).map(fmt);
  const mid = i > 2 ? [`…`, fmt(self)] : [];
  return `${[...head, ...mid].join(", ")}, … <span class="count">${list.length} authors</span>`;
}

function primaryUrl(p) {
  if (p.doi) return `https://doi.org/${p.doi}`;
  const l = p.links || {};
  return l.arxiv || l.pdf || l.web || l.code || l.poster || "";
}

export default function (eleventyConfig) {
  eleventyConfig.addDataExtension("yaml,yml", (contents) => yaml.load(contents));

  eleventyConfig.addFilter("md", (s) => vary(s));
  eleventyConfig.addFilter("mdblock", (s) => vary(s, false));
  eleventyConfig.addFilter("ym", ym);
  eleventyConfig.addFilter("esc", esc);
  eleventyConfig.addFilter("bibtex", bibtex);
  eleventyConfig.addFilter("authors", authors);
  eleventyConfig.addFilter("primaryUrl", primaryUrl);
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
  // Marks publications whose year repeats the one above, separately for each mode,
  // so each year label shows once per group whichever entries are visible.
  eleventyConfig.addFilter("pubRows", (pubs = []) => {
    const label = (p) => (p.status === "under-review" ? "In review" : String(p.year));
    const seen = { research: new Set(), industry: new Set() };
    return pubs.map((p) => {
      const vis = {
        research: p.only ? p.only === "research" : true,
        industry: p.only ? p.only === "industry" : !!p.selected,
      };
      const rep = {};
      for (const m of MODES) {
        rep[m] = vis[m] && seen[m].has(label(p));
        if (vis[m]) seen[m].add(label(p));
      }
      return { p, label: label(p), repR: rep.research, repI: rep.industry };
    });
  });
  // Months between a YYYY-MM value and the build date, for "New" labels.
  eleventyConfig.addFilter("ageMonths", (v) => {
    const m = String(v).match(/^(\d{4})-(\d{1,2})/);
    if (!m) return 99;
    const now = new Date();
    return (now.getFullYear() - +m[1]) * 12 + (now.getMonth() + 1 - +m[2]);
  });
  eleventyConfig.addFilter("host", (u) => String(u).replace(/^mailto:/, "").replace(/^https?:\/\/(www\.)?/, "").replace(/\/$/, ""));
  eleventyConfig.addFilter("json", (v) => JSON.stringify(v));
  eleventyConfig.addFilter("sameAs", (links = []) => JSON.stringify(links.map((l) => l.url).filter((u) => /^https?:/.test(u))));
  eleventyConfig.addFilter("sectionOrder", (order, key) => {
    const i = (order || []).indexOf(key);
    return i < 0 ? 0 : i + 1;
  });
  eleventyConfig.addFilter("year4", (v) => (String(v).match(/\b(19|20)\d{2}\b/) || [""])[0]);
  eleventyConfig.addFilter("noYear", (v) => String(v).replace(/\s*\b(19|20)\d{2}\b\s*/, " ").trim());
  // The form posts only when it has somewhere to go: a Web3Forms key, or another service's URL.
  eleventyConfig.addFilter("formEndpoint", (cf = {}) => {
    if (!cf || !cf.endpoint) return "";
    if (/web3forms/.test(cf.endpoint) && !cf.access_key) return "";
    return cf.endpoint;
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
    "src/favicon.svg": "favicon.svg",
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
