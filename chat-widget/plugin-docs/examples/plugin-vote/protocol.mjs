import { createHmac, timingSafeEqual } from 'node:crypto';
import { verifyMessage, getAddress } from 'ethers';

export function verifyWebhook(raw, headers, secret, appId, now = Date.now()) {
  const timestamp = String(headers['x-gpc-timestamp'] || ''), id = String(headers['x-gpc-event-id'] || '');
  const actual = String(headers['x-gpc-signature'] || '');
  if (!secret || !/^\d{10}$/.test(timestamp) || Math.abs(now / 1000 - Number(timestamp)) > 300 || !/^pe_[a-f0-9]{48}$/.test(id) || !/^[a-f0-9]{64}$/.test(actual)) throw Error('INVALID_WEBHOOK');
  const expected = createHmac('sha256', secret).update(timestamp + '.' + id + '.').update(raw).digest();
  if (!timingSafeEqual(Buffer.from(actual, 'hex'), expected)) throw Error('INVALID_SIGNATURE');
  const event = JSON.parse(raw.toString('utf8'));
  if (event.id !== id || event.appId !== appId) throw Error('WRONG_EVENT_APPLICATION');
  return { ...event, payload: JSON.parse(event.payload) };
}
export function verifyLogin(proof, origin, nonce, now = Date.now(), chainId = 56) {
  if (!proof || proof.origin !== origin || proof.nonce !== nonce || proof.chainId !== chainId) throw Error('INVALID_LOGIN');
  const issued = Date.parse(proof.issuedAt), expires = Date.parse(proof.expirationTime);
  if (!Number.isFinite(issued) || !Number.isFinite(expires) || issued > now + 30000 || expires <= now || expires - issued !== 300000 || now - issued > 300000) throw Error('EXPIRED_LOGIN');
  const address = getAddress(proof.address);
  const message = `${new URL(origin).host} wants you to sign in with your Ethereum account:\n${address}\n\nSign in to this DApp with your GPC identity wallet. This request grants no transaction or asset permissions.\n\nURI: ${origin}\nVersion: 1\nChain ID: ${proof.chainId}\nNonce: ${nonce}\nIssued At: ${proof.issuedAt}\nExpiration Time: ${proof.expirationTime}`;
  if (message !== proof.message || verifyMessage(message, proof.signature) !== address) throw Error('INVALID_SIGNATURE');
  return address;
}
