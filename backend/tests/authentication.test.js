import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthenticationError, createAuthenticator } from '../src/auth/authentication.js';

const request = (headers = {}) => ({ headers });

test('demo authentication preserves local operator workflow', () => {
  const authenticator = createAuthenticator({ mode: 'demo' });

  assert.deepEqual(authenticator.authenticate(request({ 'x-role': 'REVIEWER', 'x-actor': 'casey' })), { actor: 'casey', role: 'REVIEWER', mode: 'demo' });
});

test('production authentication rejects missing and invalid bearer tokens', () => {
  const authenticator = createAuthenticator({ mode: 'production', tokens: 'secret-token:admin-user:ADMIN' });

  assert.throws(() => authenticator.authenticate(request()), AuthenticationError);
  assert.throws(() => authenticator.authenticate(request({ authorization: 'Bearer wrong-token' })), /invalid/);
});

test('production authentication derives identity from configured bearer token', () => {
  const authenticator = createAuthenticator({ mode: 'production', tokens: 'secret-token:admin-user:ADMIN' });

  assert.deepEqual(authenticator.authenticate(request({ authorization: 'Bearer secret-token', 'x-role': 'OPERATOR', 'x-actor': 'spoofed' })), { actor: 'admin-user', role: 'ADMIN', mode: 'bearer' });
});