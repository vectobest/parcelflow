/**
 * A Map that mirrors every write through to a MongoDB collection, and can be
 * hydrated from that collection at startup. Reads are always served from the
 * in-memory Map -- synchronous, so every existing repository built on this
 * keeps the exact same interface the rest of the app already depends on.
 * Writes are fired at Mongo in the background: they never block the caller
 * and never throw into it. If Mongo is briefly unreachable, the app keeps
 * working from memory and the failure is only logged (see
 * docs/decisions/ADR-010 for why this trade-off was made instead of making
 * every repository call, and therefore every service and controller, async).
 */
export class MongoBackedMap {
  #map = new Map();
  #collection;
  #logger;

  constructor({ collection, logger }) {
    this.#collection = collection;
    this.#logger = logger;
  }

  /** Loads every existing document into memory. Must complete before the map is used. */
  async hydrate() {
    const docs = await this.#collection.find({}).toArray();
    for (const { _id, ...value } of docs) this.#map.set(_id, value);
    return this;
  }

  get(key) { return this.#map.get(key); }
  has(key) { return this.#map.has(key); }
  values() { return this.#map.values(); }
  entries() { return this.#map.entries(); }

  set(key, value) {
    this.#map.set(key, value);
    this.#collection.replaceOne({ _id: key }, { _id: key, ...value }, { upsert: true })
      .catch((error) => this.#logger.error('mongo_write_failed', { collection: this.#collection.collectionName, key: String(key), error: error.message }));
    return this;
  }

  delete(key) {
    const existed = this.#map.delete(key);
    this.#collection.deleteOne({ _id: key })
      .catch((error) => this.#logger.error('mongo_delete_failed', { collection: this.#collection.collectionName, key: String(key), error: error.message }));
    return existed;
  }
}
