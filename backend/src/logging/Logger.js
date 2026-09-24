/**
 * A tiny structured logger. Every entry is one JSON line with a timestamp,
 * level, service name and event name, which is what a log aggregator
 * (CloudWatch, Datadog, ELK, ...) expects -- this is the "sufficient
 * visibility when something goes wrong" requirement from the brief.
 */
export class Logger {
  constructor({ name = 'app', clock = () => new Date() } = {}) {
    this.name = name;
    this.clock = clock;
  }

  #write(level, event, fields = {}) {
    const line = JSON.stringify({ timestamp: this.clock().toISOString(), level, service: this.name, event, ...fields });
    if (level === 'error') console.error(line);
    else console.log(line);
  }

  info(event, fields) { this.#write('info', event, fields); }
  warn(event, fields) { this.#write('warn', event, fields); }
  error(event, fields) { this.#write('error', event, fields); }
}
