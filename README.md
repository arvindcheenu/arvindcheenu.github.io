# arvindchee.nu

One-page personal site and CV. Static HTML built with Eleventy, deployed to GitHub Pages by `.github/workflows/deploy.yml` on every push to `main`.

## Editing

All content lives in **`src/_data/site.yaml`**: intro, news, publications, projects, experience, teaching, talks, reviewing, awards, education, skills and links. Edit it on GitHub, commit, and the site rebuilds.

- Text fields take inline Markdown: `**bold**`, `*italic*`, `[link](https://…)`.
- `order` sets which sections appear and in what sequence; delete a name to hide that section.
- BibTeX is generated from each publication's fields. `bibtex: false` hides the button.
- `image:` is optional on news, publications and projects. Put a ~640 px WebP in `src/assets/` and write `image: assets/name.webp`.
- Empty fields are skipped, so a half-filled entry never shows a placeholder.

Contact form: get a free access key at [web3forms.com](https://web3forms.com) and paste it into `contact_form.access_key`. Until then the form opens the visitor's mail app with the message filled in. Any service that accepts a JSON POST (Formspree, Basin) works by setting `contact_form.endpoint`.

Look and feel:

| What | Where |
| --- | --- |
| Accent colour (links, primary button, icon duotone) | `accent` in `site.yaml` |
| Font Awesome Pro kit | `fontawesome_kit` in `site.yaml` (blank uses Font Awesome Free) |
| Default sound | `sound_default` in `site.yaml` |
| Type scale and layout | `src/_includes/site.css` (Google Sans Flex, width and weight axes) |
| Sounds, QR popover, form | `src/_includes/site.js` |
| Markup | `src/index.njk` |

CSS and JS are inlined into the page at build time, so the site ships as one HTML file plus the portrait, the Google Sans Flex font and a QR encoder that loads on first hover.

## Features

- **Download CV** prints the page as an A4 CV (save as PDF).
- QR code of any link on hover, for opening it on a phone.
- Contact form with a spam honeypot and a mail-app fallback.
- Light, dark or system theme; synthesized button sounds with a mute toggle. Both are remembered per visitor.

## Local preview

```sh
npm install
npm run serve      # http://localhost:8080
npm run build      # writes _site/
```

`src/accrete/` and `src/chimistry/` are standalone apps copied through untouched.

Google Sans Flex is served by Google Fonts under the SIL Open Font License. qrcode-generator is © Kazuhiko Arase, MIT.
