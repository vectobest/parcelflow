import { Policy, POLICY_STATES } from '../domain/Policy.js';
import { ValidationError, ConflictError, NotFoundError } from '../errors/index.js';

/**
 * Application service coordinating the policy lifecycle (SRP: only policy
 * state transitions live here). Depends on PolicyRepository, an
 * abstraction (DIP) -- tests inject an in-memory fake without any of this
 * business logic changing.
 *
 * Lifecycle: DRAFT -> VALIDATED -> APPROVED -> ACTIVE -> (ROLLED_BACK), and a
 * ROLLED_BACK policy can be activated again directly -- an admin bringing
 * back an older version on purpose, not just an automatic rollback fallback.
 * An ACTIVE policy is immutable; every change is a brand new version.
 * Exactly one policy is ever ACTIVE at a time: activating one demotes
 * whatever was active a moment before to ROLLED_BACK, so a version's own
 * `state` field is always the true source of truth, not just `#activeVersion`.
 */
export class PolicyService {
  #repository;
  #clock;
  #activeVersion = null;

  constructor({ repository, clock = () => new Date() }) {
    this.#repository = repository;
    this.#clock = clock;
  }

  /**
   * Seeds the store with the initial, already-active policy -- but only on a genuinely empty
   * store (a fresh in-memory run, or a brand-new database). Called on every boot regardless of
   * whether the repository already has history behind it (a persistent database, reconnected
   * after a restart); it must never re-seed and overwrite real data with the hardcoded default,
   * which would silently force the wrong version back to active. When history already exists,
   * the real active version is recovered from the data itself -- whichever policy's own `state`
   * is ACTIVE, most-recently-activated first if more than one is (self-healing any duplicate
   * left over from before that was itself a bug, not a feature -- see docs/decisions/ADR-002).
   */
  bootstrap(initialPolicyAttrs) {
    const existing = this.#repository.list();
    if (existing.length === 0) {
      const now = this.#clock().toISOString();
      const initial = new Policy({ ...initialPolicyAttrs, state: POLICY_STATES.ACTIVE, createdBy: 'system', createdAt: now, activatedAt: now });
      const validation = Policy.validate(initial);
      if (!validation.valid) throw new ValidationError(validation.errors.join(' '));
      this.#repository.save(initial);
      this.#activeVersion = initial.version;
      return this;
    }

    const activeCandidates = existing.filter((policy) => policy.state === POLICY_STATES.ACTIVE);
    const winner = [...activeCandidates].sort((a, b) => new Date(b.activatedAt || 0) - new Date(a.activatedAt || 0))[0];
    if (winner) {
      this.#activeVersion = winner.version;
      for (const stale of activeCandidates) {
        if (stale.version !== winner.version) this.#repository.save(stale.withState(POLICY_STATES.ROLLED_BACK, this.#clock));
      }
    }
    return this;
  }

  get(version) { return this.#repository.get(version || this.#activeVersion); }
  getActive() { return this.get(); }
  list() { return this.#repository.list(); }
  activeVersion() { return this.#activeVersion; }
  validate(version) { return Policy.validate(this.get(version)); }

  createDraft(attrs, { actor = 'system' } = {}) {
    const validation = Policy.validate(attrs);
    if (this.#repository.has(attrs?.version)) throw new ConflictError(`Policy ${attrs.version} already exists.`);
    const draft = new Policy({ ...attrs, state: POLICY_STATES.DRAFT, createdBy: actor, createdAt: this.#clock().toISOString() });
    this.#repository.save(draft);
    return { policy: draft, validation };
  }

  validateAndMark(version) {
    const result = Policy.validate(this.get(version));
    if (!result.valid) return result;
    return { ...result, policy: this.#transition(version, POLICY_STATES.VALIDATED) };
  }

  approve(version) { return this.#transition(version, POLICY_STATES.APPROVED); }
  activate(version) { return this.#transition(version, POLICY_STATES.ACTIVE); }

  /**
   * Deactivates the currently active policy and, if anything else was active
   * before it, reactivates that one automatically -- purely from each
   * policy's own persisted `activatedAt`, not a separate in-memory history,
   * so this stays correct even across a restart. To bring back a specific
   * *older* version instead of just "whatever was active right before this
   * one", call `activate(thatVersion)` directly (see #transition).
   */
  rollback(version) {
    const current = this.get(version);
    if (!current) throw new NotFoundError(`Policy ${version} was not found.`);
    if (version !== this.#activeVersion || current.state !== POLICY_STATES.ACTIVE) {
      throw new ConflictError('Only the currently active policy can be rolled back.');
    }
    const rolledBack = this.#transition(version, POLICY_STATES.ROLLED_BACK);
    const fallback = [...this.#repository.list()]
      .filter((policy) => policy.version !== version && policy.activatedAt)
      .sort((a, b) => new Date(b.activatedAt) - new Date(a.activatedAt))[0];
    if (fallback) this.#transition(fallback.version, POLICY_STATES.ACTIVE); // sets #activeVersion itself
    else this.#activeVersion = null;
    return rolledBack;
  }

  #transition(version, state) {
    const current = this.get(version);
    if (!current) throw new NotFoundError(`Policy ${version} was not found.`);
    if (current.state === POLICY_STATES.ACTIVE && state !== POLICY_STATES.ROLLED_BACK) throw new ConflictError('Active policies are immutable; create a new version.');
    if (state === POLICY_STATES.VALIDATED && current.state !== POLICY_STATES.DRAFT) throw new ConflictError('Only draft policies can be validated.');
    if (state === POLICY_STATES.APPROVED && current.state !== POLICY_STATES.VALIDATED) throw new ConflictError('Only validated policies can be approved.');
    if (state === POLICY_STATES.ACTIVE && current.state !== POLICY_STATES.APPROVED && current.state !== POLICY_STATES.ROLLED_BACK) {
      throw new ConflictError('Only an approved policy, or a previously rolled-back one, can become active.');
    }
    if (state === POLICY_STATES.ACTIVE && !Policy.validate(current).valid) throw new ValidationError('Invalid policies cannot become active.');

    const previousActiveVersion = state === POLICY_STATES.ACTIVE ? this.#activeVersion : null;
    const next = current.withState(state, this.#clock);
    this.#repository.save(next);
    if (state === POLICY_STATES.ACTIVE) {
      this.#activeVersion = version;
      // Reactivating an older version supersedes whatever was active a moment ago, so exactly one
      // policy is ever ACTIVE at once -- its own `state` field, not just `#activeVersion`, stays true.
      if (previousActiveVersion && previousActiveVersion !== version) {
        const previous = this.get(previousActiveVersion);
        if (previous && previous.state === POLICY_STATES.ACTIVE) this.#repository.save(previous.withState(POLICY_STATES.ROLLED_BACK, this.#clock));
      }
    }
    return next;
  }
}
