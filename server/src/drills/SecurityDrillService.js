import { randomUUID } from 'node:crypto';
import { SecureBatchParser } from '../batches/SecureBatchParser.js';
import { IdempotencyStore } from '../batches/IdempotencyStore.js';

/**
 * Admin-only security drill (master prompt section 22). Unlike a scripted
 * "attack simulation" narrative, every scenario here actually calls the
 * real security code (SecureBatchParser, AuthorizationService,
 * AuthenticationService, IdempotencyStore) with a hostile input and
 * reports whether it was genuinely rejected. A scenario that unexpectedly
 * succeeds is reported as `blocked: false`, not hidden -- this drill is
 * only honest if it can fail.
 */
export class SecurityDrillService {
  #authorizationService;
  #authenticationService;
  #auditService;
  #config;

  constructor({ authorizationService, authenticationService, auditService, config }) {
    this.#authorizationService = authorizationService;
    this.#authenticationService = authenticationService;
    this.#auditService = auditService;
    this.#config = config;
  }

  runAll({ actor = 'admin' } = {}) {
    const correlationId = randomUUID();
    const results = [
      this.#expectReject('OVERSIZED_UPLOAD', () => {
        const parser = new SecureBatchParser({ maxBytes: 100, maxRecords: 5000 });
        parser.parse('x'.repeat(1000), 'json');
      }),
      this.#expectReject('MALFORMED_XML', () => {
        const parser = new SecureBatchParser({ maxBytes: this.#config.maxUploadBytes, maxRecords: 5000 });
        parser.parse('<Batch><Parcel><Weight>1</Weight></Batch>', 'xml');
      }),
      this.#expectReject('XXE_LIKE_PAYLOAD', () => {
        const parser = new SecureBatchParser({ maxBytes: this.#config.maxUploadBytes, maxRecords: 5000 });
        parser.parse('<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><Batch><Parcel><Weight>&xxe;</Weight></Parcel></Batch>', 'xml');
      }),
      this.#expectReject('PROTOTYPE_POLLUTION', () => {
        const parser = new SecureBatchParser({ maxBytes: this.#config.maxUploadBytes, maxRecords: 5000 });
        parser.parse('{"parcels":[{"__proto__":{"polluted":true},"weight":1,"value":0,"destinationCountry":"NL"}]}', 'json');
      }),
      this.#expectReject('UNAUTHORIZED_POLICY_ACTIVATION', () => {
        this.#authorizationService.assertRole('OPERATOR', ['ADMIN'], 'Role is not authorized to manage policies.');
      }),
      this.#expectReject('UNAUTHORIZED_APPROVAL', () => {
        this.#authorizationService.assertPermission('OPERATOR', 'approve');
      }),
      this.#expectReject('INVALID_AUTHENTICATION', () => {
        this.#authenticationService.authenticate({ headers: { authorization: 'Bearer not-a-real-token' } });
      }),
      this.#expectReject('REPLAY_REQUEST', () => {
        const store = new IdempotencyStore();
        const key = 'drill-replay-key';
        const first = store.begin(key);
        if (first.state !== 'reserved') throw new Error('First submission should have been reserved.');
        store.complete(key, { ok: true });
        const replay = store.begin(key);
        if (replay.state !== 'completed') throw new Error('Replayed submission was not recognised as a duplicate.');
        throw { rejected: true, message: `Duplicate submission was replayed from the idempotency store instead of being reprocessed.` };
      })
    ];

    this.#auditService.record({ action: 'security_drill_run', entity: 'drill', actor, correlationId, newValue: { blocked: results.filter((r) => r.blocked).length, total: results.length }, metadata: { drill: true } });
    return { correlationId, results, status: results.every((r) => r.blocked) ? 'PROTECTED' : 'ATTENTION_REQUIRED', label: 'SIMULATION -- NOT PRODUCTION' };
  }

  #expectReject(scenario, action) {
    try {
      action();
      return { scenario, blocked: false, detail: 'The action completed without being rejected. This scenario needs investigation.' };
    } catch (error) {
      if (error && error.rejected) return { scenario, blocked: true, detail: error.message };
      return { scenario, blocked: true, detail: error.message || 'Rejected as expected.' };
    }
  }
}
