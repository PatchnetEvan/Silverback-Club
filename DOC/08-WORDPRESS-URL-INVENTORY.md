# WordPress cutover URL inventory

Captured 9 Sep 2026 from the live WordPress sitemap index, public REST API, rendered page content, and media metadata. `wget` was unavailable in the build environment, so the canonical WordPress discovery surfaces were reconciled directly. A public web search found no indexed external results for the old `/WORKOUT/` or `/wp-content/uploads/` URLs; that does not prove no private or unindexed inbound links exist.

## Published pages

| Old route | Live equivalent |
|---|---|
| `/` | `/` |
| `/weekly-workouts/` | `/workouts/` |
| `/how-we-train/` | `/about/` |

## Published workout posts

All 17 routes redirect in one hop to `/workouts/` until individual legacy-to-new workout matches exist.

- `/WORKOUT/todays-workout/`
- `/WORKOUT/%f0%9f%92%a5-press-drive-chest-glute-power-day/`
- `/WORKOUT/%e2%9a%a1-shoulder-shockwave-dynamic-shoulders-jump-power-run/`
- `/WORKOUT/gravity-storm-bodyweight-emom-w-pull-ups-jump-squats/`
- `/WORKOUT/%f0%9f%a6%8d-ground-force/`
- `/WORKOUT/%f0%9f%8e%84-12-days-of-iron-pull-edition/`
- `/WORKOUT/%f0%9f%a6%8d-one-leg-one-core/`
- `/WORKOUT/%f0%9f%a6%8d-earn-the-curl/`
- `/WORKOUT/%f0%9f%a6%8d-fast-press-protocol/`
- `/WORKOUT/%f0%9f%a6%8d-volume-tax/`
- `/WORKOUT/iron-reserve-controlled-power-edition/`
- `/WORKOUT/%f0%9f%a6%8d-pulled-not-climbed/`
- `/WORKOUT/%f0%9f%a6%8d-slow-burn-press/`
- `/WORKOUT/%f0%9f%a6%8d-grip-grind/`
- `/WORKOUT/%f0%9f%a6%8d-pull-then-peel/`
- `/WORKOUT/248/`
- `/WORKOUT/evan-monkeying-around/`

## Taxonomy and author archives

These listing routes redirect to `/workouts/`:

- `/WORKOUT/category/uncategorized/`
- `/WORKOUT/category/foundational-fitness/`
- `/WORKOUT/category/performance-power/`
- `/WORKOUT/category/training-modalities/`
- `/WORKOUT/category/metabolic-burn/`
- `/WORKOUT/category/transform-sculpt/`
- `/WORKOUT/category/active-wellness/`
- `/WORKOUT/category/daily-workout/`
- `/WORKOUT/author/silverbackbarbell_s1w614/`

## Media attachment pages and uploads

WordPress exposes three attachment pages:

- `/logo/`
- `/logo/cropped-logo-jpg/`
- `/silverback-barbell-club/dall%c2%b7e-2024-11-26-12-43-11-a-motivational-banner-for-a-fitness-website-featuring-a-sleek-and-modern-gym-with-a-focus-on-weights-and-barbells-the-lighting-is-soft-yet-dramatic/`

The media library contains three originals and 11 generated variants under:

- `/wp-content/uploads/2025/01/logo*.jpg`
- `/wp-content/uploads/2025/01/cropped-logo*.jpg`
- `/wp-content/uploads/2024/11/DALL·E-2024-11-26-12.43.11-A-motivational-banner-for-a-fitness-website-featuring-a-sleek-and-modern-gym-with-a-focus-on-weights-and-barbells.-The-lighting-is-soft-yet-dramatic*.webp`

The generated site uses no photography and has a new lightweight mark, so these assets and attachment pages redirect to `/`. One plugin spinner SVG was referenced from rendered form markup; it is implementation plumbing rather than retained content.

## WordPress-generated discovery routes

- `/feed/` → `/workouts/`
- `/comments/feed/` → `/workouts/`
- `/wp-sitemap.xml` and child sitemap routes → `/sitemap.xml`
- `/superpwa-manifest.json` → `/`
- `/index.php` → `/`

The WordPress REST API and administration routes are platform endpoints, not public content URLs. They should disappear with WordPress and are intentionally absent from the content redirect map.

## Before cutover

Re-run the sitemap and REST enumeration immediately before DNS changes. Replace the broad `/WORKOUT/*` rule with exact permanent workout mappings wherever a corresponding published Track A slug exists. Export WordPress form entries before shutdown; public endpoints cannot expose those submissions.
