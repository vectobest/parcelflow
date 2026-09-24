import { DEFAULT_ROLE } from './roles.js';

/**
 * In-memory user directory keyed by email (the app runs without a
 * database by request -- see docs/decisions/ADR-007). Role assignment is
 * seeded from ADMIN_EMAILS/REVIEWER_EMAILS in config on first sign-in, and
 * can be changed afterwards by an admin via UserStore.setRole -- but it
 * does not survive a server restart, which is the explicit trade-off of
 * staying in-memory.
 */
export class UserStore {
  #users = new Map();
  #adminEmails;
  #reviewerEmails;
  #clock;

  constructor({ adminEmails = [], reviewerEmails = [], clock = () => new Date() } = {}) {
    this.#adminEmails = new Set(adminEmails);
    this.#reviewerEmails = new Set(reviewerEmails);
    this.#clock = clock;
  }

  findOrCreate({ email, name, avatarUrl, provider }) {
    const key = email.toLowerCase();
    const existing = this.#users.get(key);
    if (existing) return existing;
    const role = this.#adminEmails.has(key) ? 'ADMIN' : this.#reviewerEmails.has(key) ? 'REVIEWER' : DEFAULT_ROLE;
    const user = { email: key, name, avatarUrl, provider, role, createdAt: this.#clock().toISOString() };
    this.#users.set(key, user);
    return user;
  }

  get(email) { return this.#users.get(email?.toLowerCase()); }
  list() { return [...this.#users.values()]; }

  setRole(email, role) {
    const user = this.#users.get(email?.toLowerCase());
    if (!user) return null;
    const updated = { ...user, role };
    this.#users.set(updated.email, updated);
    return updated;
  }
}
