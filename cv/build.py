#!/usr/bin/env python3
"""Build the research CV and the industry résumé as PDFs with Typst.

Reads src/_data/site.yaml (the same file the site is built from), prepares one
JSON file per view and compiles cv/cv.typ for each:

    python3 cv/build.py            # writes the `pdf` file of each view into _site/
    python3 cv/build.py --out dir  # somewhere else

Needs `pip install typst pyyaml segno`. Text fields keep their inline Markdown
(**bold**, *italic*, [link](url)); it is turned into Typst markup here. Links to
entries on the page ([text](#id)) become plain text, as a PDF has no page to
scroll to.
"""
import argparse, datetime, json, os, re, sys

import segno
import typst
import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
MONTHS = "Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec".split()
FILES = {"research": "CV", "industry": "Resume"}
QR_DIR = os.path.join(HERE, "build", "qr")


def qr(url):
    """Write a QR code for `url` as SVG; return its path relative to cv.typ ('' if no url)."""
    if not url:
        return ""
    os.makedirs(QR_DIR, exist_ok=True)
    name = re.sub(r"[^A-Za-z0-9]+", "-", url).strip("-")[-80:] + ".svg"
    path = os.path.join(QR_DIR, name)
    if not os.path.exists(path):
        segno.make(url, error="m", micro=False).save(path, kind="svg", border=0, dark="#222", xmldecl=False)
    return "build/qr/" + name

# ── Text ────────────────────────────────────────────────────────────────────
SPECIAL = re.compile(r'([\\*_#$\[\]<>@`~/=+"\'-])')


def esc(s):
    """Plain text → Typst markup that prints it as is."""
    return SPECIAL.sub(r"\\\1", str(s))


def tstr(s):
    """A Typst string literal."""
    return '"' + str(s).replace("\\", "\\\\").replace('"', '\\"') + '"'


INLINE = re.compile(r"\[([^\]]+)\]\(([^)\s]+)\)|\*\*(.+?)\*\*|\*(.+?)\*")


def md(s):
    """Inline Markdown → Typst markup."""
    if s is None:
        return ""
    s = str(s).strip()
    out, i = [], 0
    for m in INLINE.finditer(s):
        out.append(esc(s[i:m.start()]))
        text, url, bold, ital = m.groups()
        if text is not None:
            inner = md(text)
            out.append(inner if url.startswith("#") else f"#link({tstr(url)})[{inner}]")
        elif bold is not None:
            out.append(f"#strong[{md(bold)}]")
        else:
            out.append(f"#emph[{md(ital)}]")
        i = m.end()
    out.append(esc(s[i:]))
    return "".join(out)


def view_of(v, view):
    """A field written as { research: …, industry: … } → the one for this view."""
    if isinstance(v, dict) and ("research" in v or "industry" in v):
        return v.get(view)
    return v


def ym(v):
    if v in (None, ""):
        return ""
    s = str(v)
    if s == "present":
        return "present"
    m = re.match(r"^(\d{4})-(\d{1,2})", s)
    return f"{MONTHS[int(m.group(2)) - 1]} {m.group(1)}" if m else s


def span(start, end, months=True):
    f = ym if months else (lambda v: "present" if str(v) == "present" else str(v)[:4])
    a, b = f(start), f(end)
    if not b or a == b:
        return a
    return f"{a} – {b}"


def sort_key(e, *fields):
    """Newest first, as on the page: by the first date-like field found."""
    for f in fields:
        v = e.get(f)
        if v in (None, ""):
            continue
        if str(v) == "present":
            return "9999"
        m = re.search(r"(\d{4})(?:-(\d{2}))?", str(v))
        if m:
            return f"{m.group(1)}-{m.group(2) or '12'}"
    return "0000"


def newest(items, *fields):
    return sorted(items or [], key=lambda e: sort_key(e, *fields), reverse=True)


# ── Publications ─────────────────────────────────────────────────────────────
def authors(names, me, equal):
    def one(n):
        t = esc(n) + ("†" if n in equal else "")
        return f"#strong[{t}]" if n == me else t
    a = [one(n) for n in names or []]
    if len(a) > 12:
        k = sorted({i for i in (0, 1, 2, (names.index(me) if me in names else -1), len(a) - 1) if i >= 0})
        parts = []
        for j, i in enumerate(k):
            parts.append(("…, " if j and i - k[j - 1] > 1 else "") + a[i])
        return ", ".join(parts) + f" ({len(a)} authors)"
    if len(a) <= 1:
        return "".join(a)
    if len(a) == 2:
        return f"{a[0]} and {a[1]}"
    return ", ".join(a[:-1]) + ", and " + a[-1]


def title_url(p):
    if p.get("url"):
        return p["url"]
    if p.get("doi"):
        return "https://doi.org/" + p["doi"]
    l = p.get("links") or {}
    return l.get("arxiv") or l.get("pdf") or l.get("web") or l.get("code") or l.get("poster") or ""


def cite(p, me, venues):
    url = title_url(p)
    title = f"#link({tstr(url)})[{esc(p['title'])}]" if url else esc(p["title"])
    venue = esc(p.get("venue_long") or p.get("venue") or "")
    proc = f" (Proc. {esc(p['proc'])})" if p.get("proc") else ""
    kind, status = p.get("kind"), p.get("status")
    if status == "under-review":
        where = f"Submitted to #emph[{venue}]."
    elif kind in ("journal", "article"):
        vol = f" {esc(p['volume'])}" if p.get("volume") else ""
        if p.get("volume") and p.get("number"):
            vol += f", {esc(p['number'])}"
        pages = f"{':' if p.get('volume') else ','} {esc(p['pages'])}" if p.get("pages") else ""
        where = f"#emph[{venue}]{proc}{vol}{pages}."
    elif kind == "preprint":
        where = f"#emph[{venue}]."
    elif kind == "thesis":
        where = f"{venue}."
    else:
        where = f"In #emph[{venue}]{proc}" + (f", {esc(p['pages'])}" if p.get("pages") else "") + "."
    tail = " To appear." if status == "to-appear" else ""
    if p.get("award"):
        tail += f" #award[{esc(p['award'])}]"
    if p.get("doi"):
        tail += f" #ident(\"https://doi.org/{p['doi']}\")[doi:{esc(p['doi'])}]"
    elif (p.get("links") or {}).get("arxiv"):
        a = p["links"]["arxiv"]
        tail += f" #ident({tstr(a)})[arXiv:{esc(re.sub(r'.*/abs/', '', a))}]"
    v = (venues or {}).get(p.get("venue_key") or "") or {}
    year = (re.search(r"\b(19|20)\d{2}\b", str(p.get("proc") or p.get("venue") or "")) or [str(p.get("year"))])[0]
    rate = p.get("rate") or ((v.get("rates") or {}).get(year) or (v.get("rates") or {}).get(int(year) if year.isdigit() else year))
    if rate:
        tail += f" #rate[{esc(rate)} acc. rate, {year}]"
    return f"{authors(p.get('authors'), me, p.get('equal') or [])}. {esc(p.get('year'))}. {title}. {where}{tail}"


def group_of(p, groups):
    for i, g in enumerate(groups):
        if g.get("status") and g["status"] == p.get("status"):
            return i
    for i, g in enumerate(groups):
        if not g.get("status") and p.get("kind") in (g.get("kinds") or []) and p.get("status") != "under-review":
            return i
    return len(groups) - 1


def publications(site):
    groups = site.get("pub_groups") or []
    by = [[] for _ in groups]
    for p in newest(site.get("publications"), "year"):
        by[group_of(p, groups)].append(p)
    out = []
    for g, ps in zip(groups, by):
        if not ps:
            continue
        pre = g.get("prefix")
        out.append({
            "title": g["title"],
            "items": [{"label": f"{pre}{len(ps) - i}" if pre else "", "text": cite(p, site["name"], site.get("venues")),
                       "qr": qr(title_url(p)), "url": title_url(p)}
                      for i, p in enumerate(ps)],
        })
    return out


# ── Sections ────────────────────────────────────────────────────────────────
def entry(when="", title="", sub="", body="", bullets=None, meta=""):
    return {"when": when, "title": title, "sub": sub, "body": body, "bullets": bullets or [], "meta": meta}


def dot(*parts):
    return " · ".join(p for p in parts if p)


def section(key, site, view):
    if key == "education":
        return [entry(span(e.get("start"), e.get("end"), False), esc(e["degree"]), dot(md(e.get("org")), esc(e.get("place", ""))), md(e.get("detail")))
                for e in newest(site.get("education"), "end", "start")]
    if key == "experience":
        res = []
        for e in newest(site.get("experience"), "end", "start"):
            if view == "industry" and e.get("highlights"):
                res.append(entry(span(e.get("start"), e.get("end")), esc(e["role"]), dot(md(e.get("org")), esc(e.get("place", ""))),
                                 bullets=[md(h) for h in e["highlights"]], meta=dot(*[esc(t) for t in e.get("tags") or []])))
            else:
                res.append(entry(span(e.get("start"), e.get("end")), esc(e["role"]), dot(md(e.get("org")), esc(e.get("place", ""))), md(e.get("summary"))))
        return res
    if key == "awards":
        return [entry(esc(a.get("year", "")), esc(a["title"]), md(a.get("by")),
                      (("For #emph[" + md(a["for"]) + "].") if a.get("ref") else ("For " + md(a["for"]) + ".")) if a.get("for") else md(a.get("detail")))
                for a in newest(site.get("awards"), "year")]
    if key == "grants":
        return [entry(esc(g.get("year", "")), esc(g["title"]), dot(esc(g.get("amount", "")), md(g.get("by"))), md(g.get("for")))
                for g in newest(site.get("grants"), "year")]
    if key == "talks":
        return [entry(ym(t.get("date")), esc(t["title"]), md(t.get("event"))) for t in newest(site.get("talks"), "date")]
    if key == "teaching":
        return [entry(esc(t.get("when", "")), esc(t["role"]), dot(md(t.get("org")), ("Course led by " + md(t["lead"])) if t.get("lead") else ""), md(t.get("detail")))
                for t in newest(site.get("teaching"), "when")]
    if key == "service":
        res = []
        for r in newest(site.get("service"), "venue"):
            year = (re.search(r"\b(19|20)\d{2}\b", str(r["venue"])) or [""])[0]
            venue = re.sub(r"\s*\b(19|20)\d{2}\b\s*", " ", str(r["venue"])).strip()
            n = r.get("reviews")
            res.append(entry(year, f"Reviewer, {esc(venue)}, {esc(r.get('track', ''))}",
                             dot(f"{n} review{'s' if n != 1 else ''}" if n else "", f"#award[{esc(r['note'])}]" if r.get("note") else "")))
        return res
    if key == "projects":
        res = []
        for p in [p for p in site.get("projects") or [] if p.get("selected")]:
            l = p.get("links") or {}
            url = l.get("web") or l.get("code") or ""
            name = f"#link({tstr(url)})[{esc(p['name'])}]" if url else esc(p["name"])
            if p.get("wip"):
                name += " #wip[work in progress]"
            res.append(entry(esc(str(p.get("kind", "")).capitalize()), name, "", md(p.get("summary")),
                             meta=dot(*[esc(t) for t in p.get("tech") or []], *( [f"#tint({tstr(l['code'])})[code]"] if l.get("code") else []))))
        return res
    if key == "skills":
        return [{"group": esc(g["group"]), "items": ", ".join(esc(i) for i in g.get("items") or [])} for g in site.get("skills") or []]
    if key == "certifications":
        return [entry(esc(c.get("year", "")), (f"#link({tstr(c['url'])})[{esc(c['title'])}]" if c.get("url") else esc(c["title"])), md(c.get("by")), md(c.get("detail")))
                for c in newest([c for c in site.get("certifications") or [] if c.get("selected")], "year")]
    return []


def prepare(site, view):
    v = site["tailor"]["views"][view]
    keys = [k for k in (v.get("print_order") or v.get("order") or []) if k not in ("news", "biography", "contact")]
    secs = []
    for k in keys:
        meta = (site.get("sections") or {}).get(k) or {}
        body = publications(site) if k == "publications" else section(k, site, view)
        if body:
            secs.append({"key": k, "title": esc(meta.get("print_title") or meta.get("title") or k.title()), "color": meta.get("color", "blue"), "body": body})
    bio = view_of(((site.get("biography") or {}).get(view) or {}).get("short", {}), view) or {}
    links = [{"label": esc(site["email"]), "url": "mailto:" + site["email"]}]
    if site.get("work_email"):
        links.append({"label": esc(site["work_email"]), "url": "mailto:" + site["work_email"]})
    links.append({"label": esc(re.sub(r"^https?://", "", site["url"])), "url": site["url"]})
    links += [{"label": esc(l["label"]), "url": l["url"]} for l in site.get("links") or []]
    return {
        "view": view,
        "doc": v.get("cv", "CV"),
        "name": esc(site["name"]),
        "plain_name": site["name"],
        "role": esc(site.get("role", "")),
        "affiliation": esc(site.get("affiliation", "")),
        "location": esc(site.get("location", "")),
        "status": esc(v.get("status", "")),
        "summary": md(" ".join(str(bio.get("first", "")).split())),
        "links": links,
        "site_qr": qr(site["url"]),
        "site_url": site["url"],
        "updated": datetime.date.today().strftime("%B %Y"),
        "sections": secs,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=os.path.join(ROOT, "_site"))
    ap.add_argument("--data", default=os.path.join(ROOT, "src", "_data", "site.yaml"))
    args = ap.parse_args()
    with open(args.data, encoding="utf-8") as f:
        site = yaml.safe_load(f)
    os.makedirs(args.out, exist_ok=True)
    build = os.path.join(HERE, "build")
    os.makedirs(build, exist_ok=True)
    first = re.sub(r"\s+", "-", site["name"].strip())
    for view, suffix in FILES.items():
        pdf = site["tailor"]["views"][view].get("pdf") or f"{first}-{suffix}.pdf"
        with open(os.path.join(build, f"{view}.json"), "w", encoding="utf-8") as f:
            json.dump(prepare(site, view), f, ensure_ascii=False, indent=1)
        out = os.path.join(args.out, pdf)
        typst.compile(os.path.join(HERE, "cv.typ"), output=out, root=ROOT,
                      font_paths=[os.path.join(HERE, "fonts")], ignore_system_fonts=True, sys_inputs={"view": view})
        print("wrote", os.path.relpath(out, ROOT))


if __name__ == "__main__":
    sys.exit(main())
