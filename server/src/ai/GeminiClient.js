import { GoogleGenAI } from '@google/genai';

const MIN_COOLDOWN_MS = 60_000;

/** Thrown instead of calling Gemini while the account is over its quota, so callers fall back immediately. */
export class GeminiQuotaError extends Error {
  constructor(retryAt) {
    super('Gemini quota exhausted.');
    this.name = 'GeminiQuotaError';
    this.retryAt = retryAt;
  }
}

// "Please retry in 17.87s" -> 17870 ms; Google includes this hint in 429 messages.
function retryHintMs(message) {
  const match = /retry in ([\d.]+)s/i.exec(String(message));
  return match ? Math.ceil(Number(match[1]) * 1000) : 0;
}

/**
 * Thin wrapper around the Gemini SDK -- the one place that knows this is
 * Gemini specifically, so nothing else in the codebase imports
 * `@google/genai` directly (Dependency Inversion, same reasoning as
 * `AuthenticationService` wrapping bearer-token auth).
 *
 * After a 429 it stops calling Gemini until Google's retry hint (at least a
 * minute) has passed; every call in that window throws GeminiQuotaError
 * without a network request, so a busy page can't keep burning the quota.
 */
export class GeminiClient {
  #client;
  #model;
  #cooldownUntil = 0;

  constructor({ apiKey, model }) {
    this.#client = new GoogleGenAI({ apiKey });
    this.#model = model;
  }

  async generateContent({ contents, systemInstruction, tools, toolConfig }) {
    if (Date.now() < this.#cooldownUntil) throw new GeminiQuotaError(this.#cooldownUntil);
    try {
      return await this.#client.models.generateContent({
        model: this.#model,
        contents,
        config: { systemInstruction, tools, toolConfig }
      });
    } catch (error) {
      if (error?.status === 429) {
        this.#cooldownUntil = Date.now() + Math.max(MIN_COOLDOWN_MS, retryHintMs(error.message));
        throw new GeminiQuotaError(this.#cooldownUntil);
      }
      throw error;
    }
  }
}
