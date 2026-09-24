import { DEFAULT_ROLE } from './roles.js';

/**
 * In-memory user directory keyed by email (the app runs without a
 * database by request -- see docs/decisions/ADR-007). Role assignment on
 * first sign-in is decided in this priority order: an admin-preset role
 * for that email (see presetRole), then ADMIN_EMAILS/REVIEWER_EMAILS in
 * config, then DEFAULT_ROLE. Roles can be changed afterwards by an admin
 * via UserStore.setRole -- but none of this survives a server restart,
 * which is the explicit trade-off of staying in-memory.
 */
export class UserStore {
  #users = new Map();
  #pendingRoles = new Map();
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
    const preset = this.#pendingRoles.get(key);
    const role = preset || (this.#adminEmails.has(key) ? 'ADMIN' : this.#reviewerEmails.has(key) ? 'REVIEWER' : DEFAULT_ROLE);
    const user = { email: key, name, avatarUrl, provider, role, createdAt: this.#clock().toISOString() };
    this.#users.set(key, user);
    this.#pendingRoles.delete(key);
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

  /** An admin assigns a role to an email that hasn't signed in yet -- applied automatically on that email's first sign-in instead of falling back to DEFAULT_ROLE. */
  presetRole(email, role) {
    const key = email.toLowerCase();
    if (this.#users.has(key)) return null;
    this.#pendingRoles.set(key, role);
    return { email: key, role };
  }

  removePendingRole(email) {
    return this.#pendingRoles.delete(email?.toLowerCase());
  }

  listPendingRoles() {
    return [...this.#pendingRoles.entries()].map(([email, role]) => ({ email, role }));
  }
}
