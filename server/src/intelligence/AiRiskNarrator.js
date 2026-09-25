import { GeminiQuotaError } from '../ai/GeminiClient.js';

const CACHE_LIMIT = 50;

/** Why a response used the built-in wording, in words an operator can act on. */
export function aiFallbackNote(error) {
  return error instanceof GeminiQuotaError
    ? 'Gemini has reached its usage limit, so this uses the built-in wording. It will try again automatically.'
    : 'Gemini could not be reached, so this uses the built-in wording.';
}

const NARRATOR_INSTRUCTION = 'You are a concise operations analyst writing for a non-technical parcel-routing operator. You only rephrase the evidence you are given into plain business language; you never add a fact, number, or cause that was not explicitly listed for you.';

/**
 * Wraps RiskService to optionally rewrite its `message` in plain language
 * via Gemini -- the risk level, confidence score, and evidence list stay
 * exactly what the deterministic heuristic computed (see RiskService).
 * Gemini is only ever asked to explain evidence it is handed, never to
 * decide the risk level itself: that keeps the actual detection testable
 * and reproducible, and confines the LLM to the one thing it's good at
 * here -- turning a few evidence strings into a clear sentence -- see
 * docs/decisions/ADR-009 for why this line was drawn where it was.
 *
 * On any failure (network, bad response, empty text) this silently
 * returns the heuristic's own message unchanged -- narration is a nicety,
 * never a dependency for the risk panel to work.
 *
 * Narrations are cached by their exact prompt in a map shared across
 * instances (the composition root passes one in), so unchanged evidence is
 * never sent to Gemini twice -- important on a free tier of ~20 requests.
 */
export class AiRiskNarrator {
  #gemini;
  #riskService;
  #cache;

  constructor({ gemini, riskService, cache = new Map() }) {
    this.#gemini = gemini;
    this.#riskService = riskService;
    this.#cache = cache;
  }

  async assess() {
    const base = this.#riskService.assess();
    if (base.level === 'INSUFFICIENT_DATA' || base.evidence.length === 0) return { ...base, source: 'heuristic' };

    try {
      const prompt = `Risk level: ${base.level}
Confidence: ${base.confidence}%
Evidence:
${base.evidence.map((e) => `- ${e}`).join('\n')}
Heuristic recommendation: ${base.recommendation}

Write two short sentences for an operator: what's happening, and what to do about it. Use only the facts above.`;
      if (this.#cache.has(prompt)) return { ...base, message: this.#cache.get(prompt), source: 'gemini' };
      const response = await this.#gemini.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        systemInstruction: NARRATOR_INSTRUCTION
      });
      const text = response?.text?.trim();
      if (!text) return { ...base, source: 'heuristic' };
      if (this.#cache.size >= CACHE_LIMIT) this.#cache.delete(this.#cache.keys().next().value);
      this.#cache.set(prompt, text);
      return { ...base, message: text, source: 'gemini' };
    } catch (error) {
      return { ...base, source: 'heuristic', aiNote: aiFallbackNote(error) };
    }
  }
}
