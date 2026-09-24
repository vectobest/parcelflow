import test from 'node:test';
import assert from 'node:assert/strict';
import { SecureBatchParser } from '../../src/batches/SecureBatchParser.js';

const parser = new SecureBatchParser({ maxBytes: 1024, maxRecords: 5 });

test('rejects files larger than the configured limit before parsing', () => {
  assert.throws(() => parser.parse('x'.repeat(2000), 'json'), /larger than/);
});

test('rejects malformed JSON', () => {
  assert.throws(() => parser.parse('{not json', 'json'), /not valid JSON/);
});

test('rejects malformed XML', () => {
  assert.throws(() => parser.parse('<Batch><Parcel>', 'xml'), /not well-formed/);
});

test('rejects a DOCTYPE / entity declaration outright (XXE defence in depth)', () => {
  const xxe = '<!DOCTYPE foo [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><Batch><Parcel><Weight>&xxe;</Weight></Parcel></Batch>';
  assert.throws(() => parser.parse(xxe, 'xml'), /DOCTYPE or ENTITY/);
});

test('does not resolve external entities even without an explicit DOCTYPE check catching it', () => {
  // Belt and braces: even if the DOCTYPE guard above were ever removed, fast-xml-parser
  // has no entity-resolution engine at all, so a raw external-entity reference is left
  // as literal, un-expanded text rather than being dereferenced.
  const xml = '<Batch><Parcel><Weight>1</Weight><Value>0</Value><DestinationCountry>NL</DestinationCountry></Parcel></Batch>';
  const parcels = parser.parse(xml, 'xml');
  assert.equal(parcels.length, 1);
});

test('rejects prototype-pollution keys in JSON payloads', () => {
  const payload = '{"parcels":[{"__proto__":{"polluted":true},"weight":1,"value":0,"destinationCountry":"NL"}]}';
  assert.throws(() => parser.parse(payload, 'json'), /disallowed field name/);
  assert.equal({}.polluted, undefined, 'the global Object prototype must never be touched');
});

test('rejects prototype-pollution keys in XML payloads', () => {
  // fast-xml-parser itself refuses "constructor"/"__proto__"/"prototype" as a tag name
  // (a built-in protection), so this is rejected before our own guard even runs -- either
  // way, the payload must never be accepted.
  const payload = '<Batch><Parcel><constructor>bad</constructor><Weight>1</Weight></Parcel></Batch>';
  assert.throws(() => parser.parse(payload, 'xml'), /not well-formed|disallowed field name/);
});

test('rejects a batch with more records than the configured limit', () => {
  const payload = JSON.stringify({ parcels: Array.from({ length: 6 }, (_, i) => ({ id: `P-${i}`, weight: 1, value: 0, destinationCountry: 'NL' })) });
  assert.throws(() => parser.parse(payload, 'json'), /above the 5 limit/);
});

test('rejects an unsupported format instead of guessing', () => {
  assert.throws(() => parser.parse('{}', 'yaml'), /Unsupported format/);
});

test('accepts a well-formed, reasonably sized JSON batch', () => {
  const payload = JSON.stringify({ parcels: [{ id: 'P-1', weight: 1, value: 0, destinationCountry: 'NL' }] });
  const parcels = parser.parse(payload, 'json');
  assert.equal(parcels.length, 1);
  assert.equal(parcels[0].id, 'P-1');
});

test('accepts a well-formed XML batch', () => {
  const xml = '<Batch><Parcel><Id>P-1</Id><Weight>1</Weight><Value>0</Value><DestinationCountry>NL</DestinationCountry></Parcel></Batch>';
  const parcels = parser.parse(xml, 'xml');
  assert.equal(parcels.length, 1);
  assert.equal(parcels[0].Id, 'P-1');
});
