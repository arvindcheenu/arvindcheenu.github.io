// Research CV and industry résumé, built from src/_data/site.yaml by cv/build.py.
// The view comes in as `--input view=research|industry`; the data as cv/build/<view>.json.

#let view = sys.inputs.at("view", default: "research")
#let d = json("build/" + view + ".json")

// Section colours, the light values from the site's tokens.
#let palette = (
  blue: rgb("#2563eb"), violet: rgb("#7c3aed"), indigo: rgb("#4f46e5"), sky: rgb("#0369a1"),
  cyan: rgb("#0e7490"), teal: rgb("#0f766e"), emerald: rgb("#047857"), lime: rgb("#4d7c0f"),
  amber: rgb("#b45309"), orange: rgb("#c2410c"), rose: rgb("#e11d48"), pink: rgb("#be185d"),
  fuchsia: rgb("#a21caf"),
)
#let ink = rgb("#18181b")
#let soft = rgb("#52525b")
#let faint = rgb("#a1a1aa")
#let rule = rgb("#e4e4e7")
#let accent = state("accent", palette.blue)

// Helpers the prepared text calls.
// Links in running text stay ink; identifiers, header links and code links carry colour.
#let tint(url, body) = context link(url, text(fill: accent.get(), body))
#let award(body) = context text(fill: palette.amber, weight: 500)[#body]
#let ident(url, body) = tint(url, body)
#let rate(body) = text(fill: soft)[[#body]]
#let wip(body) = text(size: 0.85em, fill: palette.amber, weight: 500)[#body]
#let rich(s) = eval(s, mode: "markup", scope: (award: award, ident: ident, tint: tint, rate: rate, wip: wip))

#set document(title: d.plain_name + " – " + d.doc, author: d.plain_name)
#set page(
  paper: "a4",
  margin: (x: 17mm, top: 16mm, bottom: 18mm),
  footer: context {
    set text(size: 7.5pt, fill: faint)
    grid(columns: (1fr, auto),
      [#rich(d.name) · #d.doc · Updated #d.updated],
      [#counter(page).display() / #counter(page).final().first()])
  },
)
#set text(font: "Inter", size: 9pt, fill: ink, lang: "en", hyphenate: false, number-type: "lining")
#set par(justify: false, leading: 0.58em, spacing: 0.75em)
#show strong: set text(weight: 600)

// ── Header ─────────────────────────────────────────────────────────────────
#block(below: 0.9em)[
  #text(size: 21pt, weight: 600, tracking: -0.01em)[#rich(d.name)]
  #v(-0.35em)
  #text(size: 10.5pt, fill: soft)[#rich(d.role) · #rich(d.affiliation)]
  #v(-0.1em)
  #set text(size: 8.5pt)
  #let sep = [#h(0.35em)#text(fill: faint)[·]#h(0.35em)]
  #text(fill: soft)[#rich(d.location)]#sep#d.links.map(l => link(l.url, text(fill: palette.blue)[#rich(l.label)])).join(sep)
]
#if d.summary != "" {
  block(below: 0.4em, text(size: 9.2pt)[#rich(d.summary)])
}
#if d.status != "" {
  text(size: 8.5pt, fill: palette.emerald, weight: 500)[● #rich(d.status)]
}

// ── Building blocks ────────────────────────────────────────────────────────
#let heading-for(s) = {
  let c = palette.at(s.color, default: palette.blue)
  accent.update(c)
  block(above: 1.5em, below: 0.75em, sticky: true, {
    text(size: 10.5pt, weight: 600, fill: c)[#rich(s.title)]
    v(-0.55em)
    line(length: 100%, stroke: 0.5pt + rule)
  })
}

#let when-col = 30mm
#let row(when, body) = block(breakable: false, below: 0.95em,
  grid(columns: (when-col, 1fr), column-gutter: 4mm,
    text(size: 8pt, fill: soft)[#rich(when)], body))

#let show-entry(e) = row(e.when, {
  if e.title != "" { text(weight: 600)[#rich(e.title)] }
  if e.sub != "" { linebreak(); text(fill: soft)[#rich(e.sub)] }
  if e.body != "" { block(above: 0.4em, below: 0em)[#rich(e.body)] }
  if e.bullets.len() > 0 {
    block(above: 0.4em, below: 0em, list(indent: 0.1em, body-indent: 0.5em, spacing: 0.4em, marker: text(fill: faint)[•],
      ..e.bullets.map(b => rich(b))))
  }
  if e.meta != "" { block(above: 0.35em, below: 0em, text(size: 8pt, fill: soft)[#rich(e.meta)]) }
})

#let show-pubs(groups) = for g in groups {
  block(above: 0.9em, below: 0.5em, sticky: true, text(size: 8.5pt, weight: 600, fill: soft)[#rich(g.title)])
  for it in g.items { row(it.label, rich(it.text)) }
}

#let show-skills(groups) = grid(columns: (when-col, 1fr), column-gutter: 4mm, row-gutter: 0.55em,
  ..groups.map(g => (text(size: 8pt, fill: soft)[#rich(g.group)], rich(g.items))).flatten())

// ── Sections ───────────────────────────────────────────────────────────────
#for s in d.sections {
  heading-for(s)
  if s.key == "publications" { show-pubs(s.body) }
  else if s.key == "skills" { show-skills(s.body) }
  else { for e in s.body { show-entry(e) } }
}
