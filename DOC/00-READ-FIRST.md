# SilverBack Barbell Club — Build Handoff

**Prepared:** 9 Sep 2026
**Owner / verifier:** Evan Martinez
**Scope:** Retire the WordPress site at silverbackbarbell.com; rebuild on Cloudflare; publish selected 3-2-1 Log workouts to it through a new read-only public API.

There are **two repos** and **two independent tracks**. They meet at one HTTP contract. Do Track A first — Track B is untestable without it.

| File | Repo | Track |
|---|---|---|
| `01-HANDOFF-321-public-api.md` | existing 3-2-1 Log repo | A — publish surface |
| `02-HANDOFF-silverback-site.md` | new `silverback-site` repo | B — the website |
| `03-design-tokens.css` | new `silverback-site` repo | B — visual system, do not invent your own |

## Verified facts (do not re-litigate these)

- **Nameservers are already on Cloudflare.** `silverbackbarbell.com` NS = `bruce.ns.cloudflare.com`, `rosa.ns.cloudflare.com`. The registrar (GoDaddy) change has propagated at the registry.
- **No email on this domain.** MX: none. TXT: none (no SPF). The DNS cutover therefore has no mail blast radius — this is why the plan does not include a mail-preservation step.
- **Current origin is DreamHost** — `173.236.202.233` serves the WordPress site today. It is being decommissioned, not migrated.
- **3-2-1 Log is first-party.** `pro.threetwone.com` is Evan's own Cloudflare-hosted app with an admin role and a session-authenticated JSON API (`GET /api/today` returns `{ ok, user, streak, session, template }`, UUID-keyed).

## Decisions already made (locked — raise objections before building, not after)

| Decision | Value |
|---|---|
| Design direction | "Iron & Paper" — see `03-design-tokens.css`. **Not** the Racing Telemetry system used on the moto properties. |
| Publish depth | Full workout text, server-rendered, indexable |
| Cadence | Today's workout on the homepage + a permanent URL per published session |
| Role of 3-2-1 | Mentioned and credited, **not** the site's call to action. No signup funnel. |
| Money | None. No checkout, no gated content, no user accounts on the site. |
| WordPress | Retired entirely. Not migrated, not kept as a fallback. |
| Data crossing | Published workout templates only — enforced structurally, see Track A §3 |

## Out of scope — explicitly deferred, do not build

Adding any of these without a written go-ahead is scope creep and will be rejected at review:

- User accounts, login, or any authenticated area on the website
- Displaying training logs, streaks, completion status, PRs, or any per-user data
- Comments, forums, or social features
- Payments, subscriptions, or gated programs
- A CMS or admin UI on the website (3-2-1's existing admin is the only editor)
- Video hosting or an exercise-demo library
- Analytics beyond Cloudflare Web Analytics
- Mobile app work of any kind
- Redesigning 3-2-1 Log's own UI

## Definition of done

1. `silverbackbarbell.com` and `www.` serve the new site from Cloudflare over HTTPS, no WordPress in the path.
2. Flipping a template to `public` in the 3-2-1 admin causes it to appear on the site within 5 minutes, with no manual step.
3. An unauthenticated request to any `/api/public/*` route returns workout template data and **nothing else** — verified by the tests in Track A §5.
4. Every old WordPress URL with an inbound link returns a 301 to a live equivalent.
5. Lighthouse ≥ 95 on performance and accessibility for the homepage and a workout page, mobile profile.
6. The email capture form writes to D1 and delivers a notification, with Turnstile passing.

## Working agreement

Evan verifies before merge, per the standard workflow: ship evidence, not assertions. Every acceptance criterion below that says "show" means paste the actual command output or screenshot into the PR. Assumptions you had to make go in the PR description under **Assumptions**, not buried in code comments.
