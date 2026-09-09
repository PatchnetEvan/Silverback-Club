# Coordination — two coders, one contract

**Date:** 9 Sep 2026
**Read by:** Evan, plus both coders

Two people are building this, one per repo. That changes how the docs should move. Short answer to the question: **no, don't keep both doc sets in sync between the coders.** Syncing prose between two people is how the contract drifts, and it makes you the message bus — which is the part that fails first when you're busy.

Instead: one owner per document, one shared artifact, and the shared artifact is a file that fails a test when it changes, not a paragraph someone has to notice.

---

## Who owns what

| Document | Owner | The other coder |
|---|---|---|
| `00-READ-FIRST.md` | Evan | Both read it. Nobody edits it but Evan. |
| `01-HANDOFF-321-public-api.md` | **3-2-1 coder** | Track B never needs to read past §4. |
| `02-HANDOFF-silverback-site.md` | **silverback coder** | Track A never needs to read it at all. |
| `03-design-tokens.css` | silverback coder | Not Track A's business. |
| `04-AMENDMENT-01.md`, `05-AMENDMENT-02.md` | 3-2-1 coder | Both were Track A. Track B's delta is §"What changed for Track B" below. |
| `workout.example.json` | **3-2-1 coder produces it. silverback coder consumes it.** | This is the only shared artifact. |

Everything so far has been Track A traffic. The silverback coder has received two amendments' worth of detail they mostly didn't need, and one three-line change they did.

## The contract is a file, not a paragraph

`workout.example.json` is the handshake.

- It lives in the **3-2-1 repo** as the canonical copy, generated from a real published template so it can't drift from reality.
- It is copied into the **site repo** as `test/fixtures/workout.example.json`, and the site's build test renders it.
- **Track A owns its content. Track B never edits it.** When Track A changes the payload, it updates the fixture, Track B's test fails, and that failure is the notification. No email, no doc sync, no relying on either of them reading an amendment.
- `_contract_version` is a date-stamped string. Bump it on any shape change. It exists so a mismatch is obvious in a diff.

The prose lives in one place — `docs/silverback/` in the 3-2-1 repo — and the site repo gets a one-line README pointer, not a copy.

## What changed for Track B (the whole delta, so far)

The silverback coder needs exactly this much out of both amendments:

1. `date` is the **session date** (the day it was programmed/run), not the publish date. Now backed by a `public_date` column on Track A's side; irrelevant to you except that the value means what it says.
2. `est_minutes` is gone. Use integer `duration_min` / `duration_max`, either nullable. Format per `02-HANDOFF` §4: `60–75 min`, `60 min` when equal or single, omitted when both null.
3. Blocks have **no** `notes` field. Don't code a conditional for it.

Plus the labelling rule already in `02-HANDOFF` §4: `/api/public/today` can return an older session as a fallback, so the panel says *"Latest session · Monday 7 September"* unless the date really is today.

## Track B is not blocked — start now

I said earlier that Track A goes first because Track B can't be tested without the contract. **That was true before the contract was settled. It isn't now.**

The silverback coder should build against `workout.example.json` served by a local mock — the whole site, end to end, including the archive and the today panel with its fallback labelling. Swap the mock for the real origin when Track A ships. This genuinely parallelizes the two tracks instead of leaving one person idle for a week.

The only thing Track B truly cannot finish without Track A is the deploy-hook verification, which was already assigned to Track B's PR.

## Routing rule going forward

- Anything that changes the **payload shape** is a contract change: I author one amendment, it goes to both coders, and the fixture bumps. Neither coder changes the shape unilaterally.
- Anything inside one repo is that coder's call, and the other never hears about it.
- Amendments get a **TRACK: A / B / BOTH** line at the top from here on, so nobody spends twenty minutes deciding whether a document is theirs.

## One thing for you to decide

Should the two coders talk to each other directly on contract questions, with you copied?

My recommendation is yes. The alternative is that every question routes through you, and the failure mode isn't that you get it wrong — it's latency. A question that would take ten minutes between two engineers takes a day when it waits for you to be free. Keep the *decisions* yours (anything that changes what gets built, and every payload change), but let the clarifications go direct.

If you'd rather stay in the middle, that's workable — just say so, and I'll write the amendments to be self-contained enough that neither coder needs to ask the other anything.
