# ADR-009: Where Gemini is allowed to touch the system, and where it isn't

## Problem
The brief asked to "integrate AI" into the Operations Assistant and the Risk/Prediction engine. Both already had deliberately non-LLM implementations (`OperationsAssistantService` pattern-matching, `RiskService` computing plain statistics) specifically because an earlier design pass (see AI_USAGE.md) concluded that without careful grounding, an LLM asked to "predict risk" or "answer operational questions" will produce confident-sounding sentences that aren't actually true. Adding a real model without changing that risk would contradict everything the rest of this app stands for (see the master prompt's own "never manufacture confidence" principle, and section 27/28's assistant rules).

## Options considered
1. Replace the heuristic risk detector with a model that outputs a risk level and confidence directly from raw data.
2. Give the assistant a general-purpose chat interface with the whole app's data dumped into its context window.
3. Bound Gemini's involvement to two narrow, verifiable roles: (a) a tool-calling agent for the assistant that can only state facts it retrieved through a tool call, and (b) a narrator for the risk engine that rephrases evidence the heuristic already computed, never invents the evidence or the score itself.

## Decision
Option 3, on both fronts:

- **`AiOperationsAssistantService`** (`server/src/assistant/AiOperationsAssistantService.js`) gives Gemini a fixed set of read-only tools (`get_policy`, `get_batch`, `get_incident`, `list_incidents`, `assess_risk`, `get_failure_dna`, `run_digital_twin`, `list_recent_batches`), each a thin wrapper over a real service method. The system instruction is explicit: only state what a tool returned, always cite the IDs, refuse rather than guess. If Gemini ever fails to produce a grounded answer -- empty response, a thrown error, an unreachable API -- the request falls straight through to the original deterministic `OperationsAssistantService`, which becomes the mandatory fallback rather than a separate code path that might rot.
- **`AiRiskNarrator`** (`server/src/intelligence/AiRiskNarrator.js`) never lets Gemini see raw batch data or decide a risk level. It calls the real `RiskService.assess()` first, and only if there's already-detected evidence does it ask Gemini to turn that evidence into two clear sentences -- the `level`, `confidence`, and `evidence` array in the response are always the heuristic's own output, untouched. `FailureDnaService` was deliberately left heuristic-only rather than also wired into a narrator, since two narrated surfaces with slightly different LLM interaction patterns wasn't worth the added surface area for this pass.

Both integrations are optional at runtime: `Config.aiEnabled` is `true` only when `GEMINI_API_KEY` is set, matching the same graceful-degradation pattern as `Config.oauthEnabled` (ADR-006). Every AI-touched response carries a `source: 'gemini' | 'heuristic'` field, surfaced in the UI as a small badge -- so nobody has to guess which path actually answered a given question or risk read.

## Trade-offs
- The assistant can still only answer questions its tool set covers. A genuinely new kind of question needs a new tool, the same way the old pattern-matcher needed a new regex -- Gemini adds reasoning about *which* tools to call and how to phrase the answer, not new data access.
- Narrating risk evidence costs one Gemini call per `/api/risk` request instead of zero. This endpoint is only hit when a human opens the Risk & Predictions page, not on the 15-second dashboard poll (`DashboardService` still calls the raw, synchronous `RiskService` directly for the Overview page's health rollup) -- a deliberate choice to keep the always-on polling path free, fast, and fully offline-capable.
- Neither integration can be unit-tested against the real Gemini API without a live key and network access. Both are tested instead against a fake `GeminiClient` that returns scripted responses (`server/tests/unit/aiAssistantAndRiskNarrator.test.js`), which verifies the tool-calling loop, the grounding behavior, and every fallback path deterministically and offline.

## Consequences
- `npm test` never needs a `GEMINI_API_KEY` to pass; CI and anyone cloning the repo get full coverage of the integration logic without one.
- Turning AI on or off is a single environment variable, with zero code branches a developer has to remember to update -- the container picks the implementation once, at startup, in `container.js`.
