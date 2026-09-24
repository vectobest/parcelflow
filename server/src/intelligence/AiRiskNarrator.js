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
 */
export class AiRiskNarrator {
  #gemini;
  #riskService;

  constructor({ gemini, riskService }) {
    this.#gemini = gemini;
    this.#riskService = riskService;
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
      const response = await this.#gemini.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        systemInstruction: NARRATOR_INSTRUCTION
      });
      const text = response?.text?.trim();
      if (!text) return { ...base, source: 'heuristic' };
      return { ...base, message: text, source: 'gemini' };
    } catch {
      return { ...base, source: 'heuristic' };
    }
  }
}
