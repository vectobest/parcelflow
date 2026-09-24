import { XMLParser } from 'fast-xml-parser';
import { ValidationError } from '../errors/index.js';

const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

/**
 * Rejects prototype-pollution payloads before any parsed object is ever
 * touched downstream. Defense in depth: nothing in this codebase merges
 * untrusted objects onto a shared prototype, but a future change might,
 * so this is checked at the boundary rather than relied on implicitly.
 */
function assertNoPrototypePollution(value, depth = 0) {
  if (depth > 20 || value === null || typeof value !== 'object') return;
  for (const key of Object.keys(value)) {
    if (DANGEROUS_KEYS.has(key)) throw new ValidationError('The file contains a disallowed field name and was rejected.');
    assertNoPrototypePollution(value[key], depth + 1);
  }
}

/**
 * Parses fast-xml-parser is a non-DOM, non-DTD-resolving parser: it has no
 * concept of external entities or DOCTYPE expansion, so classic XXE
 * (reading local files, SSRF via external entity URLs) is structurally
 * impossible here, not just disabled by a flag. As a second layer, any
 * payload containing a DOCTYPE or ENTITY declaration is rejected outright
 * before parsing even starts, both because it is never needed for a
 * parcel batch and because it is the strongest signal of a malicious
 * upload (see docs/THREAT_MODEL.md, "XXE / entity expansion").
 */
function parseXml(text) {
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) {
    throw new ValidationError('The file contains a DOCTYPE or ENTITY declaration, which is not permitted in parcel batch uploads.');
  }
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '', parseTagValue: true, allowBooleanAttributes: false, processEntities: false });
  let parsed;
  try {
    parsed = parser.parse(text, true);
  } catch {
    throw new ValidationError('The file is not well-formed XML.');
  }
  assertNoPrototypePollution(parsed);
  const parcels = parsed?.Batch?.Parcel ?? parsed?.Parcels?.Parcel ?? parsed?.Parcel ?? [];
  return Array.isArray(parcels) ? parcels : [parcels];
}

function parseJson(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ValidationError('The file is not valid JSON.');
  }
  assertNoPrototypePollution(parsed);
  const parcels = Array.isArray(parsed) ? parsed : parsed?.parcels;
  if (!Array.isArray(parcels)) throw new ValidationError('The JSON file must contain a top-level array, or an object with a "parcels" array.');
  return parcels;
}

/**
 * Secure input pipeline for uploaded batches (master prompt section 8/9):
 * size limit -> content-type/format check -> safe parser -> structural
 * guard -> record-count limit. Nothing past this point trusts the raw
 * upload again.
 */
export class SecureBatchParser {
  #maxBytes;
  #maxRecords;

  constructor({ maxBytes, maxRecords }) {
    this.#maxBytes = maxBytes;
    this.#maxRecords = maxRecords;
  }

  parse(text, format) {
    if (typeof text !== 'string') throw new ValidationError('Upload body must be text.');
    if (Buffer.byteLength(text, 'utf8') > this.#maxBytes) {
      throw new ValidationError(`File is larger than the ${formatBytes(this.#maxBytes)} limit.`);
    }
    const normalizedFormat = String(format || '').toLowerCase();
    let parcels;
    if (normalizedFormat === 'xml') parcels = parseXml(text);
    else if (normalizedFormat === 'json') parcels = parseJson(text);
    else throw new ValidationError('Unsupported format. Upload a .json or .xml file.');

    if (parcels.length > this.#maxRecords) {
      throw new ValidationError(`File contains ${parcels.length} parcels, which is above the ${this.#maxRecords} limit for a single batch.`);
    }
    return parcels;
  }
}
