# SilverBack Barbell Club

Astro static site deployed through Cloudflare Workers static assets, with a Worker route for D1-backed email signup.

Read [`DOC/02-HANDOFF-silverback-site.md`](DOC/02-HANDOFF-silverback-site.md) before changing Track B scope or behavior. The canonical cross-repository documentation lives in the sibling checkout at `../threetwone-pro/docs/silverback/`.

The canonical cross-repository API fixture is `test/fixtures/workout.example.json`. Track A owns that file; this repository consumes it unchanged and tests against its contract version. Amendment 05 requires a `2026-09-09.3` fixture set; Track B supports that nullability now and will replace the current byte-identical `.2` copy when Track A publishes the generated set.

## Local development

Track A's public API must be available for a normal build. While that dependency is unfinished, the checked-in fixture can be enabled explicitly:

```sh
npm install
USE_WORKOUT_FIXTURE=true npm run dev
npm run build:fixture
```

Copy `.dev.vars.example` to `.dev.vars` and provide local values before testing the Worker with `npm run preview`. The fixture flag is deliberately opt-in; `npm run build` fails if the public workout API is unreachable, unauthorized, or malformed. A valid empty archive builds an honest empty state and logs a warning.

## Cloudflare setup

Create the D1 database and replace the generated database identifier in `wrangler.jsonc` if automatic provisioning is not used. Apply migrations through Wrangler's migration command. Store `TURNSTILE_SECRET` and `RESEND_API_KEY` with `wrangler secret put`; never add them to the configuration or repository.

`PUBLIC_TURNSTILE_SITE_KEY` is a non-secret build variable. Production Turnstile hostnames are `silverbackbarbell.com` and `www.silverbackbarbell.com`; add the exact preview hostname when it exists. The Worker checks the returned Turnstile action (`subscribe`) and exact hostname before writing to D1.

The notification sender domain must be verified with the selected email provider before end-to-end signup acceptance testing.

## Remaining cutover work

- Export and import the WordPress form entries before WordPress is switched off.
- Re-run the WordPress URL inventory immediately before cutover and replace broad workout redirects with exact matches when equivalent public workouts exist.
- Create Cloudflare resources, set secrets, deploy a preview, and collect the evidence listed in the Track B handoff.
- Keep DreamHost untouched for one week after DNS cutover.
