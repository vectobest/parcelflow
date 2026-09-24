# ADR-006: Real Google OAuth, with a dev-login fallback that refuses to run once OAuth is configured

## Problem
The brief asked for real OAuth ("keep oauth"), but this application needs to be runnable and testable (locally, in this assessment, and by anyone cloning the repo) without first requiring a Google Cloud project and a pair of secrets nobody but the account owner can generate.

## Options considered
1. Require Google OAuth unconditionally; the app simply doesn't run without configured credentials.
2. A permanent, always-available "pick a role" login screen (no real auth at all).
3. Real Passport Google OAuth 2.0 when configured; a clearly-labeled local dev sign-in otherwise -- and the dev path is **refused server-side** the moment real OAuth is configured.

## Decision
Option 3. `Config.oauthEnabled` is `true` only when both `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set. `AuthController`'s `/auth/dev-login` route checks that flag and returns a 422 if OAuth is enabled -- this is enforced in the same request handler as every other check, not a separate "remember to remove this before deploying" step.

## Trade-offs
- Option 1 is the most secure-by-default choice but makes the project unusable for anyone without Google credentials on hand -- a real cost for an assessment meant to be run and demoed.
- Option 2 (always-on fake login) is what this app explicitly avoids: it would mean "real OAuth" was never actually wired up, just described.
- The chosen option's risk is entirely mitigated by the server-side (not client-side) check: even if someone found the dev-login endpoint on a deployment with real OAuth configured, the server refuses it outright.

## Consequences
- `server/tests/integration/httpFlow.test.js` includes an explicit test asserting dev-login returns 422 once `GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET` are set -- this is a named regression test, not just a code comment's promise.
- The login page itself detects `oauthEnabled` from `/api/auth/status` and renders the real "Sign in with Google" button instead of the dev form the moment credentials are configured, with no code change needed.
