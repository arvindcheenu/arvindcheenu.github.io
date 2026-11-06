# arvindchee.nu

One-page personal site and CV. Static HTML built with Eleventy, deployed to GitHub Pages by `.github/workflows/deploy.yml` on every push to `main`.

## Editing

All content lives in **`src/_data/site.yaml`**: intro, biographies, news, publications, projects, experience, teaching, talks, service, grants, awards, education, skills and links. Edit it on GitHub, commit, and the site rebuilds.

- Text fields take inline Markdown: `**bold**`, `*italic*`, `[link](https://…)`.
- `tailor.views` holds the Research and Industry views. Each has its own section `order`, `status` line and CV title. Delete a name from an `order` to leave that section out of that view; `arranged` explains the order in a collapsed note under the introduction, which also lists what is left out and can show it. `print_order` gives the saved PDF a different order (the Research CV starts with education, as academic CVs do). `?for=industry` in a link opens the Industry view.
- A field written as `{ research: …, industry: … }` shows the matching text in each view. `bio` (the introduction) works this way.
- `biography` has eight versions: research or industry, short or long, first or third person. The page has switches for length and voice; the view picks the set.
- In Experience, `summary` is the paragraph the Research view shows and `highlights` are the bullet points the Industry view shows.
- Publications list by year; visitors can switch to grouping by type. `pub_groups` sets the type groups and their prefixes (J, C, W, P), numbered newest first, and a legend under the heading explains the letters and icons in use (`key` names a group there). `url` sets where a title links.
- BibTeX is generated from each publication's fields. `bibtex: false` hides the button.
- `image:` adds one picture to a news item, publication or project. `images:` (a list of `src`, `alt`, `caption`) adds a strip of pictures that open full size; the Attention-Aware Visualization entry has an example. Each picture keeps its own shape (read from the file at build time); the strip scrolls sideways, and its edges blur progressively while there is more to see that way, with arrow buttons on hover.
- Grant `amount`s written with a currency code or symbol (`20,000 DKK`, `US$400`) get a live conversion in brackets. `currency_default` and `currencies` set the default and the choices.
- `sections` sets each section's heading, icon and colour, and optionally a `note` under the heading and a `print_title` for the PDF. Links inside a section take its colour; a link to an entry in another section takes that section's colour.
- Link to another entry on the page with `[text](#id)` or `ref: id`, so only an entry's own page leads outside (a talk links to its paper here; the paper links to its DOI). Links that leave the page get an external-link icon automatically.
- `venues` describes each publication venue for readers outside the field and holds acceptance rates by year; a paper uses the rate for its own year.
- `publications_note` is the paragraph under the Publications heading (conventions, acceptance rates, a pointer to Google Scholar).
- `travel` feeds the map under Talks & travel: bases (`home`, `stay`) and trips (`talk`, `school`) with coordinates; trips are drawn from the base you were at. The slider and Play move through time.
- Updates are Work unless marked `tag: life`; visitors switch between Work (the default) and Life. Updates from the last two months get a sparkle badge. `news_visible` and `service_visible` set how many show before "Show more"; in open source and certifications, entries marked `selected: true` show first. A project with `wip: true` gets a "Work in progress" badge.
- Dated sections (news, experience, education, teaching, talks, service, grants, awards, publications) are sorted newest first on the page, whatever order they have in the file.
- Teaching entries take `lead` for the person who runs the course.
- Empty fields are skipped, so a half-filled entry never shows a placeholder.

Contact form: each address under `contact_form.recipients` appears in the "To" menu. Get a free access key per address at [web3forms.com](https://web3forms.com) and paste it next to that address. A recipient without a key opens the visitor's mail app instead, addressed to that email.

Look and feel:

| What | Where |
| --- | --- |
| Icons | Font Awesome Free, built into the page at build time; only the icons used are included |
| Analytics | `analytics.gtm` in `site.yaml` (Google Tag Manager, loaded only after a visitor agrees) |
| Default sound | `sound_default` in `site.yaml` |
| Colours (links, awards, availability), type scale and layout | `src/_includes/site.css`, tokens at the top |
| Behaviour (views, switches, currency, form, viewer) | `src/_includes/site.js` |
| Markup | `src/index.njk` |
| Exchange-rate snapshot used when a build has no network | `src/_data/fx.js` |

CSS and JS are inlined into the page at build time, so the site ships as one HTML file plus the portrait and a QR encoder that loads on first hover. Text uses each visitor's system font, so there is no font download.

## Features

- **Research / Industry** switch in the top bar reorders the page and changes its wording, biographies and printed CV.
- **Download CV / Résumé** prints the page as A4 (save as PDF), following the view on screen.
- Grant amounts convert live into the visitor's currency (European Central Bank rates via frankfurter.dev).
- The top bar hides while reading down and returns on the way up; floating email and back-to-top buttons appear on the way up.
- QR code of any link on hover, for opening it on a phone.
- Hold ⌘ or Ctrl: every visible link and button gets a short code to type; numbers jump to sections, arrow keys move between them.
- Links to other entries scroll there, light the entry up and offer a way back.
- Google Analytics only after a yes in the cookie question; "Cookie settings" in the footer changes the answer.
- Contact form laid out as an email, with a recipient menu, a spam honeypot and a mail-app fallback.
- Light, dark or system theme; synthesized button sounds with a mute toggle. Choices are remembered per visitor.

## Local preview

```sh
npm install
npm run serve      # http://localhost:8080
npm run build      # writes _site/
```

`src/accrete/` and `src/chimistry/` are standalone apps copied through untouched.

Icons: Font Awesome Free (CC BY 4.0). qrcode-generator is © Kazuhiko Arase, MIT. Exchange rates: European Central Bank via frankfurter.dev.
