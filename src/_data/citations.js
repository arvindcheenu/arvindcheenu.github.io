// Citation counts from the Google Scholar profile linked in site.yaml, read on each
// build (Scholar's robots.txt allows profile pages). The site rebuilds daily, see the
// deploy workflow. Scholar sometimes refuses automated requests; then the snapshot
// below is used, so update it by hand now and then. Counts of zero are not shown.
import fs from "node:fs";
import yaml from "js-yaml";

const SNAPSHOT = {
  date: "2026-11-06",
  total: 133, h: 5, i10: 4,
  counts: {
    ding2023fluid: 81, srinivasan2025attention: 18, srinivasan2024improving: 13, elmqvist2025participatory: 11,
    srinivasan2020ensemble: 5, srinivasan2026heedvision: 3, srinivasan2026band: 1, hubenschmid2026ambient: 1,
  },
  links: {
    ding2023fluid: "https://scholar.google.com/scholar?oi=bibs&hl=en&cites=7167579942400423991",
    srinivasan2025attention: "https://scholar.google.com/scholar?oi=bibs&hl=en&cites=13202793385355911281",
    srinivasan2024improving: "https://scholar.google.com/scholar?oi=bibs&hl=en&cites=4744498088549403081",
    elmqvist2025participatory: "https://scholar.google.com/scholar?oi=bibs&hl=en&cites=5774268713565312186",
    srinivasan2020ensemble: "https://scholar.google.com/scholar?oi=bibs&hl=en&cites=16768110163566699954",
    srinivasan2026heedvision: "https://scholar.google.com/scholar?oi=bibs&hl=en&cites=9741986799615555179",
    srinivasan2026band: "https://scholar.google.com/scholar?oi=bibs&hl=en&cites=12272752993248396204",
    hubenschmid2026ambient: "https://scholar.google.com/scholar?oi=bibs&hl=en&cites=11839209925713061739",
  },
};

const norm = (t) => String(t || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();
const decode = (s) => s.replace(/&amp;/g, "&").replace(/&#39;|&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">");

export default async function () {
  const site = yaml.load(fs.readFileSync("src/_data/site.yaml", "utf8"));
  const scholar = (site.links || []).find((l) => /scholar\.google/.test(l.url));
  const user = scholar && (scholar.url.match(/user=([\w-]+)/) || [])[1];
  if (!user) return { ...SNAPSHOT, source: "snapshot" };
  try {
    const res = await fetch(`https://scholar.google.com/citations?user=${user}&hl=en&pagesize=100`, {
      headers: { "User-Agent": "Mozilla/5.0 (compatible; arvindchee.nu site build)", "Accept-Language": "en" },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) throw new Error(String(res.status));
    const html = await res.text();
    const rows = [...html.matchAll(/<tr class="gsc_a_tr">([\s\S]*?)<\/tr>/g)].map((m) => {
      const title = decode((m[1].match(/class="gsc_a_at"[^>]*>([^<]*)</) || [])[1] || "");
      const cite = m[1].match(/<a href="([^"]*)" class="gsc_a_ac[^"]*">(\d*)</);
      return { title: norm(title), n: cite && cite[2] ? +cite[2] : 0, href: cite && cite[1] ? decode(cite[1]) : "" };
    });
    if (!rows.length) throw new Error("no rows");
    const counts = {}, links = {};
    for (const p of site.publications || []) {
      const t = norm(p.title);
      const row = rows.find((r) => r.title === t) || rows.find((r) => r.title && (t.startsWith(r.title) || r.title.startsWith(t)));
      if (row && row.n) { counts[p.id] = row.n; if (row.href) links[p.id] = row.href.startsWith("http") ? row.href : `https://scholar.google.com${row.href}`; }
    }
    const stats = [...html.matchAll(/<td class="gsc_rsb_std">(\d+)<\/td>/g)].map((m) => +m[1]);
    return { date: new Date().toISOString().slice(0, 10), total: stats[0] ?? Object.values(counts).reduce((a, b) => a + b, 0), h: stats[2], i10: stats[4], counts, links, source: "live", profile: scholar.url };
  } catch (e) {
    return { ...SNAPSHOT, source: "snapshot", profile: scholar.url };
  }
}
