import { BearerTokenStrategy } from './strategies/BearerTokenStrategy.js';
import { DemoHeaderStrategy } from './strategies/DemoHeaderStrategy.js';
import { AuthenticationError } from '../errors/index.js';

/**
 * Picks the first strategy that supports the incoming request (Strategy
 * pattern). Bearer tokens are always accepted; the permissive demo header
 * fallback is only registered in demo mode, so a production deployment can
 * never be authenticated by a spoofable header.
 */
export class AuthenticationService {
  #mode;
  #strategies;

  constructor({ mode = 'demo', tokens = '' } = {}) {
    this.#mode = mode;
    this.#strategies = [new BearerTokenStrategy(tokens)];
    if (mode === 'demo') this.#strategies.push(new DemoHeaderStrategy());
  }

  authenticate(request) {
    const strategy = this.#strategies.find((candidate) => candidate.supports(request));
    if (!strategy) throw new AuthenticationError('Bearer authentication is required.');
    return strategy.authenticate(request);
  }

  get mode() { return this.#mode; }
  get configuredCredentialCount() { return this.#strategies[0]?.configuredCredentialCount ?? 0; }
}
