// Research CV and industry résumé, built from src/_data/site.yaml by cv/build.py.
// The view comes in as `--input view=research|industry`; the data as cv/build/<view>.json.
//
// Plain on purpose. Spacing follows three steps:
//   tight  – lines within one entry
//   entry  – between entries
//   section – before a section heading

#let view = sys.inputs.at("view", default: "research")
#let d = json("build/" + view + ".json")

#let ink = luma(20)
#let grey = luma(105)
#let hair = luma(200)
#let linkc = rgb("#1d4ed8") // links are the one colour on the page, so they read as clickable
#let tight = 0.55em
#let entry = 1.35em
#let section = 2.2em

// Helpers the prepared text calls; all plain.
#let award(body) = body
#let tint(url, body) = link(url, body)
#let ident(url, body) = link(url, body)
#show link: set text(fill: linkc)
#let rate(body) = [[#body]]
#let wip(body) = text(fill: grey)[(#body)]
#let rich(s) = eval(s, mode: "markup", scope: (award: award, ident: ident, tint: tint, rate: rate, wip: wip))

#set document(title: d.plain_name + " – " + d.doc, author: d.plain_name)
#set page(
  paper: "a4",
  margin: (x: 22mm, top: 20mm, bottom: 22mm),
  footer: context {
    set text(size: 7.5pt, fill: grey)
    rich(d.name) + [ · ] + d.doc
    h(1fr)
    counter(page).display() + [ of ] + str(counter(page).final().first())
  },
)
#set text(font: "Inter", size: 9pt, fill: ink, lang: "en", hyphenate: false)
#set par(justify: false, leading: 0.72em, spacing: tight)
#set list(indent: 0em, body-indent: 0.55em, spacing: tight, marker: text(fill: grey)[–])
#set strong(delta: 100) // regular 400 + 100 = Medium: firm, not heavy

// ── Header ─────────────────────────────────────────────────────────────────
#grid(columns: (1fr, auto), column-gutter: 6mm, align: (left + bottom, right + bottom),
  [
    #block(below: 0.9em, text(size: 20pt, weight: 500, tracking: -0.01em)[#rich(d.name)])
    #block(below: 0.45em, text(size: 10pt)[#rich(d.role) \ #rich(d.affiliation) · #rich(d.location)])
    #block(below: 0em, text(fill: grey)[
      #d.links.map(l => link(l.url)[#rich(l.label)]).join(" · ")
    ])
  ],
  if d.site_qr != "" {
    link(d.site_url, box(width: 17mm, image(d.site_qr, width: 17mm)))
  },
)
#if d.summary != "" {
  block(above: entry + 0.2em, below: 0em, par(leading: 0.62em, rich(d.summary)))
}
#if d.status != "" {
  block(above: 0.55em, below: 0em, text(fill: grey)[#rich(d.status)])
}

// ── Building blocks ────────────────────────────────────────────────────────
#let heading-for(s) = block(above: section, below: entry, sticky: true, {
  text(size: 8.2pt, weight: 500, tracking: 0.1em)[#upper(rich(s.title))]
  v(0.35em, weak: false)
  line(length: 100%, stroke: 0.5pt + hair)
})

// Title on the left, date on the right; everything else below it.
#let show-entry(e) = block(breakable: false, above: 0em, below: entry, {
  grid(columns: (1fr, auto), column-gutter: 1.2em,
    if e.title != "" { strong(rich(e.title)) },
    text(fill: grey)[#rich(e.when)])
  if e.sub != "" { block(above: tight, below: 0em, text(fill: grey)[#rich(e.sub)]) }
  if e.body != "" { block(above: tight + 0.2em, below: 0em, rich(e.body)) }
  if e.bullets.len() > 0 { block(above: tight + 0.15em, below: 0em, list(..e.bullets.map(b => rich(b)))) }
  if e.meta != "" { block(above: tight + 0.15em, below: 0em, text(size: 8.4pt, fill: grey)[#rich(e.meta)]) }
})

// Publications hang from a short label column (J3, C2 …).
#let show-pubs(groups) = for (i, g) in groups.enumerate() {
  block(above: if i == 0 { 0em } else { entry + 0.2em }, below: 0.6em, sticky: true,
    text(fill: grey)[#emph(rich(g.title))])
  // Each paper gets a small QR code to its page, for reading the printed CV with a phone.
  grid(columns: (8mm, 1fr, 12mm), column-gutter: (0mm, 5mm), row-gutter: 1em,
    ..g.items.map(it => (
      text(fill: grey)[#it.label],
      rich(it.text),
      if it.qr != "" { link(it.url, image(it.qr, width: 12mm)) },
    )).flatten())
}

#let show-skills(groups) = grid(columns: (32mm, 1fr), row-gutter: 0.75em,
  ..groups.map(g => (text(fill: grey)[#rich(g.group)], rich(g.items))).flatten())

// ── Sections ───────────────────────────────────────────────────────────────
#for s in d.sections {
  heading-for(s)
  if s.key == "publications" { show-pubs(s.body) }
  else if s.key == "skills" { show-skills(s.body) }
  else { for e in s.body { show-entry(e) } }
}
