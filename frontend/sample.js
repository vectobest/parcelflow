// Generates a realistic mixed batch for demos: mostly light parcels, a heavy tail,
// a few high-value items and a handful of deliberately invalid records.
const COUNTRIES = ['NL', 'NL', 'NL', 'DE', 'DE', 'BE', 'FR', 'GB', 'ES', 'IT', 'PL', 'SE'];

function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const round = (value, places) => Math.round(value * 10 ** places) / 10 ** places;

export function generateSampleBatch({ size = 120, seed = Date.now() } = {}) {
  const random = seededRandom(seed);
  const prefix = `S${(seed % 10000).toString().padStart(4, '0')}`;
  return Array.from({ length: size }, (_, index) => {
    const id = `${prefix}-${String(index + 1).padStart(3, '0')}`;
    const roll = random();
    const weight = roll < 0.38 ? round(random() * 1.2, 2)
      : roll < 0.82 ? round(0.8 + random() * 10, 2)
        : round(9 + random() ** 1.6 * 32, 1);
    const value = random() < 0.1 ? round(1000 + random() * 3500, 2) : round(random() ** 2.4 * 950, 2);
    const parcel = { id, weight, value, destinationCountry: COUNTRIES[Math.floor(random() * COUNTRIES.length)] };
    const defect = random();
    if (defect < 0.025) return { ...parcel, destinationCountry: '' };
    if (defect < 0.04) return { ...parcel, weight: -1 };
    return parcel;
  });
}
