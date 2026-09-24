import { GoogleGenAI } from '@google/genai';

/**
 * Thin wrapper around the Gemini SDK -- the one place that knows this is
 * Gemini specifically, so nothing else in the codebase imports
 * `@google/genai` directly (Dependency Inversion, same reasoning as
 * `AuthenticationService` wrapping bearer-token auth).
 */
export class GeminiClient {
  #client;
  #model;

  constructor({ apiKey, model }) {
    this.#client = new GoogleGenAI({ apiKey });
    this.#model = model;
  }

  generateContent({ contents, systemInstruction, tools, toolConfig }) {
    return this.#client.models.generateContent({
      model: this.#model,
      contents,
      config: { systemInstruction, tools, toolConfig }
    });
  }
}
