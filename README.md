# arvindchee.nu

One-page personal site and CV. Static HTML built with Eleventy, deployed to GitHub Pages by `.github/workflows/deploy.yml` on every push to `main`.

## Editing

All content lives in **`src/_data/site.yaml`**: intro, biographies, news, publications, projects, experience, teaching, talks, service, grants, awards, education, skills and links. Edit it on GitHub, commit, and the site rebuilds.

- Text fields take inline Markdown: `**bold**`, `*italic*`, `[link](https://…)`.
- `tailor.views` holds the Research and Industry views. Each has its own section `order`, `status` line and CV title. Delete a name from an `order` to hide that section in that view. `?for=industry` in a link opens the Industry view.
- A field written as `{ research: …, industry: … }` shows the matching text in each view. `bio` (the introduction) works this way.
- `biography` has eight versions: research or industry, short or long, first or third person. The page has switches for length and voice; the view picks the set.
- In Experience, `summary` is the paragraph the Research view shows and `highlights` are the bullet points the Industry view shows.
- Publications list by year; visitors can switch to grouping by type. `pub_groups` sets the type groups and their prefixes (J, C, W, P), numbered newest first. `url` sets where a title links.
- BibTeX is generated from each publication's fields. `bibtex: false` hides the button.
- `image:` adds one picture to a news item, publication or project. `images:` (a list of `src`, `alt`, `caption`) adds a strip of pictures that open full size; the Attention-Aware Visualization entry has an example.
- Grant `amount`s written with a currency code or symbol (`20,000 DKK`, `US$400`) get a live conversion in brackets. `currency_default` and `currencies` set the default and the choices.
- `sections` sets each section's heading and icon.
- Empty fields are skipped, so a half-filled entry never shows a placeholder.

Contact form: each address under `contact_form.recipients` appears in the "To" menu. Get a free access key per address at [web3forms.com](https://web3forms.com) and paste it next to that address. A recipient without a key opens the visitor's mail app instead, addressed to that email.

Look and feel:

| What | Where |
| --- | --- |
| Font Awesome Pro kit | `fontawesome_kit` in `site.yaml` (blank uses Font Awesome Free) |
| Default sound | `sound_default` in `site.yaml` |
| Type scale and layout | `src/_includes/site.css` |
| Behaviour (views, switches, currency, form, viewer) | `src/_includes/site.js` |
| Markup | `src/index.njk` |
| Exchange-rate snapshot used when a build has no network | `src/_data/fx.js` |

CSS and JS are inlined into the page at build time, so the site ships as one HTML file plus the portrait, the Google Sans Flex font and a QR encoder that loads on first hover.

## Features

- **Research / Industry** switch in the top bar reorders the page and changes its wording, biographies and printed CV.
- **Download CV / Résumé** prints the page as A4 (save as PDF), following the view on screen.
- Grant amounts convert live into the visitor's currency (European Central Bank rates via frankfurter.dev).
- The top bar hides while reading down and returns on the way up; floating email and back-to-top buttons appear on the way up.
- QR code of any link on hover, for opening it on a phone.
- Contact form laid out as an email, with a recipient menu, a spam honeypot and a mail-app fallback.
- Light, dark or system theme; synthesized button sounds with a mute toggle. Choices are remembered per visitor.

## Local preview

```sh
npm install
npm run serve      # http://localhost:8080
npm run build      # writes _site/
```

`src/accrete/` and `src/chimistry/` are standalone apps copied through untouched.

Google Sans Flex is served by Google Fonts under the SIL Open Font License. qrcode-generator is © Kazuhiko Arase, MIT. Exchange rates: European Central Bank via frankfurter.dev.
