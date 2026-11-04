import { ethers } from 'ethers';

/** Read-only client. The signer is the installation/device key registered by
 * Wallet login, not the asset wallet or a LiveKit server/admin API secret. */
export class RoomInteractionsClient {
  constructor({ apiBase, identity, deviceId, signer, getWalletToken, nodeId, kind, roomId, fetchImpl = fetch }) {
    const url = new URL(apiBase);
    if (url.protocol !== 'https:' && !['127.0.0.1', 'localhost'].includes(url.hostname)) throw new Error('API must use HTTPS');
    if (!['live', 'meeting'].includes(kind) || !ethers.isAddress(identity) || !deviceId || !nodeId || !/^[0-9a-f-]{36}$/.test(roomId)) throw new Error('Invalid room/device scope');
    Object.assign(this, { apiBase: apiBase.replace(/\/$/, ''), identity: identity.toLowerCase(), deviceId, signer, getWalletToken, nodeId: nodeId.toLowerCase(), kind, roomId, fetchImpl });
    this.credential = null;
  }
  async api(path) {
    const response = await this.fetchImpl(`${this.apiBase}${path}`, { headers: { Authorization: `Bearer ${await this.getWalletToken()}` } });
    const result = await response.json();
    if (!response.ok || !result.success) throw new Error(result.error || result.code || `HTTP ${response.status}`);
    return result.data;
  }
  async nodeCredential() {
    if (this.credential && this.credential.expiresAt > Date.now() + 15000) return this.credential;
    const credential = await this.api(`/wallet/room-control/nodes/${encodeURIComponent(this.nodeId)}/credential`);
    if (credential.nodeId !== this.nodeId || !credential.token || credential.expiresAt <= Date.now() || (credential.policyProtocolVersion ?? credential.protocolVersion) < 2) throw new Error('Invalid room-node credential');
    const url = new URL(credential.webSocketUrl);
    if (url.protocol !== 'wss:' || url.username || url.password || url.search || url.hash) throw new Error('Invalid node endpoint');
    this.credential = credential;
    return credential;
  }
  async messages({ after = '', limit = 50, scope } = {}) {
    const credential = await this.nodeCredential();
    const url = new URL(credential.webSocketUrl); url.protocol = 'https:'; url.pathname = '/gpc-control/interactions';
    const action = 'interactions-list', body = JSON.stringify({ after, limit, ...(scope ? { scope } : {}) });
    const timestamp = String(Math.floor(Date.now() / 1000)), nonce = ethers.hexlify(ethers.randomBytes(32)).slice(2);
    const target = `/gpc-control/v1/${this.kind}/${encodeURIComponent(this.roomId)}/${action}`;
    const statement = ['gpcwallet-request:v2', `wallet:${this.identity}`, `device:${this.deviceId}`, 'method:POST', `target:${target}`, `body-sha256:${ethers.sha256(ethers.toUtf8Bytes(body)).slice(2)}`, `timestamp:${timestamp}`, `nonce:${nonce}`].join('\n');
    const payload = { requestId: ethers.uuidV4(ethers.randomBytes(16)), kind: this.kind, roomId: this.roomId, action, body, timestamp, nonce, signature: await this.signer.signMessage(statement) };
    const response = await this.fetchImpl(url.toString(), { method: 'POST', headers: { Authorization: `Bearer ${credential.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    // The node also uses plain-text HTTP errors before its JSON handler, so
    // invalidate a rejected credential before attempting to parse the body.
    if (response.status === 401) this.credential = null;
    const result = await response.json().catch(() => null);
    if (!response.ok || !result || result.status !== 200 || result.requestId !== payload.requestId) throw new Error(result?.error || result?.code || `HTTP ${response.status}`);
    return result.data;
  }
  async gifts({ after = '', limit = 50 } = {}) {
    if (this.kind !== 'live') return { events: [], nextCursor: after, hasMore: false, cursorExpired: false };
    return this.api(`/wallet/live/rooms/${encodeURIComponent(this.roomId)}/gift-events?after=${encodeURIComponent(after)}&limit=${limit}`);
  }
  async read({ messages = '', gifts = '' } = {}, { limit = 50, scope } = {}) {
    const [chat, gift] = await Promise.all([this.messages({ after: messages, limit, scope }), this.gifts({ after: gifts, limit })]);
    return { events: [...chat.events, ...gift.events], cursor: { messages: chat.nextCursor, gifts: gift.nextCursor }, hasMore: chat.hasMore || gift.hasMore, cursorExpired: chat.cursorExpired || gift.cursorExpired };
  }
}
