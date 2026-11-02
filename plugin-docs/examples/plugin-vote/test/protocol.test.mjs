import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { Wallet } from 'ethers';
import { verifyLogin, verifyWebhook } from '../protocol.mjs';
test('webhook verifies exact raw bytes, application, time and event ID', () => {
  const secret = 'test-secret', id = 'pe_' + 'a'.repeat(48), timestamp = '1800000000';
  const raw = Buffer.from(JSON.stringify({ id, appId: 'app', kind: 'installation.authorized', payload: '{"installationId":"i"}' }));
  const headers = { 'x-gpc-event-id': id, 'x-gpc-timestamp': timestamp, 'x-gpc-signature': createHmac('sha256', secret).update(timestamp + '.' + id + '.').update(raw).digest('hex') };
  assert.equal(verifyWebhook(raw, headers, secret, 'app', 1800000000000).payload.installationId, 'i');
  assert.throws(() => verifyWebhook(Buffer.concat([raw, Buffer.from(' ')]), headers, secret, 'app', 1800000000000));
  assert.throws(() => verifyWebhook(raw, headers, secret, 'another-app', 1800000000000));
  assert.throws(() => verifyWebhook(raw, headers, secret, 'app', 1800000600000));
});
test('login verifies exact wallet-owned template, source, nonce, expiry and signature', async () => {
  const wallet = new Wallet('0x' + '11'.repeat(32)), origin = 'https://plugins.example', nonce = 'a'.repeat(32), now = 1800000000000;
  const proof = { address: wallet.address, origin, nonce, chainId: 56, issuedAt: new Date(now).toISOString(), expirationTime: new Date(now + 300000).toISOString() };
  proof.message = `plugins.example wants you to sign in with your Ethereum account:\n${wallet.address}\n\nSign in to this DApp with your GPC identity wallet. This request grants no transaction or asset permissions.\n\nURI: ${origin}\nVersion: 1\nChain ID: 56\nNonce: ${nonce}\nIssued At: ${proof.issuedAt}\nExpiration Time: ${proof.expirationTime}`;
  proof.signature = await wallet.signMessage(proof.message);
  assert.equal(verifyLogin(proof, origin, nonce, now), wallet.address);
  assert.throws(() => verifyLogin(proof, 'https://evil.example', nonce, now));
  assert.throws(() => verifyLogin(proof, origin, 'b'.repeat(32), now));
  assert.throws(() => verifyLogin(proof, origin, nonce, now + 300001));
});
