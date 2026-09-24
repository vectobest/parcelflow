export class InMemoryIncidentRepository {
  #incidents = new Map();
  get(id) { return this.#incidents.get(id); }
  list() { return [...this.#incidents.values()]; }
  save(incident) { this.#incidents.set(incident.incidentId, incident); return incident; }
}
