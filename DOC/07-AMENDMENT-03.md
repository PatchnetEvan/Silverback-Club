# Amendment 03 — pagination tiebreak and slug collisions

**TRACK: A** (Track B is unaffected — the cursor stays opaque and the payload shape does not change)
**Date:** 9 Sep 2026
**Applies to:** `01-HANDOFF-321-public-api.md` §2, §3, §6 — all patched in place.

Both findings are correct, and the second one is a good catch about a risk I introduced. Amendment 02 made same-date collisions ordinary rather than accidental, and I didn't follow that through to either the cursor or the slug index.

---

## 1. Cursor tiebreak — your fix, adopted

Keyset pagination on the pair:

```sql
ORDER BY public_date DESC, public_slug DESC
WHERE  (public_date, public_slug) < (:cursor_date, :cursor_slug)
```

`next_cursor` is `base64("<public_date>|<public_slug>")` — opaque, passed back verbatim, never parsed by Track B. Row-value comparison works in SQLite/D1; if you'd rather write it expanded for readability, that's your call as long as it's the same predicate.

**Why `public_slug` and not `published_at` as the tiebreak,** since that's the other obvious candidate: `published_at` changes on republish, which would silently reorder the archive and break a cursor mid-pagination. `public_slug` is immutable once minted. Stability beats meaningfulness here — intra-day order is arbitrary either way, so pick the one that can't move under a paging client.

## 2. Slug collisions — refuse, but don't make Evan rename the template

You framed the choice as auto-suffix (silent) or refuse (asks Evan to rename). I'm taking a third option, because both of those have a real cost.

- **Auto-suffix is out.** `2026-09-09-back-squat-2` is a permanent public URL that means nothing to a reader, and it silently accepts a state that is usually a mistake.
- **Refusing and asking for a template rename is also out**, and for a familiar reason: the template name is app data used elsewhere. Renaming it to satisfy a URL constraint is the same anti-pattern as writing `planned_for` at publish time — mutating app state for the website's benefit. The slug is publish-owned, so the slug is what should give.

So: **refuse with a readable message, and put an editable slug field in the publish dialog.**

- Catch the constraint violation; never let the raw DB error reach the UI. The message names the conflict: *"2026-09-09-back-squat is already used by **BACK SQUAT — HEAVY SINGLES**, published for the same date."*
- The dialog's **URL slug** field is prefilled with the generated slug and editable **only while `public_slug` is null** — before first publish, since slugs are permanent afterward.
- Validate: lowercase, `[a-z0-9-]`, no leading or trailing hyphen, unique.

Evan resolves a genuine same-day pair by typing `2026-09-09-back-squat-pm`, which is a URL that means something, and the template keeps its name.

---

## Start order — approved as you proposed

1. **Docs housekeeping.** Delete the two stale duplicates, move the set to `docs/silverback/` in the 3-2-1 repo, commit. Add `test/fixtures/workout.example.json` to the site repo — a hand-authored copy is attached so Track B isn't blocked; regenerate it from a real published template once the endpoint is live, and bump `_contract_version`.
2. **Formatter extraction**, its own revertable commit, with the before/after capture across all 76 templates from both call sites.
3. Then schema + routes.

One addition to step 1: read `06-COORDINATION.md` before you start. There are two coders on this, one per repo, and it sets out who owns which document and how the contract moves between you — short version: the fixture is the handshake, and a failing test is the notification.

## Still Evan's

Unchanged: preview origin, dashboard rate limit rule, deploy hook secret, and confirmation of the date decision — which now costs a column rather than reusing one.
