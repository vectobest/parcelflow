import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { DEFAULT_POLICY } from './src/routing.js';
import { createOperations } from './src/operations.js';
import { createApiRouter } from './src/http/apiRouter.js';
import { AuthenticationError } from './src/auth/authentication.js';
import { SECURITY_HEADERS, sendJson, sendUnauthorized } from './src/http/response.js';

const root = fileURLToPath(new URL('.', import.meta.url));
const port = Number(process.env.PORT || 4173);
const startedAt = Date.now();
const operations = createOperations();
const routeApi = createApiRouter({ operations });
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };

function serveStatic(request, response, url, correlationId) {
  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const filePath = normalize(join(root, requested));
  if (!filePath.startsWith(root)) return sendJson(response, 403, { error: 'Forbidden.' }, correlationId);
  return readFile(filePath).then((body) => {
    response.writeHead(200, { ...SECURITY_HEADERS, 'Content-Type': types[extname(filePath)] || 'application/octet-stream', 'X-Correlation-ID': correlationId });
    response.end(body);
  });
}

createServer(async (request, response) => {
  const correlationId = request.headers['x-correlation-id'] || randomUUID();
  const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
  try {
    if (url.pathname === '/health') return sendJson(response, 200, { status: 'ok', version: '1.0.0', uptime: Math.floor((Date.now() - startedAt) / 1000) }, correlationId);
    if (url.pathname === '/ready') return sendJson(response, 200, { status: 'ready', policy: DEFAULT_POLICY.version, components: { routing: 'ready', policyStore: 'ready', audit: 'ready' } }, correlationId);
    if (url.pathname.startsWith('/api/')) return await routeApi(request, response, url, correlationId);
    return await serveStatic(request, response, url, correlationId);
  } catch (error) {
    if (error instanceof AuthenticationError) return sendUnauthorized(response, error.message, correlationId);
    const status = error instanceof SyntaxError || /exceeds|not authorized|not found|required|invalid|immutable|already/.test(error.message) ? 400 : 500;
    sendJson(response, status, { error: error.message, correlationId }, correlationId);
    console.log(JSON.stringify({ timestamp: new Date().toISOString(), level: 'error', event: 'request_failed', correlationId, path: url.pathname, error: error.message }));
  }
}).listen(port, () => console.log(`Parcel routing system listening on http://localhost:${port}`));
