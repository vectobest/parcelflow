import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthenticationService } from '../src/auth/AuthenticationService.js';
import { AuthenticationError } from '../src/errors/index.js';

const request = (headers = {}) => ({ headers });

test('demo authentication preserves local operator workflow', () => {
  const authenticator = new AuthenticationService({ mode: 'demo' });

  assert.deepEqual(authenticator.authenticate(request({ 'x-role': 'REVIEWER', 'x-actor': 'casey' })), { actor: 'casey', role: 'REVIEWER', mode: 'demo' });
});

test('production authentication rejects missing and invalid bearer tokens', () => {
  const authenticator = new AuthenticationService({ mode: 'production', tokens: 'secret-token:admin-user:ADMIN' });

  assert.throws(() => authenticator.authenticate(request()), AuthenticationError);
  assert.throws(() => authenticator.authenticate(request({ authorization: 'Bearer wrong-token' })), /invalid/);
});

test('production authentication derives identity from configured bearer token, ignoring spoofed headers', () => {
  const authenticator = new AuthenticationService({ mode: 'production', tokens: 'secret-token:admin-user:ADMIN' });

  assert.deepEqual(authenticator.authenticate(request({ authorization: 'Bearer secret-token', 'x-role': 'OPERATOR', 'x-actor': 'spoofed' })), { actor: 'admin-user', role: 'ADMIN', mode: 'bearer' });
});

test('production mode never registers the demo header fallback', () => {
  const authenticator = new AuthenticationService({ mode: 'production', tokens: 'secret-token:admin-user:ADMIN' });

  assert.throws(() => authenticator.authenticate(request({ 'x-role': 'ADMIN', 'x-actor': 'anyone' })), AuthenticationError);
});
