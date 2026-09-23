const MAX_FILE_BYTES = 5 * 1024 * 1024;

function numberFrom(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : value;
}

function normaliseParcel(parcel, index) {
  return {
    id: parcel.id || parcel.Id || `parcel-${index + 1}`,
    weight: numberFrom(parcel.weight ?? parcel.Weight),
    value: numberFrom(parcel.value ?? parcel.Value),
    destinationCountry: String(parcel.destinationCountry ?? parcel.country ?? parcel.Country ?? 'Unknown'),
    recipient: parcel.recipient ?? parcel.Recipient ?? parcel.Receipient ?? null
  };
}

export function parseJson(text) {
  const data = JSON.parse(text);
  const parcels = Array.isArray(data) ? data : data.parcels;
  if (!Array.isArray(parcels)) {
    throw new Error('JSON must contain a parcels array.');
  }
  return parcels.map(normaliseParcel);
}

export function parseXml(text) {
  if (typeof DOMParser === 'undefined') {
    throw new Error('XML parsing is only available in the browser.');
  }
  const document = new DOMParser().parseFromString(text, 'application/xml');
  if (document.querySelector('parsererror')) {
    throw new Error('XML is not well-formed.');
  }
  const nodes = [...document.querySelectorAll('Parcel')];
  if (!nodes.length) {
    throw new Error('XML does not contain any Parcel elements.');
  }
  return nodes.map((node, index) => normaliseParcel({
    id: node.querySelector('Id')?.textContent,
    weight: node.querySelector('Weight')?.textContent,
    value: node.querySelector('Value')?.textContent,
    destinationCountry: node.querySelector('DestinationCountry, Country')?.textContent
  }, index));
}

export async function parseUpload(file) {
  if (!file || file.size > MAX_FILE_BYTES) {
    throw new Error('Choose a file smaller than 5 MB.');
  }
  const text = await file.text();
  const extension = file.name.toLowerCase().split('.').pop();
  return extension === 'xml' ? parseXml(text) : parseJson(text);
}