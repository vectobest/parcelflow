/**
 * Parcel is a small domain value object. It owns exactly one responsibility
 * (SRP): normalising heterogeneous input (JSON/XML, camelCase/PascalCase)
 * into a single canonical shape the rest of the system can rely on. It has
 * no knowledge of HTTP, storage, or routing rules.
 */
export class Parcel {
  constructor({ id = null, weight, value, destinationCountry, recipient = null } = {}) {
    this.id = id;
    this.weight = weight;
    this.value = value;
    this.destinationCountry = destinationCountry;
    this.recipient = recipient;
  }

  static fromInput(raw, index = 0) {
    const source = raw && typeof raw === 'object' ? raw : {};
    const id = source.id || source.Id || source.parcelId || `parcel-${index + 1}`;
    return new Parcel({
      id,
      weight: Parcel.#toNumber(source.weight ?? source.Weight),
      value: Parcel.#toNumber(source.value ?? source.Value),
      destinationCountry: source.destinationCountry ?? source.country ?? source.Country,
      recipient: source.recipient ?? source.Recipient ?? source.Receipient ?? null
    });
  }

  static #toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : NaN;
  }

  toJSON() {
    return {
      id: this.id,
      weight: this.weight,
      value: this.value,
      destinationCountry: this.destinationCountry,
      recipient: this.recipient
    };
  }
}
