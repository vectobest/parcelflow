/**
 * Centralises and validates environment configuration in one place so the
 * rest of the app never reads `process.env` directly, and so a bad
 * configuration fails fast at startup instead of misbehaving at runtime.
 */
export class Config {
  constructor(env = process.env) {
    this.port = Number(env.PORT || 4173);
    this.nodeEnv = env.NODE_ENV || 'development';
    this.authMode = env.AUTH_MODE || 'demo';
    this.authTokens = env.AUTH_TOKENS || '';
    this.apiConcurrency = Number(env.API_CONCURRENCY || 8);
    this.rateLimitWindowMs = Number(env.RATE_LIMIT_WINDOW_MS || 60_000);
    this.rateLimitMax = Number(env.RATE_LIMIT_MAX || 300);
    this.corsOrigin = env.CORS_ORIGIN || false;
    this.maxBatchSize = Number(env.MAX_BATCH_SIZE || 5000);
    this.#validate();
  }

  #validate() {
    const errors = [];
    if (!Number.isInteger(this.port) || this.port <= 0) errors.push('PORT must be a positive integer.');
    if (!Number.isInteger(this.apiConcurrency) || this.apiConcurrency < 1) errors.push('API_CONCURRENCY must be a positive integer.');
    if (!Number.isInteger(this.maxBatchSize) || this.maxBatchSize < 1) errors.push('MAX_BATCH_SIZE must be a positive integer.');
    if (!['demo', 'production'].includes(this.authMode)) errors.push('AUTH_MODE must be "demo" or "production".');
    if (errors.length) throw new Error(`Invalid configuration: ${errors.join(' ')}`);
  }

  get isProduction() {
    return this.nodeEnv === 'production';
  }
}
