# Pembrokeshire Silage Day – Visitor App

The visitor web app for **Pembrokeshire Silage Day**, Saturday 11 September 2027,
Slade Hall Farm, near Haverfordwest.

Plain HTML, CSS and JavaScript. No frameworks and no build step – the files you
see are exactly what the browser gets. The look matches the design prototype in
`vinnie89-wq/silage-day-app`, but this is a clean, visitor-only build.

## Stage 1 pages

| Page | File |
|------|------|
| Home / info | `index.html` |
| Timetable | `timetable.html` |
| Safety rules | `safety.html` |
| Site map | `map.html` |
| Getting here | `getting-here.html` |

## What each file does

| File | What it's for |
|------|---------------|
| `index.html` … `getting-here.html` | One file per page: the words and the structure. Each has the same header (logo and date) and the same bottom navigation bar. |
| `js/translations.js` | **Every word on the site, in English and Welsh side by side.** Edit wording here. |
| `js/language.js` | Remembers the visitor's language, shows the first-visit welcome screen, fills each page with the right words, and runs the header language switch. |
| `css/style.css` | How everything looks: colours, fonts, cards, the header and the bottom nav. Shared by every page. |
| `js/app.js` | The small interactive bits: the "days to go" countdown, "Live now" labels on the timetable on the day, and the map zoom buttons. |
| `images/logo.png` | The Silage Day logo. |
| `images/site-map.svg` | The site plan. |
| `.nojekyll` | An empty file that tells GitHub Pages to serve the files exactly as they are. |

## Looking at it on your computer

Double-click `index.html` to open it in your browser. To see the phone layout,
open the browser's developer tools (F12) and switch on the device toolbar.

## Publishing with GitHub Pages

1. Make sure the files are on the `main` branch on GitHub.
2. In the repository on GitHub, go to **Settings → Pages**.
3. Under **Build and deployment**, set **Source** to *Deploy from a branch*.
4. Choose branch **main** and folder **/ (root)**, then click **Save**.
5. After a minute or two the site is live at
   `https://<your-username>.github.io/silage-day-visitor/`.

## Welsh and English

On a first visit, a "Croeso! Welcome!" screen asks the visitor to choose
Cymraeg or English (Welsh first). Their choice is remembered on their device,
and the button in the header switches language at any time.

The HTML pages contain no wording of their own – each element just names a
key, e.g. `<h2 data-i18n="welcome_h"></h2>`, and the words for that key are in
`js/translations.js`:

```js
welcome_h: { en: "Welcome", cy: "Croeso" },
```

To add new text: add a new key to `translations.js` with both `en` and `cy`,
then put `data-i18n="your_key"` on the element in the HTML.

⚠ The Welsh is a draft. A note at the top of every Welsh page says so – remove
it (set `draft_note`'s `cy` to `""`) once a fluent Welsh speaker has checked it.

## Things still to confirm

Anything waiting for the organisers is wrapped in `<span class="placeholder">…</span>`
and shows with a yellow highlight. Search `js/translations.js` for `placeholder` to
find them all (each one appears in both languages): charity name, entry and parking prices, accessible parking, the event
control phone number, the safety disclaimer wording, and the provisional timetable.

## Changing the timetable

Open `timetable.html`. Each demonstration is one `<li class="slot">` block with
`data-start` and `data-end` times (24-hour clock, e.g. `14:30`). Copy a block to
add a new one, and add its name in both languages to `js/translations.js`; the "Live now" labels update automatically on the day.
