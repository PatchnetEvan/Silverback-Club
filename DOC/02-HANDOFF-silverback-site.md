# Track B — silverbackbarbell.com on Cloudflare

**Repo:** new — `silverback-site`
**Stack:** Astro (static output) → Cloudflare Workers static assets. D1 for form submissions. Turnstile on the form.
**Depends on:** Track A's `/api/public/*` routes.

Read `00-READ-FIRST.md` first. Everything in **Out of scope** there applies here.

---

## 1. Positioning and voice

The audience is adults who have been training for years and have stopped being impressed by fitness marketing. The existing site's own words set the register — keep them:

> **Strength for Life. Resilience for the Long Run.**
> We design workouts to build strength, resilience, and longevity — without burnout, ego lifting, or unnecessary complexity.

No countdown timers, no "transform your body," no urgency, no stock gym photography with chalk clouds. If a piece of copy would fit on a supplement label, rewrite it.

## 2. Design system

Use `03-design-tokens.css` verbatim. Do not introduce new colors, new typefaces, or a component library.

- **Ground:** warm grey paper, not cream. **Ink:** near-black. **Accent:** deep olive, used sparingly. **Rust:** reserved strictly for things that need a decision from the reader — not for emphasis, not for headings.
- **Type:** Zilla Slab for display, Source Sans 3 for body, IBM Plex Mono for anything containing a number — dates, rest intervals, set counts, estimated minutes.
- **Structure:** hairline rules, not cards. Nothing rounded, nothing glowing, no drop shadows on content blocks.
- Full light and dark support via the token blocks in the CSS file. Test all three viewer states: explicit light, explicit dark, and OS-preference with no stamp.
- `font-variant-numeric: tabular-nums` anywhere digits stack in a column.

## 3. Pages

| Route | Content | Rendering |
|---|---|---|
| `/` | Positioning line, today's workout in full, the last ~8 sessions as a list, email capture | Static shell; today's panel hydrates from `/api/public/today` |
| `/workouts/` | Full archive, newest first, grouped by month | Static, built from `/api/public/workouts` |
| `/workouts/[slug]/` | One workout, complete | Static, one page per published workout |
| `/about/` | What the club is, who it's for, training philosophy | Static |
| `/app/` | What 3-2-1 Log is, link to it | Static |
| `/404` | In-voice, links back to `/workouts/` | Static |

Build-time data fetch in `getStaticPaths()` against `/api/public/workouts`. The homepage's "today" panel additionally does a client-side fetch of `/api/public/today` so a same-day publish appears without waiting on the rebuild — render the build-time value first so the page is complete before JS runs, then swap only if the live value differs.

**If the API is unreachable at build time, fail the build.** Do not deploy a site with a silently empty archive.

## 4. Workout rendering

This is the heart of the site. Get it right before anything else is polished.

- `name` as the page `<h1>`, in Zilla Slab. Preserve the em dash.
- `focus` as a standfirst under it, max ~52ch measure.
- Blocks as a hairline-ruled list: block name left (semibold, slight letter-spacing), `prescription` right (mono, muted, `white-space: nowrap`).
- Movements nested under their block where present.
- Date and block count as a mono eyebrow above the title.
- Under the blocks, one quiet line: *"We run these sessions in 3-2-1 Log."* linking to `/app/`. One line. Not a button, not a banner, not a modal. The site is not a funnel for the app.
- Prev/next navigation between workouts by date.

**SEO — this is the whole traffic strategy:**
- One `<article>` per workout with real server-rendered text. No client-only rendering of workout content.
- `Exercise`/`HowTo`-flavored JSON-LD is optional; a clean `<title>`, meta description from `focus`, and canonical URL are not.
- `/sitemap.xml` including every workout page, regenerated each build. `/robots.txt` allowing everything.
- `<title>` pattern: `Knees Forward — Leg Press + Knee Resilience | SilverBack Barbell Club`

## 5. Email capture

Replace the WordPress form. Fields: first name, last name, email. All the copy stays honest — the current site says it's optional with no strings attached, so no dark patterns, no pre-checked boxes.

- Cloudflare Turnstile in front, verified server-side. Reject on failure with a real error message.
- `POST /api/subscribe` on a Worker route → D1 table `subscribers(id, first_name, last_name, email, created_at, ip_country, source)`.
- Unique index on lowercased email. A duplicate submit returns success, not an error — never tell a stranger whether an address is already on the list.
- Notify Evan by email on each signup (Resend or MailChannels; secret binding, not hardcoded).
- Progressive enhancement: the form must submit and show a result without JavaScript.
- **Import the existing WordPress form entries into `subscribers` before WP is switched off.** Export them first; that list is the only data worth keeping from the old site.

## 6. Cutover

1. Crawl the current WordPress site (`wget --spider -r` or equivalent) and produce a complete URL inventory. The front end shows one page — confirm whether orphaned posts, `/wp-content/` assets with inbound links, or old landing pages exist.
2. Write the 301 map as Cloudflare Redirect Rules or `_redirects`. Every old URL resolves to a live equivalent; no chains, no loops.
3. Deploy to a preview URL. Evan verifies against this brief's acceptance criteria.
4. Point the zone at the Worker. Keep DreamHost running, untouched, for one week.
5. After a clean week: cancel DreamHost hosting for this domain.

Do **not** skip step 4 to save a hosting month.

## 7. Acceptance criteria — evidence, not assertions

Paste into the PR:

- `curl -sI https://<preview>/workouts/<slug>/` showing 200 and `content-type: text/html`
- `curl -s https://<preview>/workouts/<slug>/ | grep -c "Spanish Squat"` returning ≥1 — proving workout text is in the server HTML, not injected by JS
- Lighthouse mobile scores for `/` and one workout page: performance ≥95, accessibility ≥95, SEO ≥95
- Screenshots of `/` and one workout page in explicit light, explicit dark, and OS-preference-dark-with-no-stamp
- `curl -sI https://<preview>/<old-wp-url>` showing 301 and the correct `location`, for every URL in the redirect map
- A form submission end to end: the D1 row, and the notification email
- Keyboard-only walkthrough of the form: visible focus states throughout, submittable without a mouse

## 8. Explicitly not wanted

Beyond the global out-of-scope list: no cookie banner (don't set cookies that need one), no chat widget, no newsletter popup or exit-intent overlay, no carousel, no hero occupying a full viewport height, no animated counters, no third-party fonts other than the Google Fonts named in the tokens file, and no analytics beyond Cloudflare Web Analytics.
