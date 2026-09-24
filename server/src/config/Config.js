/**
 * Central, validated configuration. Nothing else in the codebase reads
 * `process.env` directly -- this is the one seam a test or a future
 * secrets manager needs to replace (Dependency Inversion).
 */
export class Config {
  constructor(env = process.env) {
    this.nodeEnv = env.NODE_ENV || 'development';
    this.port = Number(env.PORT || 4000);
    this.clientOrigin = env.CLIENT_ORIGIN || 'http://localhost:5173';

    this.sessionSecret = env.SESSION_SECRET || 'dev-only-insecure-session-secret-change-me';
    this.googleClientId = env.GOOGLE_CLIENT_ID || '';
    this.googleClientSecret = env.GOOGLE_CLIENT_SECRET || '';
    this.googleCallbackUrl = env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/auth/google/callback';
    this.oauthEnabled = Boolean(this.googleClientId && this.googleClientSecret);

    this.adminEmails = (env.ADMIN_EMAILS || '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean);
    this.reviewerEmails = (env.REVIEWER_EMAILS || '').split(',').map((email) => email.trim().toLowerCase()).filter(Boolean);
    this.serviceTokens = env.SERVICE_TOKENS || '';

    this.geminiApiKey = env.GEMINI_API_KEY || '';
    this.geminiModel = env.GEMINI_MODEL || 'gemini-flash-latest';
    this.aiEnabled = Boolean(this.geminiApiKey);

    this.maxUploadBytes = Number(env.MAX_UPLOAD_BYTES || 5 * 1024 * 1024);
    this.maxBatchSize = Number(env.MAX_BATCH_SIZE || 5000);
    this.maxRetries = Number(env.MAX_RETRIES || 3);
    this.apiConcurrency = Number(env.API_CONCURRENCY || 32);
    this.rateLimitWindowMs = Number(env.RATE_LIMIT_WINDOW_MS || 60_000);
    this.rateLimitMax = Number(env.RATE_LIMIT_MAX || 300);

    const errors = this.#validate();
    if (errors.length) throw new Error(`Invalid configuration: ${errors.join(' ')}`);
  }

  #validate() {
    const errors = [];
    if (!Number.isInteger(this.port) || this.port <= 0) errors.push('PORT must be a positive integer.');
    if (!Number.isInteger(this.maxUploadBytes) || this.maxUploadBytes <= 0) errors.push('MAX_UPLOAD_BYTES must be a positive integer.');
    if (!Number.isInteger(this.maxBatchSize) || this.maxBatchSize <= 0) errors.push('MAX_BATCH_SIZE must be a positive integer.');
    return errors;
  }
}
