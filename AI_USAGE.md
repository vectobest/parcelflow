# AI Usage

This document explains how I used AI while building ParcelFlow. It covers what I used it for, the decisions I made myself, how I checked the results, and what AI is and isn't allowed to do inside the running application.

## How I used AI

I used an AI assistant at several points in this project, mainly as a research tool. I stayed in charge of the work throughout: I decided what to build and how, made the design decisions, and reviewed, changed and tested everything before keeping it.

- **Research before deciding.** I compared approaches for:
  - making routing rules changeable without code changes
  - reading uploaded XML safely
  - stopping the same file from being processed twice
  - grouping many failures into one incident
  - limiting what an AI feature inside the app is allowed to do
- **Investigating problems.** When something behaved unexpectedly, I used it to help trace the cause, then chose the fix myself.
- **Drafting.** It produced first versions of some code, tests and documentation. I reviewed each one, rewrote parts that didn't fit the design, and tested the result in the app.

Product decisions were never left to the AI: what each role may do, how rule changes are approved, and how uncertain data is handled.

## Decisions I made

These shaped the whole system:

- **In-memory storage behind small interfaces, no database.** It keeps the project easy to run and review. Swapping in a database later only means replacing the storage classes. See [ADR-007](docs/decisions/ADR-007-in-memory-persistence.md).
- **Real Google sign-in, with a local sign-in only for development.** The local sign-in is refused as soon as Google sign-in is configured, so it can't become a backdoor. See [ADR-006](docs/decisions/ADR-006-oauth-with-dev-fallback.md).
- **No fake "generic rule builder".** An early idea was a rule builder for any kind of condition. The system doesn't have a general rule language, so I kept the conflict checker to the real rule model instead of building something that looked more capable than it was. See [ADR-008](docs/decisions/ADR-008-rule-conflict-scope.md).
- **Retries based on what can actually be fixed.** An early suggestion retried failed parcels blindly. Routing always gives the same answer for the same parcel and policy, so that would fail the same way every time. I redesigned it so each failure is marked as fixed, needing a human, or given up on after three attempts. See [ADR-004](docs/decisions/ADR-004-retry-strategy.md).
- **Per-role data.** When a new user saw everyone's parcels, I compared per-user, per-role and shared data and chose per-role. Operators see only their own data. Reviewers and admins see everything, because reviewers must approve other people's parcels.
- **Don't guess the country.** Real container XML files have no country field. I chose to set NL only when the postcode is clearly Dutch, and reject everything else.

## Example prompts and what I decided

**1. Data visible to new users**
> "Why is data showing 243 parcels even for a new user who hasn't uploaded anything? Fix this."

- **Finding:** all users were reading from one shared data store.
- **My decision:** per-role data, as described above.
- **How I checked it:** I signed in as a brand-new operator and confirmed the dashboard started empty. I also added tests for it.

**2. A real shipment file failing to upload**
> "Uploading gives the error 'parcels not between 1 and 5000'."

- **Finding:** the file used a container format the reader didn't recognise, and that format has no country field.
- **My decision:** read the container format, set the country to NL only from Dutch postcodes, and show a clear message when a file has no parcels.

**3. The AI feature not working**
> "Why is my AI thing not working? I gave you the API key."

- **Finding:** the key was fine, but the free quota (20 requests) was used up because the risk panel called the AI on every page load.
- **My decision:** reuse answers when nothing has changed, pause for at least a minute after a quota error, and tell the user when AI is unavailable instead of failing silently.

**4. Making the UI usable for non-technical operators**
> A longer brief asking for a compact layout, business language, names instead of emails, and honest loading states.

- **My decision:** I reviewed every screen, rejected designs that looked generic, and kept refining until text and buttons were readable in both themes.

## How I checked the work

- **Automated tests.** 96 server tests and 13 client tests, run after every change. The server tests include six "must never break" rules, such as "an invalid parcel is never routed" and "every change is written to the audit log".
- **Using the app in a real browser.** After each change I clicked through the affected screens, in both themes and at phone width.
- **Real data.** I uploaded an actual shipment file and checked every result by hand.
- **Live security check.** The Security Center runs eight real attack attempts against the running app and shows whether each was blocked.

### Bugs found by hand that the tests missed

1. **A sign-in library shared between test runs.** The sign-in library keeps one shared copy for the whole process. Each test setup added to it, which caused random sign-in failures in tests. I gave each setup its own copy.
2. **Requests sent with the wrong method.** Several screens sent data without saying it was a POST request, so the browser refused them and the app wrongly reported that the server couldn't be reached. I fixed the shared request helper so it always uses POST when sending data, which fixed every screen at once.

Both bugs sat between parts that each passed their own tests. That's why I check the app by hand as well.

## AI inside the application

The app has two optional AI features: the Ops Assistant and plain-language wording for the risk summary. They are off unless an API key is set, and the app works fully without them.

### What it is allowed to do

- **Read and explain.** The assistant can only use a fixed set of read-only lookups: a policy, a batch, recent batches, an incident, the incident list, the risk summary, failure patterns and a capacity projection. It must base its answer on what those lookups return.
- **Reword risk evidence.** For the risk panel, the level, confidence and evidence always come from the built-in rules. The AI can only rewrite that evidence in plainer words.

### What it can never do

- approve or reject a parcel
- create, activate or roll back a policy
- change a user's role
- edit or delete the audit log
- turn off any security check

None of these actions is available to it, so it can't do them even by mistake.

### When it fails

If the AI returns nothing, returns an error or runs out of quota, the app falls back to its built-in answers and shows a short note explaining why. Every answer is labelled as coming from the AI or from the built-in rules, so nobody has to guess.

## Why risk detection doesn't use machine learning

Risk and incident detection use simple, visible rules, such as "the failure rate rose across the last five batches". There is no historical data to train a model on, and operators need to understand why something was flagged. With too little data, the system says "insufficient data" instead of guessing. Calling this "AI prediction" would be overclaiming.

## Limitations of AI in this project

- AI can't make business decisions, such as who may approve high-value parcels, how long data must be kept, or how much risk is acceptable. Those need people.
- AI suggestions can look right and still be wrong. Nothing was kept without being run, tested and checked in the browser.
- AI tends to miss problems in how separate parts connect, even when each part passes its own tests.
- Free AI tiers are small, so the product has to work well without AI, and it does.
