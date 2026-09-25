/**
 * Read-only views over batches, approvals and incidents narrowed to one
 * operator's own submissions. They implement just the read methods the
 * reporting/intelligence services call (list/get), so those services can
 * be built on top of either these or the real services unchanged. Write
 * paths (processing, approving, incident detection) never go through here.
 */
export function ownBatches(batchService, actor) {
  return {
    list: () => batchService.list().filter((batch) => batch.actor === actor),
    get: (id) => {
      const batch = batchService.get(id);
      return batch?.actor === actor ? batch : undefined;
    }
  };
}

export function ownApprovals(approvalService, batches) {
  return {
    list: () => {
      const batchIds = new Set(batches.list().map((batch) => batch.batchId));
      return approvalService.list().filter((approval) => batchIds.has(approval.batchId));
    }
  };
}

export function ownIncidents(incidentDetectorService, batches) {
  const isOwn = (incident) => {
    const batchIds = new Set(batches.list().map((batch) => batch.batchId));
    return (incident.relatedBatchIds || []).some((id) => batchIds.has(id));
  };
  return {
    list: () => incidentDetectorService.list().filter(isOwn),
    get: (id) => {
      const incident = incidentDetectorService.get(id);
      return incident && isOwn(incident) ? incident : undefined;
    }
  };
}
