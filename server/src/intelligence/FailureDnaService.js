const FINGERPRINTS = [
  { code: 'MISSING_OR_INVALID_WEIGHT', test: (reason) => /weight must be a non-negative number/i.test(reason) },
  { code: 'MISSING_OR_INVALID_VALUE', test: (reason) => /value must be a non-negative number/i.test(reason) },
  { code: 'MISSING_DESTINATION_COUNTRY', test: (reason) => /destination country is required/i.test(reason) }
];

/**
 * Groups validation failures by fingerprint (master prompt section 20)
 * and reports the trend of each fingerprint across the two most recent
 * halves of observed history, so a systemic upstream problem (e.g. a
 * feed that stopped sending weight) is visible before it's a crisis.
 */
export class FailureDnaService {
  #batchService;

  constructor({ batchService }) {
    this.#batchService = batchService;
  }

  analyze() {
    const batches = this.#batchService.list();
    const failures = batches.flatMap((batch) => batch.results.filter(({ outcome }) => outcome.status === 'error').map((r) => ({ ...r, batchCreatedAt: batch.createdAt })));
    if (!failures.length) return { totalFailures: 0, categories: [] };

    const midpoint = Math.floor(failures.length / 2);
    const earlier = failures.slice(0, midpoint);
    const later = failures.slice(midpoint);

    const categorize = (list) => FINGERPRINTS.reduce((counts, fp) => {
      counts[fp.code] = list.filter((f) => fp.test(f.outcome.reason || '')).length;
      return counts;
    }, {});

    const earlierCounts = categorize(earlier);
    const laterCounts = categorize(later);
    const totalCounts = categorize(failures);

    const categories = FINGERPRINTS.map((fp) => {
      const count = totalCounts[fp.code];
      if (!count) return null;
      const earlierShare = earlier.length ? earlierCounts[fp.code] / earlier.length : 0;
      const laterShare = later.length ? laterCounts[fp.code] / later.length : 0;
      const trend = laterShare > earlierShare + 0.05 ? 'INCREASING' : laterShare < earlierShare - 0.05 ? 'DECREASING' : 'STABLE';
      return { code: fp.code, count, share: count / failures.length, trend };
    }).filter(Boolean).sort((a, b) => b.count - a.count);

    const uncategorized = failures.length - categories.reduce((sum, c) => sum + c.count, 0);
    if (uncategorized > 0) categories.push({ code: 'OTHER', count: uncategorized, share: uncategorized / failures.length, trend: 'STABLE' });

    return { totalFailures: failures.length, categories };
  }
}
