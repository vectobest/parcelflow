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
 * back an older version on purpose. An ACTIVE policy is immutable; every
 * change is a brand new version.
 *
 * More than one policy can be ACTIVE at the same time by design -- e.g. a
 * standard rule set and an express rule set, both live together -- so
 * activating one never touches any other, and rolling one back never
 * activates a replacement. `getActive()`/`activeVersion()` are a single
 * convenience default (the most recently activated one) for callers that
 * just need *a* policy to route under without asking; `listActive()` is
 * every version currently available to route under, for a caller (or an
 * operator, via the Intake picker) that wants to choose.
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
   * after a restart); it must never re-seed and overwrite real data with the hardcoded default.
   * When history already exists, the single-default pointer is just recovered from the data
   * itself (see #recomputeDefault) -- nothing is activated, deactivated, or otherwise changed.
   */
  bootstrap(initialPolicyAttrs) {
    if (this.#repository.list().length === 0) {
      const now = this.#clock().toISOString();
      const initial = new Policy({ ...initialPolicyAttrs, state: POLICY_STATES.ACTIVE, createdBy: 'system', createdAt: now, activatedAt: now });
      const validation = Policy.validate(initial);
      if (!validation.valid) throw new ValidationError(validation.errors.join(' '));
      this.#repository.save(initial);
      this.#activeVersion = initial.version;
      return this;
    }
    this.#recomputeDefault();
    return this;
  }

  get(version) { return this.#repository.get(version || this.#activeVersion); }
  /** The single most-recently-activated policy -- a default for a caller that isn't choosing one. */
  getActive() { return this.get(); }
  activeVersion() { return this.#activeVersion; }
  /** Every policy currently available to route under, newest first -- for an operator to choose from. */
  listActive() { return this.#repository.list().filter((policy) => policy.state === POLICY_STATES.ACTIVE).sort((a, b) => new Date(b.activatedAt || 0) - new Date(a.activatedAt || 0)); }
  list() { return this.#repository.list(); }
  validate(version) { return Policy.validate(this.get(version)); }

  /** Recomputes the single-default pointer from whichever policies are currently ACTIVE; never mutates any of them. */
  #recomputeDefault() {
    this.#activeVersion = this.listActive()[0]?.version ?? null;
  }

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
   * Deactivates exactly this one policy and nothing else -- no other policy is activated,
   * deactivated, or otherwise touched, whether or not it's the single-default pointer. If it
   * was, the pointer moves on to whichever other ACTIVE policy is now newest, or to nothing if
   * this was the only one left.
   */
  rollback(version) {
    const current = this.get(version);
    if (!current) throw new NotFoundError(`Policy ${version} was not found.`);
    if (current.state !== POLICY_STATES.ACTIVE) throw new ConflictError('Only an active policy can be rolled back.');
    const rolledBack = this.#transition(version, POLICY_STATES.ROLLED_BACK);
    this.#recomputeDefault();
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

    const next = current.withState(state, this.#clock);
    this.#repository.save(next);
    // Activating this one never rolls any other policy back -- more than one can be ACTIVE at
    // once by design (see the class comment). This is simply the newest, so it becomes the
    // single-default pointer for a caller that isn't choosing one.
    if (state === POLICY_STATES.ACTIVE) this.#activeVersion = version;
    return next;
  }
}
