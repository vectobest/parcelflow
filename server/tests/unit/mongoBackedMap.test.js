import test from 'node:test';
import assert from 'node:assert/strict';
import { MongoBackedMap } from '../../src/db/MongoBackedMap.js';

/** A fake Mongo collection, so these tests need no network access and no real database. */
function fakeCollection(initialDocs = []) {
  const docs = new Map(initialDocs.map((doc) => [doc._id, doc]));
  return {
    collectionName: 'fake',
    docs,
    find() { return { toArray: async () => [...docs.values()] }; }, // real driver: find() is sync, returns a cursor; toArray() is async
    async replaceOne({ _id }, doc) { docs.set(_id, doc); },
    async deleteOne({ _id }) { docs.delete(_id); }
  };
}
const silentLogger = { error() {} };

test('hydrate() loads every existing document into memory, keyed by _id', async () => {
  const collection = fakeCollection([{ _id: 'v1', mailWeightLimit: 1 }, { _id: 'v2', mailWeightLimit: 2 }]);
  const map = await new MongoBackedMap({ collection, logger: silentLogger }).hydrate();
  assert.equal(map.get('v1').mailWeightLimit, 1);
  assert.equal(map.get('v2').mailWeightLimit, 2);
  assert.deepEqual([...map.values()].length, 2);
});

test('set() is readable immediately and is mirrored to the collection', async () => {
  const collection = fakeCollection();
  const map = new MongoBackedMap({ collection, logger: silentLogger });
  map.set('v1', { mailWeightLimit: 1 });
  assert.equal(map.get('v1').mailWeightLimit, 1); // synchronous read, doesn't wait on the write
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(collection.docs.get('v1').mailWeightLimit, 1);
});

test('delete() removes from memory immediately and is mirrored to the collection', async () => {
  const collection = fakeCollection([{ _id: 'v1' }]);
  const map = await new MongoBackedMap({ collection, logger: silentLogger }).hydrate();
  map.delete('v1');
  assert.equal(map.has('v1'), false);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(collection.docs.has('v1'), false);
});

test('a failed write is logged, never thrown, and the in-memory value is kept', async () => {
  const collection = fakeCollection();
  collection.replaceOne = async () => { throw new Error('connection reset'); };
  let logged = null;
  const logger = { error: (event, fields) => { logged = { event, fields }; } };
  const map = new MongoBackedMap({ collection, logger });

  assert.doesNotThrow(() => map.set('v1', { mailWeightLimit: 1 }));
  assert.equal(map.get('v1').mailWeightLimit, 1);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(logged.event, 'mongo_write_failed');
  assert.equal(logged.fields.key, 'v1');
});

test('a MongoBackedMap can stand in for a plain Map wherever UserStore expects one', async () => {
  const { UserStore } = await import('../../src/auth/UserStore.js');
  const users = new MongoBackedMap({ collection: fakeCollection(), logger: silentLogger });
  const pendingRoles = new MongoBackedMap({ collection: fakeCollection(), logger: silentLogger });
  const store = new UserStore({ users, pendingRoles });

  store.presetRole('future@example.com', 'REVIEWER');
  const user = store.findOrCreate({ email: 'future@example.com', name: 'Future Person', provider: 'google' });
  assert.equal(user.role, 'REVIEWER');
  assert.equal(store.get('future@example.com').role, 'REVIEWER');
});
