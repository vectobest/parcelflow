/**
 * Structural conflict checks for the tiered-threshold policy model this
 * app actually uses (mail <= x < regular <= y < heavy, plus a value-based
 * insurance gate). This is deliberately scoped to that model rather than
 * a general-purpose rule DSL the app doesn't have -- see
 * docs/decisions/ADR-008 for why an arbitrary rule builder was not built.
 */
export class RuleConflictDetector {
  analyze(policy) {
    const findings = [];
    const { mailWeightLimit, regularWeightLimit, insuranceValueThreshold, departments = {} } = policy;

    if (Number(mailWeightLimit) >= Number(regularWeightLimit)) {
      findings.push({
        severity: 'ERROR',
        code: 'OVERLAPPING_WEIGHT_TIERS',
        message: `Mail limit (${mailWeightLimit}kg) is not below the regular limit (${regularWeightLimit}kg), so the Regular tier can never be reached.`
      });
    }

    if (Number(mailWeightLimit) <= 0) {
      findings.push({
        severity: 'WARNING',
        code: 'UNREACHABLE_MAIL_TIER',
        message: 'Mail limit is zero or negative, so no parcel can ever qualify for the Mail department.'
      });
    }

    if (Number(insuranceValueThreshold) <= 0) {
      findings.push({
        severity: 'WARNING',
        code: 'INSURANCE_DOMINATES',
        message: 'Insurance threshold is zero or negative, so every parcel with a positive value will require approval regardless of weight -- the weight tiers become unreachable in practice.'
      });
    }

    const names = [departments.mail, departments.regular, departments.heavy].filter(Boolean);
    const duplicates = names.filter((name, index) => names.indexOf(name) !== index);
    if (duplicates.length) {
      findings.push({
        severity: 'WARNING',
        code: 'AMBIGUOUS_DEPARTMENT_NAMES',
        message: `More than one weight tier reports to "${duplicates[0]}", so operators can't tell which rule actually matched from the department name alone.`
      });
    }

    return { hasConflicts: findings.some((f) => f.severity === 'ERROR'), hasWarnings: findings.some((f) => f.severity === 'WARNING'), findings };
  }
}
