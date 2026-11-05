# arvindchee.nu

One-page personal site and CV. Static HTML built with Eleventy, deployed to GitHub Pages by `.github/workflows/deploy.yml` on every push to `main`.

## Editing

All content lives in **`src/_data/site.yaml`**: bio, news, publications, experience, projects, teaching, talks, awards, skills and links. Edit it on GitHub, commit, and the site rebuilds.

- Text fields take inline Markdown: `**bold**`, `*italic*`, `[link](https://…)`.
- `only: research` or `only: industry` limits an entry to one CV view.
- A field can differ per view:
  ```yaml
  summary:
    research: …
    industry: …
  ```
- Each view's `order` list in `modes` sets which sections appear and in what order.
- Publications marked `selected: true` appear in the Industry view.
- BibTeX is generated from each publication's fields. `bibtex: false` hides the button.
- `image:` is optional on news, publications and projects. Put a ~640 px WebP in `src/assets/` and write `image: assets/name.webp`.
- Empty fields are skipped, so a half-filled entry never shows a placeholder.

Look and feel:

| What | Where |
| --- | --- |
| Accent colour (links, primary buttons, icon duotone) | `accent` in `site.yaml` |
| Font Awesome Pro kit | `fontawesome_kit` in `site.yaml` (blank uses Font Awesome Free) |
| Default view, default sound | `default_mode`, `sound_default` in `site.yaml` |
| Layout and type | `src/_includes/site.css` |
| Toggles, sounds, QR popover | `src/_includes/site.js` |
| Markup | `src/index.njk` |

CSS and JS are inlined into the page at build time, so the site ships as one HTML file plus the font, portrait and a QR encoder that loads on first hover.

## Features

- Research / Industry toggle that reorders and filters the page; shareable as `?cv=industry`.
- **Download CV** prints the current view as an A4 CV (save as PDF).
- QR code of any link on hover, for opening it on a phone.
- Light, dark or system theme; synthesized button sounds with a mute toggle. Both are remembered per visitor.

## Local preview

```sh
npm install
npm run serve      # http://localhost:8080
npm run build      # writes _site/
```

`src/accrete/` and `src/chimistry/` are standalone apps copied through untouched.

SN Pro is © The SN Pro Project Authors, SIL Open Font License (`src/assets/fonts/SN-Pro-OFL.txt`). qrcode-generator is © Kazuhiko Arase, MIT.
