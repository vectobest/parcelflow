import { ApprovalRepository } from './ApprovalRepository.js';

export class InMemoryApprovalRepository extends ApprovalRepository {
  #approvals = new Map();
  get(id) { return this.#approvals.get(id); }
  list() { return [...this.#approvals.values()]; }
  save(approval) { this.#approvals.set(approval.approvalId, approval); return approval; }
}
