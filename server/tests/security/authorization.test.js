import test from 'node:test';
import assert from 'node:assert/strict';
import { AuthorizationService } from '../../src/auth/AuthorizationService.js';
import { AuthenticationService } from '../../src/auth/AuthenticationService.js';
import { AuthenticationError, AuthorizationError } from '../../src/errors/index.js';

test('OPERATOR cannot approve, manage policies, run drills, view audit, or manage users', () => {
  const auth = new AuthorizationService();
  for (const permission of ['approve', 'managePolicy', 'runDrill', 'viewAudit', 'manageUsers']) {
    assert.throws(() => auth.assertPermission('OPERATOR', permission), AuthorizationError);
  }
});

test('REVIEWER can approve but still cannot manage policies or run drills', () => {
  const auth = new AuthorizationService();
  auth.assertPermission('REVIEWER', 'approve');
  assert.throws(() => auth.assertPermission('REVIEWER', 'managePolicy'));
  assert.throws(() => auth.assertPermission('REVIEWER', 'runDrill'));
});

test('ADMIN can do everything an OPERATOR and REVIEWER can, plus governance actions', () => {
  const auth = new AuthorizationService();
  for (const permission of ['process', 'retry', 'approve', 'managePolicy', 'runDrill', 'viewAudit', 'manageUsers']) {
    auth.assertPermission('ADMIN', permission);
  }
});

test('an unknown role is rejected for every permission (fail closed)', () => {
  const auth = new AuthorizationService();
  assert.throws(() => auth.assertPermission('SUPERUSER', 'process'));
});

test('without a configured service token, no bearer token authenticates', () => {
  const authentication = new AuthenticationService({ tokens: '' });
  assert.throws(() => authentication.authenticate({ headers: { authorization: 'Bearer anything' } }), AuthenticationError);
  assert.throws(() => authentication.authenticate({ headers: {} }), AuthenticationError);
});

test('a configured service token authenticates as its assigned role, and a wrong token does not', () => {
  const authentication = new AuthenticationService({ tokens: 'secret-token:ci-runner:ADMIN' });
  assert.deepEqual(authentication.authenticate({ headers: { authorization: 'Bearer secret-token' } }), { actor: 'ci-runner', role: 'ADMIN', mode: 'bearer' });
  assert.throws(() => authentication.authenticate({ headers: { authorization: 'Bearer wrong-token' } }), AuthenticationError);
});
