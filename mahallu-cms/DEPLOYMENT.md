# Deploying mahallu-cms

The CMS is a static Vite build (`npm run build` -> `dist`) hosted on Netlify. Build and
header configuration lives in `netlify.toml`.

## Required environment variables

Set these in the Netlify site settings (Site configuration -> Environment variables). They are
read at **build time** and baked into the bundle.

| Variable | Purpose |
| --- | --- |
| `VITE_API_URL` | **Required for production builds.** Full base URL of the API including `/api`, e.g. `https://api.example.com/api`. A production build FAILS if it is missing, is not `https://`, or points at localhost, so a bundle can never ship calling the visitor's own machine. Local development falls back to `http://localhost:4000/api`. |
| `VITE_ONESIGNAL_APP_ID` | OneSignal web push app id. If unset, push subscription is skipped silently. |

Never put secrets in `VITE_*` variables: everything with that prefix ends up in the public bundle.

### Build-time guard

`vite.config.ts` calls `resolveApiBaseUrl` (`src/config/apiUrl.ts`) for every production build, and the bundle runs the same check at start-up. To test a production build locally against a local API, opt in explicitly with `VITE_ALLOW_LOCAL_API=true`; never set that variable on Netlify.

```
VITE_API_URL=https://api.example.com/api npm run build      # ok
npm run build                                                # fails: VITE_API_URL is not set
```

## Content-Security-Policy: set the API origin (required)

`netlify.toml` sends a `Content-Security-Policy` header on every response. Its `connect-src`
directive controls which hosts the browser lets the app call with `fetch` / XHR, and it contains a
placeholder for the backend:

```
connect-src 'self' https://REPLACE_WITH_API_ORIGIN https://onesignal.com https://*.onesignal.com
```

The API origin depends on `VITE_API_URL`, which is only known per deployment, so it cannot be
hard-coded in the repo. Before the first production deploy:

1. Take `VITE_API_URL`, drop the path, and keep scheme + host (+ port if any).
   `https://api.example.com/api` -> `https://api.example.com`
2. Replace `https://REPLACE_WITH_API_ORIGIN` in the `Content-Security-Policy` line of
   `netlify.toml` with that origin.
3. Redeploy and open the browser console. A blocked call shows as
   `Refused to connect to ... because it violates the following Content Security Policy directive`.

### Build-time CSP guard

A placeholder must not deploy silently, so every production build (`vite build`, mode `production`)
runs `checkCspForBuild` (`src/config/cspGuard.ts`, called from `vite.config.ts`) against
`netlify.toml` and **fails** when:

- the text `REPLACE_WITH_API_ORIGIN` is still present outside a `#` comment line, or
- the policy's `connect-src` (or `default-src` when there is no `connect-src`) does not allow the
  origin of `VITE_API_URL` (exact origin, a matching `https://*.host` wildcard, or the bare `https:`
  scheme source; the port must match).

The failure reads, for example:

```
CSP guard: netlify.toml still contains the placeholder "REPLACE_WITH_API_ORIGIN". Deployed as is, the
browser would block every API call. Fix: replace https://REPLACE_WITH_API_ORIGIN in the
Content-Security-Policy of netlify.toml with the real API origin (the scheme + host[:port] of
VITE_API_URL, no path, e.g. https://api.example.com). For a local verification build only, set
VITE_ALLOW_CSP_PLACEHOLDER=true.
```

To check that a build compiles without editing `netlify.toml` (CI, local verification), set
`VITE_ALLOW_CSP_PLACEHOLDER=true`. The guard then only prints a warning ("do NOT deploy this build").
Never set it on Netlify. `.env.example` lists the variable name only.

```
VITE_API_URL=https://api.example.com/api VITE_ALLOW_CSP_PLACEHOLDER=true npm run build   # local check only
```

The CMS has no frontend test runner, so `cspGuard.ts` is a pure module that can be exercised with a
throwaway script (bundle it with esbuild and call `checkCspForBuild` with sample file text). The guard
reads `netlify.toml` from the CMS folder; if you move the CSP to another file (`_headers`, another
host), update `vite.config.ts` so the guard reads that file instead.

If the API sits on a different origin from the file/image storage (for example S3 or a CDN for
uploaded documents), images are already allowed from any `https:` host (`img-src`); if the app
ever `fetch`es files directly from that host, add the host to `connect-src` as well.

If you move the app to another host, the same headers must be re-created there (for example in a
`_headers` file or the host's equivalent): the CSP is the second line of defence behind HTML
sanitizing for stored XSS.

## Other headers set by `netlify.toml`

- `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'`: the app cannot be framed.
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`.
- `Strict-Transport-Security` (1 year, includeSubDomains; not preloaded).
- `Permissions-Policy`: camera, microphone, geolocation, payment and USB are disabled (the app uses
  none of them). Notifications are not restricted, OneSignal needs them.
- `/assets/*` is served with `Cache-Control: public, max-age=31536000, immutable`
  because Vite fingerprints those file names.

## When a new third-party host is added

Add it to the matching CSP directive (`script-src`, `style-src`, `font-src`, `connect-src`,
`img-src`, `frame-src`) in `netlify.toml`; anything not listed is blocked.

## Rich text (NOC description)

NOC descriptions are HTML written with the in-app editor. The API sanitizes them on every write
(`mahallu-api/src/utils/htmlSanitizer.ts`) and the CMS sanitizes again before rendering or
editing (`src/utils/sanitizeHtml.ts`). Keep the two allow-lists in step if the editor gains a new
formatting button.

## PDF fonts and Malayalam

PDF exports (`src/utils/exportUtils.ts`, `src/utils/paymentReceiptPdf.ts`) use jsPDF with a bundled Noto Sans
(SIL OFL 1.1, `public/fonts/OFL.txt`). `src/utils/pdfFonts.ts` fetches `public/fonts/NotoSans-Regular.ttf` and
`NotoSans-Bold.ttf` (about 27 KB each) the first time a PDF is made.

**What the font covers** (verified by parsing the cmap of both files: 390 code points, 401 glyphs):

| Range | Coverage |
| --- | --- |
| Basic Latin U+0020-U+007E | 95 of 95 |
| Latin-1 Supplement + Latin Extended-A U+00A0-U+017F | all |
| General punctuation (dashes, quotes, bullet, ellipsis), currency symbols U+20A0-U+20C0 | yes, including U+20B9 INDIAN RUPEE SIGN |
| Devanagari U+0900-U+097F | 0 of 128 |
| **Malayalam U+0D00-U+0D7F** | **0 of 128** |
| Zero-width joiner / non-joiner U+200C/U+200D | no |

**Malayalam text does not render in PDFs.** jsPDF drops code points the font has no glyph for, so
before this change a Malayalam name came out as blank space with no warning (verified: the text line
for "മഹല്ല് കമ്മിറ്റി" produced a single space glyph). The generators now pass free text through
`toPdfSafeText`, which replaces every run of characters outside the bundled ranges with a visible `?`
(and the table export logs one console warning), so missing data is noticeable. This is a stop-gap: the
original Malayalam is not in the PDF. English names, numbers and the rupee sign are unaffected.

Why there is no Malayalam font path yet:

- No Malayalam-capable font is vendored in the repo or in `node_modules` (only the two Latin Noto
  subsets). The CMS uses Noto Sans Malayalam as a Google web font for the screen, which jsPDF cannot
  use, and nothing may be downloaded at build time here.
- Malayalam is a complex script (conjuncts, chillu letters, vowel signs that reorder around the
  consonant). jsPDF maps one code point to one glyph and does no OpenType shaping, so even with a
  Malayalam TTF the output would show broken conjuncts and misplaced vowel signs. A half-working path
  is worse than a clear limitation, so none is shipped. Glyph presence can be checked from the PDF
  streams, but only a person looking at the file can confirm the shaping is right; nobody has.

Options if Malayalam in PDFs is required (pick one; each is a project decision):

1. **Server-side PDF** with a shaping-capable renderer (headless Chromium/Puppeteer, or a
   HarfBuzz-based library) and the Noto Sans Malayalam font (SIL OFL) installed on the server.
   Best fidelity, adds a runtime dependency to the API.
2. **Print-to-PDF / html2canvas of the HTML view.** The browser shapes the text with the web font that
   is already loaded. `html2canvas` is already in the bundle; output is an image (not selectable text).
   The browser print dialog gives selectable text.
3. **pdfmake + HarfBuzz (or a pre-shaped glyph pipeline).** Heavy (well over 1 MB with fonts and the
   shaping engine); not added without a decision.

Whichever is chosen, vendor the Malayalam font file with its OFL text under `public/fonts` and extend
`PDF_FONT_RANGES` / add a `pickPdfFont(text)` only once the rendering has been checked visually.

## Build verification matrix (what the production build refuses)

All of these are enforced at build time (`vite build`); `npm run build` runs `tsc -p tsconfig.json --noEmit`
first. `npx tsc -b` also passes (the config files that `vite.config.ts` imports are part of
`tsconfig.node.json`; it emits declarations only, into `node_modules/.tmp`).

| Situation | Result |
|---|---|
| `VITE_API_URL=https://api.example.com/api` and `netlify.toml` still containing `REPLACE_WITH_API_ORIGIN` | **Fails** with the CSP guard message. Replace the placeholder with the real API origin. |
| Same, with `VITE_ALLOW_CSP_PLACEHOLDER=true` | Builds, with a warning: for a local verification build only, never deploy it. |
| `VITE_API_URL` unset | Fails (the bundle would call a local address). |
| `VITE_API_URL=http://...` | Fails (tokens would travel unencrypted). |
| `VITE_API_URL` pointing at `localhost` | Fails unless `VITE_ALLOW_LOCAL_API=true` (local preview only). |
| `connect-src` in `netlify.toml` not allowing the origin of `VITE_API_URL` | Fails. |

Replacing the placeholder in `netlify.toml` is an operator step: this repository deliberately does not
contain a real API origin.

## Session behaviour the operator should know

- A `403` with code `TENANT_SUSPENDED` ends the CMS session (like a `401`) and the login page shows the
  server's message once. `NO_TENANT` and `NO_INSTITUTE` show the server's message and keep the session
  (those accounts can still sign out). A `403` for an inactive account carries no code, so it still reads
  as a generic permission error.
- New staff accounts created from the CMS have no password and sign in with an OTP.
- The CMS sign-in is OTP only; the password endpoint of the API is not used by any screen.
- Lists and exports: totals come from server summaries; the shared export helper excludes `actions`
  columns and shows a warning when a client-side export reaches its page cap (20,000 rows). The backend
  CSV (`/api/export/...`) reports truncation with the `X-Export-Truncated` response header.

## Malayalam in PDFs: current state and the decision needed

Verified again: the only font files in the project are `public/fonts/NotoSans-Regular.ttf` and
`NotoSans-Bold.ttf` (SIL OFL text present). They contain no Malayalam (0 of 128 code points in
U+0D00-U+0D7F) and no zero-width joiners; the rupee sign is present. The PDF library draws one code point
as one glyph and does no OpenType shaping, so even a Malayalam font would draw conjuncts, chillu letters
and vowel signs incorrectly. Malayalam text in exported PDFs, receipts and invoices is therefore replaced
by a visible `?` (and a console warning), never dropped silently. This is a stop-gap, not a localisation
solution. Choose one of the options listed in the "PDF fonts and Malayalam" section above (server-side
rendering with a shaping engine, print-to-PDF of the HTML view, or a shaping-capable PDF library), and
vendor the font with its licence text under `public/fonts`. No font was added in this pass because none
with a clear licence is present in the repository and nothing is downloaded automatically.
