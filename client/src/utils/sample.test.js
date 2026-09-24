import { describe, it, expect } from 'vitest';
import { generateSampleBatch } from './sample.js';

describe('generateSampleBatch', () => {
  it('generates the requested number of parcels', () => {
    expect(generateSampleBatch(30, 1)).toHaveLength(30);
  });

  it('produces deterministic output for the same seed', () => {
    expect(generateSampleBatch(10, 7)).toEqual(generateSampleBatch(10, 7));
  });

  it('every parcel has the fields the API expects', () => {
    for (const parcel of generateSampleBatch(20, 3)) {
      expect(parcel).toHaveProperty('id');
      expect(parcel).toHaveProperty('weight');
      expect(parcel).toHaveProperty('value');
      expect(parcel).toHaveProperty('destinationCountry');
    }
  });
});
