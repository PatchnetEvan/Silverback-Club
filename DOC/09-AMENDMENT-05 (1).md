# Amendment 05 — nullability, and a rule of mine that was wrong

**TRACK: BOTH**
**Date:** 9 Sep 2026
**Applies to:** `01-HANDOFF` §3, §4 and `02-HANDOFF` §3, §4 — all patched in place.
**Contract version:** bump the fixture to `2026-09-09.3`.

The 3-2-1 coder read Track B's client and found two properties of the real data that would abort its build the first time Evan publishes. Both are payload-shape questions, so both come here rather than being settled between the two of you. That was the correct call.

Track B's client is doing the right thing by validating on the way in and refusing to build on malformed data. The problem is that my contract never said which fields could be absent, so "absent" and "malformed" were indistinguishable to it. That's my omission, and this amendment closes it properly rather than patching the two known cases.

---

## 1. Nullability, stated once and for all

Only these are guaranteed present and non-empty:

**`slug`, `date`, `name`, and `blocks` (the array itself — which may be empty).**

Everything else may be null: `focus`, `duration_min`, `duration_max`, `blocks[].prescription`, `blocks[].name`, `movements[].detail`.

**Never emit an empty string.** Trim on the way out and serialize `""` as `null`. An empty string and a missing value read the same to a human and differently to a validator, which is exactly the confusion that produced this amendment.

`name` stays required because it is the `<h1>` and the slug source. A template with an empty name refuses to publish, with the same readable message as a slug collision — the site never ships a nameless workout.

### The two live cases

- **`focus` null on 26 of 76 templates.** Declared nullable. Track B omits the standfirst — no empty element, no placeholder, no repeating the name. Your reasoning was right and it is the third time this pattern has come up: making Evan write a focus line to satisfy the website would be mutating app data for the site's benefit.
- **`prescription` null on 30 of 375 blocks.** Declared nullable. Track B renders the block name alone and drops the right-hand column, without collapsing the row or disturbing the alignment of its neighbours. Cool-downs and mobility blocks are the ordinary case, not an error.

### Two counts I need before this is closed

You have the data and I don't, so these are yours to check — same method as the two above:

1. **Can `blocks[].name` (`block_label`) be null, and on how many blocks?** I've listed it nullable on the assumption it can be. If it can't, say so and it moves to the required column.
2. **Can a published template have zero blocks, or a block have zero movements?** Both are already legal in the shape as written; I want to know whether they occur, because "legal but never happens" and "legal and happens on nine templates" call for different amounts of care in Track B's renderer.

## 2. The build-failure rule was wrong — mine, not theirs

Track B's client aborts on an empty archive because `02-HANDOFF` §3 told it to: *"If the API is unreachable at build time, fail the build. Do not deploy a site with a silently empty archive."*

That sentence conflated two conditions, and the strict reading of it — which is the faithful one — means a **content** state can take the site offline. Unpublish everything by accident and the next build fails rather than showing an empty archive. That is the wrong failure mode: availability should never depend on content.

Corrected:

- **Fail the build** on unreachable, non-2xx, or payload that fails validation. Broken plumbing. This is what the original rule was actually protecting against.
- **Do not fail** on zero published workouts. Build, render an honest empty state, log a loud warning.

This also dissolves the sequencing note — the first real build no longer requires a published workout. Publishing one before cutover is still a good idea, but it's now a choice rather than a gate.

## 3. The three no-decision items — confirmed

- **`limit` accepts 100.** Default 50, maximum 100, clamp above it, reject below 1. Patched into §3.
- **`next_cursor` is null on the last page.** Never echo the final cursor. Track B pages until null and aborts on a repeat, which is correct client behavior and the spec should have said so explicitly.
- **Empty archive** — see §2. No longer a gate.

## 4. Fixtures — yes, please produce them

Accepted, and this is the more valuable half of your message. Produce the fixture **set**, not a single happy-path file:

- a fully-populated workout,
- one with `focus` null,
- one with at least one block whose `prescription` is null,
- one with an empty `blocks` array,
- and whatever the answers to §1's two counts turn out to warrant.

Generated from real published templates, not hand-authored. Bump `_contract_version` to `2026-09-09.3`. A validator tested against the happy path is a validator that will fail in production, which is precisely what just nearly happened.

## 5. Housekeeping

Their docs folder has the same stale-duplicate problem yours did — two copies of the Track A handoff, only the one marked `2` current. Tell them directly; that's a clarification, not a decision, and it's exactly the traffic the direct channel exists for.

The shared fixture being byte-identical across both repos on the same contract version is the handshake working. Worth noting that it held right up until the moment the contract needed to change — and then this amendment is how it changes, in one place, for both.

---

## Still Evan's, unchanged

Preview origin, dashboard rate limit rule, deploy hook secret, and confirmation of the date decision.
