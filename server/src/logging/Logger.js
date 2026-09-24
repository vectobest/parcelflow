const SENSITIVE_KEYS = new Set(['password', 'token', 'accesstoken', 'access_token', 'secret', 'authorization', 'cookie', 'clientsecret', 'client_secret']);

function mask(value, depth = 0) {
  if (depth > 4 || value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map((item) => mask(item, depth + 1));
  if (typeof value === 'object') {
    const out = {};
    for (const [key, val] of Object.entries(value)) {
      out[key] = SENSITIVE_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : mask(val, depth + 1);
    }
    return out;
  }
  return value;
}

/**
 * Structured JSON logger. Every line is one event, so it's greppable and
 * ingestible by any log pipeline. Sensitive fields are masked before they
 * ever reach stdout (never log secrets -- see the threat model in
 * docs/THREAT_MODEL.md).
 */
export class Logger {
  #name;
  #clock;

  constructor({ name = 'parcelflow', clock = () => new Date() } = {}) {
    this.#name = name;
    this.#clock = clock;
  }

  #write(level, event, fields) {
    const line = { timestamp: this.#clock().toISOString(), level, service: this.#name, event, ...mask(fields) };
    process.stdout.write(`${JSON.stringify(line)}\n`);
  }

  info(event, fields = {}) { this.#write('info', event, fields); }
  warn(event, fields = {}) { this.#write('warn', event, fields); }
  error(event, fields = {}) { this.#write('error', event, fields); }
}
