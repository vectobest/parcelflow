const BASE = '/api';

export class ApiError extends Error {
  constructor(status, message, body) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

export class OfflineError extends Error {
  constructor() {
    super('The server could not be reached.');
    this.name = 'OfflineError';
  }
}

/**
 * Every request carries a fresh correlation ID and the session cookie
 * (credentials: include -- same-origin via the Vite dev proxy, see
 * vite.config.js). `method` defaults to POST when a `body` is given and
 * GET otherwise, rather than always defaulting to GET: a GET request can
 * never carry a body (the browser itself rejects it), so requiring every
 * caller to remember `method: 'POST'` alongside `body` is just an
 * invitation to forget it -- which is exactly what happened across half
 * this app's pages before this became the default.
 */
export async function api(path, { method, body } = {}) {
  const resolvedMethod = method || (body !== undefined ? 'POST' : 'GET');
  const headers = { 'X-Correlation-ID': crypto.randomUUID() };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let res;
  try {
    res = await fetch(`${BASE}${path}`, { method: resolvedMethod, headers, credentials: 'include', body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new OfflineError();
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, data?.error || `Request failed (${res.status}).`, data);
  return data;
}
