// Citation counts for every publication with a DOI or an arXiv id, from Semantic
// Scholar, fetched on each build. The site rebuilds daily (see the deploy workflow),
// so the counts stay current. If a build has no network, the snapshot below is used.
import fs from "node:fs";
import yaml from "js-yaml";

const SNAPSHOT = {
  date: "2026-11-06",
  counts: { srinivasan2025attention: 18, srinivasan2024improving: 12, ding2023fluid: 56, srinivasan2023analogilead: 0 },
  links: {},
};

const idFor = (p) => {
  if (p.doi) return `DOI:${p.doi}`;
  const arxiv = p.links?.arxiv || p.links?.pdf || "";
  const m = String(arxiv).match(/arxiv\.org\/(?:abs|pdf)\/([0-9.]+)/i);
  return m ? `ARXIV:${m[1]}` : null;
};

export default async function () {
  const site = yaml.load(fs.readFileSync("src/_data/site.yaml", "utf8"));
  const pubs = (site.publications || []).filter((p) => p.status !== "under-review" && idFor(p));
  try {
    const res = await fetch("https://api.semanticscholar.org/graph/v1/paper/batch?fields=citationCount,url", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: pubs.map(idFor) }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error(String(res.status));
    const rows = await res.json();
    const counts = {}, links = {};
    rows.forEach((r, i) => {
      if (!r) return;
      counts[pubs[i].id] = r.citationCount ?? 0;
      if (r.url) links[pubs[i].id] = r.url;
    });
    if (!Object.keys(counts).length) throw new Error("no rows");
    return finish({ date: new Date().toISOString().slice(0, 10), counts, links, source: "live" });
  } catch (e) {
    return finish({ ...SNAPSHOT, source: "snapshot" });
  }
}

function finish(c) {
  c.total = Object.values(c.counts).reduce((a, b) => a + b, 0);
  return c;
}
