# Track A — 3-2-1 Log: public publish surface

**Repo:** existing 3-2-1 Log app (`pro.threetwone.com`)
**Goal:** Let Evan mark a workout template "public" and have exactly that template — and nothing else — readable by an anonymous request.

Read `00-READ-FIRST.md` first. Everything in **Out of scope** there applies here.

---

## 1. Assumptions to confirm before you start

State in the PR whether each held. If one didn't, stop and ask.

- Storage is Cloudflare D1; templates live in a `templates` table. ✅ **Confirmed.** Note that `templates.id` is TEXT holding a *mix* of UUIDs and hand-made ids (`tpl-sb-41-silverback-strength-ladder-l`). Immaterial — ids never leave — but nothing may assume UUID shape, slug generation included.
- ~~Blocks are either a `blocks` table or a JSON column.~~ ❌ **Wrong, corrected 9 Sep.** Blocks are not rows. Every block field is denormalized onto `template_movements` (`block_position`, `block_label`, `block_kind`, `block_sets`, `block_rest_min`, `block_rest_max`), repeated per movement, grouped at read time. See §3 for what this means for the query rule.
- The app is a Worker with an existing router and an admin-gated route group. ✅ **Confirmed.**
- There is an existing migrations mechanism. Use it. Do not hand-edit production D1. ✅ **Confirmed.**

## 2. Schema change

Add a publish flag to templates. Default must be private — a migration that silently exposes existing rows is the one unrecoverable mistake here.

```sql
ALTER TABLE templates ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private';
ALTER TABLE templates ADD COLUMN published_at TEXT;      -- ISO timestamp, audit only, never in payload
ALTER TABLE templates ADD COLUMN public_date TEXT;       -- ISO date, the session date the site shows
ALTER TABLE templates ADD COLUMN public_slug TEXT;       -- unique, URL-safe

CREATE UNIQUE INDEX idx_templates_public_slug ON templates(public_slug) WHERE public_slug IS NOT NULL;
CREATE INDEX idx_templates_visibility ON templates(visibility, public_date DESC);
```

**`public_date` added 9 Sep (Amendment 02).** Four publish-owned columns, and the publish action writes only these four. It must never write `planned_for` or any other programming column — see §6.

Do **not** backfill `public_date` in the migration. All four columns start null/private on every existing row; publishing is what fills them.

`visibility` is `'private' | 'public'`. No third state, no soft-delete — unpublishing sets it back to `'private'` and the site drops it on next build.

**Slug rule:** derive from the template name, lowercased, non-alphanumerics to hyphens, collapsed, trimmed. Prefix with `public_date` to guarantee stability and uniqueness:
`2026-09-09-knees-forward-leg-press-knee-resilience`.
Generate once, at first publish, and never regenerate — the slug is a permanent public URL. Unpublish/republish reuses the original slug.

**Collision handling, added 9 Sep (Amendment 03).** Two templates sharing a session date and a name that slugifies identically will hit the unique index. Do **not** auto-suffix (`-2`), and do **not** let the raw constraint error reach the UI. Instead:

- Catch the collision and refuse the publish with a plain message naming the conflict: *"2026-09-09-back-squat is already used by **BACK SQUAT — HEAVY SINGLES**, published for the same date."*
- The publish dialog carries an **editable slug field**, prefilled with the generated slug, editable **only while `public_slug` is null** (i.e. before first publish — slugs are permanent afterward). Evan resolves the collision by typing `2026-09-09-back-squat-pm`.
- Validate the edited slug: lowercase, `[a-z0-9-]` only, no leading/trailing hyphen, still unique.

The reason it is not a template rename: the template name is app data used elsewhere. Renaming it to satisfy a URL constraint would be the same anti-pattern as writing `planned_for` at publish time — mutating app state for the website's benefit. The slug is publish-owned, so the slug is what gives.

## 3. The public routes

**This is the security boundary of the whole project.** Both properties read the same database; the guarantee that no user data reaches the website must be a property of this code, not of what the website chooses to request.

Put these in their own module, mounted before/outside any auth middleware, with the following non-negotiable rules:

1. The handler **never reads the session cookie or any `Authorization` header**. No user context is loaded, so none can leak.
2. Its queries are **fixed at author time**, always filtered `WHERE templates.visibility = 'public'`. No dynamic table names, no caller-supplied column selection, no `SELECT *`.
3. It returns an **explicit allowlist** of fields, built by hand. Never serialize a DB row object directly — that is how a column added next year quietly becomes public.
4. It touches **no** table containing user data (`users`, `sessions`, `logs`, `streaks`, or anything similar).

> **Amended 9 Sep — "one query shape" was the wrong wording for rule 2.** Rule 4 is the real invariant; rule 2 was only ever a proxy for it. Joining `templates` → `template_movements` and grouping blocks in the handler satisfies both: neither table holds user data, and the query is still fixed at author time. Do it as one ordered join (`ORDER BY block_position, movement_position`) and group in a single pass — not a query per block.

```
GET /api/public/today
    → the public template whose public_date is today (America/New_York);
      else the most recent public template with public_date <= today;
      else 204 No Content

GET /api/public/workouts?limit=50&cursor=<opaque>
    → { workouts: [...], next_cursor }  newest first, public only

    limit: default 50, MAXIMUM 100 (Amdt 05 — Track B requests 100/page).
           Clamp above 100; reject <1. next_cursor is null on the last
           page — NEVER echo the final cursor, since Track B pages until
           null and aborts on a repeat.

    Amended (Amdt 03) — keyset pagination on (public_date, public_slug):
      ORDER BY public_date DESC, public_slug DESC
      WHERE  (public_date, public_slug) < (:cursor_date, :cursor_slug)
    next_cursor is base64("<public_date>|<public_slug>"). Opaque to callers:
    Track B passes it back verbatim and never parses it.

GET /api/public/workouts/:slug
    → one workout, or 404
```

Headers on every response:

```
Content-Type: application/json; charset=utf-8
Cache-Control: public, max-age=300, s-maxage=300
Access-Control-Allow-Origin: https://silverbackbarbell.com
Vary: Origin
```

**Amended 9 Sep.** Read the allowed origins from an env var, `PUBLIC_CORS_ORIGINS`, as a comma-separated list of **exact origin strings**, compared with `===`. Never suffix-match `.pages.dev` — that would let any Cloudflare Pages project on the internet read this endpoint. Start with `https://silverbackbarbell.com,https://www.silverbackbarbell.com`; Evan adds the exact preview origin once the Track B project exists, with no redeploy. Never reflect the `Origin` header. Never `*`.

CORS is not moot despite Track B rendering at build time: the homepage does a client-side fetch of `/api/public/today` so a same-day publish appears without waiting on a rebuild.

Rate limit to something sane (60 req/min per IP) via Cloudflare's rate limiting rules. No auth, no API keys — this is public data by definition. **Correct: that is dashboard configuration, not code — Evan's task, not yours.** Don't build a Worker-side limiter; it would duplicate an edge feature and burn CPU time on requests the edge should already have dropped. Note it as an ops prerequisite in your PR and move on.

## 4. Response shape

Fixed contract. Track B codes against exactly this; changing it means changing both repos.

**Revised 9 Sep** — three fields changed after the schema review. This block, not the original, is the contract.

```json
{
  "slug": "2026-09-09-knees-forward-leg-press-knee-resilience",
  "date": "2026-09-09",
  "name": "KNEES FORWARD — LEG PRESS + KNEE RESILIENCE",
  "focus": "Quad strength, controlled knee-over-toe positions, lower-leg strength, and knee resilience.",
  "duration_min": 60,
  "duration_max": 75,
  "blocks": [
    {
      "name": "WARM-UP",
      "prescription": "3 rounds · Rest 45–60s",
      "movements": [
        { "name": "…", "detail": "…" }
      ]
    },
    {
      "name": "PRIMARY LEG PRESS",
      "prescription": "5 sets · Rest 120–180s",
      "movements": []
    }
  ]
}
```

- **`date` is `public_date` (seeded from `planned_for`), not `published_at`.** See §4a and §6.
- **`prescription` is whatever the app actually renders** — `"5 sets · Rest 120–180s"` for a superset block, `"3 rounds · Rest 45–60s"` otherwise. You were right that the original example didn't match; it was written from the rendered UI before the schema was read, and inventing that format would have been the normalized object I deferred. Call the app's **existing** formatting function — extract it to a shared module if it currently lives in a component, so the app and the API cannot drift. Do not reimplement it.
- **`est_minutes` is gone**, replaced by `duration_min` / `duration_max` as integers (either may be null). The TEXT `"60–75"` is a display string, and the site has its own typographic rules for ranges; since the schema already derives the integers, send those and let Track B format. This is the one place I'm overriding "send what the app renders" — because here the structured form already exists and costs nothing.
- **`notes` is dropped from the block object.** No block-level source exists, and shipping a permanently-null field invites Track B to code against something that will never arrive. Movement-level tempo goes into the movement's `detail` string if the app already renders it there; otherwise omit it.
- Preserve the em dashes and middle dots. They are part of the house notation.

**Nullability, settled 9 Sep (Amendment 05).** Only four things are guaranteed present and non-empty:

| Always non-empty | May be null |
|---|---|
| `slug`, `date`, `name` | `focus` (26 of 76 templates have none) |
| `blocks` (array; may be empty) | `duration_min`, `duration_max` |
| | `blocks[].prescription` (30 of 375 blocks produce none) |
| | `blocks[].name` — pending the count you're checking |
| | `movements[].detail` |

**Never emit an empty string.** Trim, and serialize `""` as `null`. An empty string and a missing value would otherwise mean the same thing to a reader and different things to a validator, which is the bug this table exists to prevent.

`name` is the exception that stays required: it is the `<h1>` and the slug source. If a template somehow has an empty name, publish refuses with the same readable-message treatment as a slug collision — it never ships a nameless workout.
- Never include `id`, `owner_id`, `template_id`, `user_id`, or any internal id in the public payload. The slug is the public identifier.

### 4a. What "today" means — decided

**Revised by Amendment 02:** `date` is **`public_date`**, which is seeded from `planned_for` when the template has one and chosen in the publish dialog when it doesn't. The reasoning below is unchanged — `public_date` exists so that publishing an undated catalog template cannot write back into the app's programming data. Read §6 for why.

`date` is the day the session was programmed for, not the day Evan clicked publish. Reasons: it is the date a reader would cite, it is stable if a workout is republished, and it makes publishing ahead behave correctly (a session dated Friday surfaces on Friday, not on the Tuesday it was prepared).

So:

- `date`, the slug prefix, and archive ordering all use `public_date`.
- `published_at` stays an internal audit column and **never appears in the payload**.
- `/api/public/today` matches `public_date` against **America/New_York**, not UTC. Workers run UTC; compute the local date explicitly or the workout flips over at 8pm.
- If nothing is published for today, fall back to the most recent public template with `public_date <= today` rather than returning 204 — an empty homepage panel is worse than an honestly-labelled older session. Track B labels the fallback *"Latest session · Monday 7 September"*, never *"Today"*. 204 is only for a site with nothing published at all.
- **Ignore the active-template setting and the posted-workout concept entirely.** Those are logged-in app state. The public surface reads `templates` + `visibility` + `public_date` and nothing else — coupling it to app state would put a second, invisible publish gate in the system.

Evan: this is the one product call in the amendment rather than a technical one. If you'd rather the homepage track publish date, say so before build starts — it's a one-line change now and a URL migration later.

## 5. Acceptance tests — paste the output into the PR

```bash
# 1. Anonymous read works and returns only allowlisted keys
curl -s https://pro.threetwone.com/api/public/today | jq 'keys'
# expect exactly: ["blocks","date","duration_max","duration_min","focus","name","slug"]
curl -s https://pro.threetwone.com/api/public/today | jq '.blocks[0] | keys'
# expect exactly: ["movements","name","prescription"]

# 2. No user data anywhere in the payload, even nested
curl -s https://pro.threetwone.com/api/public/workouts?limit=100 \
  | jq -r 'tostring' \
  | grep -Eic 'user|email|streak|session_id|owner|completed_at|template_id' 
# expect: 0

# 3. An unpublished template is invisible by slug.
#    Amended 9 Sep — the original was unrunnable, since a private template has
#    no slug (slugs are minted at first publish). Your correction is the stronger
#    test anyway: publish, capture the slug, unpublish, confirm it's gone.
#      a) publish a template in the admin, note its slug
curl -s -o /dev/null -w '%{http_code}\n' \
  https://pro.threetwone.com/api/public/workouts/<slug>          # expect: 200
#      b) unpublish it in the admin, then re-request
curl -s -o /dev/null -w '%{http_code}\n' \
  https://pro.threetwone.com/api/public/workouts/<slug>          # expect: 404
#      c) confirm unpublish is not delete — the row and its slug survive
wrangler d1 execute <DB> --command \
  "SELECT visibility, public_slug FROM templates WHERE public_slug='<slug>'"
# expect: one row, visibility='private', slug intact and reusable

# 4. Sending a valid session cookie changes nothing
curl -s -H "Cookie: <your real session cookie>" \
  https://pro.threetwone.com/api/public/today | jq 'keys'
# expect: identical to test 1 — the handler must ignore the cookie entirely

# 5. CORS is restricted
curl -s -I -H "Origin: https://example.com" \
  https://pro.threetwone.com/api/public/today | grep -i access-control
# expect: no Access-Control-Allow-Origin for a non-allowlisted origin
```

Test 4 is the one that matters. If the response differs when authenticated, the handler is reading user context and the boundary is not real.

## 6. Admin toggle

In the existing admin screen, per template:

**Rewritten 9 Sep (Amendment 02).** The original was written when the payload date came from the publish date, and it did not survive the §4a change. 59 of 76 production templates have no `planned_for`, so this is the common path, not an edge case.

- A single control: **Publish to silverbackbarbell.com** / **Unpublish**.
- The dialog has one editable field, labelled **Session date** — not "publish date". It is prefilled from `planned_for` when the template has one, and blank when it doesn't. **Publish is disabled until it holds a date.** No silent default to today: the field exists so that dating a session is a deliberate act, because the site presents that date as the day the session was run.
- When `planned_for` is null the dialog says so plainly above the field: *"This template has no programmed date. The date you set here is what the site will show."*
- A second field, **URL slug** (Amendment 03), prefilled from date + name, editable only while `public_slug` is null. On collision, refuse with the message in §2 rather than auto-suffixing.
- On publish: set `visibility='public'`, `public_date` from the field, `published_at = now()` automatically, and generate `public_slug` if absent.
- **The publish action writes only the four publish-owned columns.** It must not write `planned_for`, and no migration may backfill it. That column drives the logged-in app's scheduling; setting it as a side effect of publishing would drop an evergreen catalog template onto someone's schedule — a write crossing back over the boundary this project exists to keep one-way.
- Show the resulting public URL next to the toggle, as a clickable link, so Evan can verify the live page in one click.
- Confirm on publish with the workout name in the dialog: "Publish *KNEES FORWARD — LEG PRESS + KNEE RESILIENCE* to the public site?" — this is the human gate on the boundary and should read like one.
- No bulk publish. One at a time, deliberately.

## 7. Deploy hook

After a successful publish or unpublish, `fetch()` the Cloudflare Pages/Workers Build deploy hook URL for the site repo, `POST`, fire-and-forget (`ctx.waitUntil`). Store it as a secret binding `SILVERBACK_DEPLOY_HOOK`.

Failure to trigger a rebuild must **not** fail the publish action — log it and move on. The 5-minute cache and the next scheduled build will catch up.

**Chicken-and-egg, resolved 9 Sep.** The hook URL does not exist until Track B's Cloudflare project does, so Track A must not block on it: if `SILVERBACK_DEPLOY_HOOK` is unset, log once at info and skip — not a warning, not an error. Ship Track A with it unset, verify §7 end-to-end after Track B's project exists. Add "hook fires, build starts" to the Track B PR rather than this one.

## 8. Non-goals for this track

No changes to the existing authenticated app, its UI, its data model beyond the three columns above, or its behavior for logged-in users. If a change to shared code is unavoidable, call it out in the PR before writing it.
