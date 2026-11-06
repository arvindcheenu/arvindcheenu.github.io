// Research CV and industry résumé, built from src/_data/site.yaml by cv/build.py.
// The view comes in as `--input view=research|industry`; the data as cv/build/<view>.json.
// Plain on purpose: one text size, one line spacing, one gap between entries.

#let view = sys.inputs.at("view", default: "research")
#let d = json("build/" + view + ".json")

#let grey = luma(90)
#let gap = 0.9em // between entries, and between a heading and its first entry

// Helpers the prepared text calls; all plain.
#let award(body) = body
#let tint(url, body) = link(url, body)
#let ident(url, body) = link(url, body)
#let rate(body) = [[#body]]
#let wip(body) = text(fill: grey)[(#body)]
#let rich(s) = eval(s, mode: "markup", scope: (award: award, ident: ident, tint: tint, rate: rate, wip: wip))

#set document(title: d.plain_name + " – " + d.doc, author: d.plain_name)
#set page(
  paper: "a4",
  margin: (x: 18mm, y: 18mm),
  footer: context text(fill: grey)[
    #rich(d.name) · #d.doc #h(1fr) #counter(page).display() / #counter(page).final().first()
  ],
)
#set text(font: "Inter", size: 9pt, lang: "en", hyphenate: false)
#set par(justify: false, leading: 0.6em, spacing: 0.6em)
#set list(indent: 0em, body-indent: 0.5em, spacing: 0.6em, marker: [–])
#show strong: set text(weight: 600)

// ── Header ─────────────────────────────────────────────────────────────────
#text(size: 16pt, weight: 600)[#rich(d.name)]

#rich(d.role), #rich(d.affiliation), #rich(d.location)

#d.links.map(l => link(l.url)[#rich(l.label)]).join(" · ")

#if d.summary != "" [
  #v(gap - 0.6em)
  #rich(d.summary)
]
#if d.status != "" { parbreak(); rich(d.status) }

// ── Building blocks ────────────────────────────────────────────────────────
#let heading-for(s) = block(above: 1.6em, below: gap, sticky: true,
  text(weight: 600)[#upper(rich(s.title))])

#let when-col = 33mm
#let row(when, body) = block(breakable: false, above: 0em, below: gap,
  grid(columns: (when-col, 1fr), column-gutter: 4mm, row-gutter: 0em,
    text(fill: grey)[#rich(when)], body))

#let show-entry(e) = row(e.when, {
  let parts = ()
  if e.title != "" { parts.push(strong(rich(e.title))) }
  if e.sub != "" { parts.push(rich(e.sub)) }
  if e.body != "" { parts.push(rich(e.body)) }
  if e.bullets.len() > 0 { parts.push(list(..e.bullets.map(b => rich(b)))) }
  if e.meta != "" { parts.push(text(fill: grey)[#rich(e.meta)]) }
  parts.join(parbreak())
})

#let show-pubs(groups) = for g in groups {
  block(above: 0em, below: gap, sticky: true, emph(rich(g.title)))
  for it in g.items { row(it.label, rich(it.text)) }
}

#let show-skills(groups) = for g in groups { row(g.group, rich(g.items)) }

// ── Sections ───────────────────────────────────────────────────────────────
#for s in d.sections {
  heading-for(s)
  if s.key == "publications" { show-pubs(s.body) }
  else if s.key == "skills" { show-skills(s.body) }
  else { for e in s.body { show-entry(e) } }
}
