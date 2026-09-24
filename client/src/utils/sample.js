const COUNTRIES = ['NL', 'NL', 'NL', 'DE', 'DE', 'BE', 'FR', 'GB', 'ES', 'IT'];

function seededRandom(seed) {
  let value = seed;
  return () => {
    value = (value * 1103515245 + 12345) & 0x7fffffff;
    return value / 0x7fffffff;
  };
}

/** Generates a realistic mixed batch for demos: mostly light parcels, a heavy tail, a few high-value items, and a handful of deliberately invalid records. */
export function generateSampleBatch(count = 60, seed = Date.now()) {
  const random = seededRandom(seed);
  return Array.from({ length: count }, (_, i) => {
    const roll = random();
    const invalid = i > 5 && random() < 0.04;
    const weight = roll < 0.45 ? +(random() * 0.9 + 0.05).toFixed(2) : roll < 0.85 ? +(random() * 9 + 1.1).toFixed(2) : +(random() * 30 + 10.1).toFixed(2);
    const highValue = random() < 0.08;
    return {
      id: `S-${1000 + i}`,
      weight: invalid ? -Math.abs(weight) : weight,
      value: highValue ? Math.round(1000 + random() * 4000) : Math.round(random() * 300),
      destinationCountry: invalid && random() < 0.5 ? '' : COUNTRIES[Math.floor(random() * COUNTRIES.length)]
    };
  });
}
