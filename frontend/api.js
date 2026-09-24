const IDENTITY_KEY = 'parcelflow.identity';

export class ApiError extends Error {
  constructor(status, message, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export class OfflineError extends Error {
  constructor(message = 'The server could not be reached.') {
    super(message);
    this.name = 'OfflineError';
  }
}

// Identity lives in sessionStorage so a closed tab signs the operator out.
export function loadIdentity() {
  try {
    return JSON.parse(sessionStorage.getItem(IDENTITY_KEY)) || null;
  } catch {
    return null;
  }
}

export function saveIdentity(identity) {
  try {
    if (identity) sessionStorage.setItem(IDENTITY_KEY, JSON.stringify(identity));
    else sessionStorage.removeItem(IDENTITY_KEY);
  } catch {
    // Storage can be unavailable (private mode); the identity then lasts for this page only.
  }
}

function authHeaders(identity) {
  if (identity?.token) return { Authorization: `Bearer ${identity.token}` };
  if (identity?.role) return { 'X-Role': identity.role, 'X-Actor': identity.actor || 'demo-operator' };
  return {};
}

export async function api(path, { method = 'GET', body } = {}) {
  const headers = { 'X-Correlation-ID': crypto.randomUUID(), ...authHeaders(loadIdentity()) };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let response;
  try {
    response = await fetch(path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new OfflineError();
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof data?.error === 'string' ? data.error : data?.error?.message || `Request failed (${response.status}).`;
    throw new ApiError(response.status, message, data);
  }
  return data;
}
