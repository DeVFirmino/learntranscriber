const { randomUUID, randomBytes } = require('node:crypto');
const { DYNAMIC_CLIENT, authorizationParams, accountKey } = require('../../domain/integrations/chatgpt-identity.cjs');
const { listenForAuthorization } = require('./chatgpt-callback.cjs');
const { chatgptApi } = require('./chatgpt-api.cjs');
const { exchangedAccount, renewedAccount } = require('./chatgpt-tokens.cjs');

const CANCELLED = 'ChatGPT sign-in cancelled.';

/**
 * ChatGPT plan sign-in (PKCE through the browser), saved accounts and access-token renewal. A generation counter
 * retires sign-ins and renewals that a cancel or logout overtook; account writes are serialized.
 * `fetch`, `openBrowser` and `loginPromise` stay properties so a caller can observe or replace them.
 */
class ChatGPTAuth {
  constructor(load, save, openBrowser, options = {}) {
    this.load = load;
    this.save = save;
    this.openBrowser = openBrowser;
    this.fetch = options.fetch || fetch;
    this.issuer = options.issuer || 'https://auth.openai.com';
    this.api = options.api || 'https://api.openai.com/v1';
    this.endpoints = chatgptApi({ fetch: (url, init) => this.fetch(url, init), issuer: this.issuer, api: this.api });
    this.flow = null;
    this.refreshes = new Map();
    this.timeout = options.timeout || 180000;
    this.generation = 0;
    this.writes = Promise.resolve();
    this.loginPromise = null;
  }
  async data() {
    return (await this.load()) || { hostId: 'urn:uuid:' + randomUUID(), accounts: {}, activeId: null };
  }
  change(action) {
    const pending = this.writes.then(async () => {
      const data = await this.data();
      const result = action(data);
      await this.save(data);
      return result;
    });
    this.writes = pending.catch(() => {});
    return pending;
  }
  async state() {
    const data = await this.data();
    return {
      accounts: Object.entries(data.accounts).map(([id, a]) => ({
        id,
        label: (a.email || 'ChatGPT account') + ' · ' + id.slice(0, 6),
        authenticated: Boolean(a.access_token),
      })),
      activeId: data.activeId,
      pending: Boolean(this.flow || this.loginPromise),
    };
  }
  cancel() {
    if (this.flow || this.loginPromise) this.generation++;
    if (this.flow) {
      this.flow.controller.abort();
      this.flow.reject(new Error(CANCELLED));
    }
  }
  async login(accountId) {
    if (this.loginPromise) throw new Error('A ChatGPT sign-in is already waiting.');
    const pending = this.performLogin(accountId);
    this.loginPromise = pending;
    try {
      return await pending;
    } finally {
      this.loginPromise = null;
    }
  }
  overtaken(generation, flow) {
    if (generation !== this.generation || flow.controller.signal.aborted) throw new Error(CANCELLED);
  }
  async performLogin(accountId) {
    const generation = this.generation;
    if (this.flow) throw new Error('A ChatGPT sign-in is already waiting.');
    const data = await this.data(),
      existing = accountId ? data.accounts[accountId] : null;
    if (accountId && !existing) throw new Error('Choose a saved ChatGPT account.');
    await this.change((current) => {
      data.hostId = current.hostId;
    });
    const clientId = existing?.client_id || data.pendingClientId || DYNAMIC_CLIENT,
      flow = {
        state: randomBytes(32).toString('hex'),
        nonce: randomBytes(32).toString('hex'),
        verifier: randomBytes(32).toString('base64url'),
        controller: new AbortController(),
        reject: () => {},
      };
    this.flow = flow;
    let timer, listener;
    try {
      listener = await listenForAuthorization({ flow, clientId });
      const url = new URL(this.issuer + '/api/accounts/authorize');
      const params = authorizationParams({
        clientId,
        hostId: data.hostId,
        redirect: listener.redirect,
        resource: this.api,
        flow,
        idTokenHint: existing?.id_token,
      });
      this.overtaken(generation, flow);
      url.search = new URLSearchParams(params).toString();
      timer = setTimeout(() => this.cancel(), this.timeout);
      timer.unref?.();
      await this.openBrowser(url.href);
      const { code, issued } = await listener.callback;
      if (!existing) {
        data.pendingClientId = issued;
        await this.change((current) => {
          current.pendingClientId = issued;
        });
      }
      const account = await exchangedAccount({
        endpoints: this.endpoints,
        issuer: this.issuer,
        issued,
        code,
        flow,
        redirect: listener.redirect,
        subject: existing?.subject,
      });
      this.overtaken(generation, flow);
      const id = accountId || accountKey(issued, account.subject);
      await this.change((current) => {
        if (generation !== this.generation) throw new Error('Sign-in cancelled.');
        current.accounts[id] = account;
        current.activeId = id;
        delete current.pendingClientId;
      });
      return this.state();
    } finally {
      clearTimeout(timer);
      await listener?.close();
      this.flow = null;
    }
  }
  async select(id) {
    await this.change((data) => {
      if (!data.accounts[id]) throw new Error('Account not found.');
      data.activeId = id;
    });
    return this.state();
  }
  async token() {
    const data = await this.data(),
      id = data.activeId,
      account = data.accounts[id];
    if (!account?.access_token) throw new Error('Continue with ChatGPT in AI sources first.');
    if (account.expiresAt > Date.now() + 60000) return account.access_token;
    if (!this.refreshes.has(id))
      this.refreshes.set(
        id,
        this.renew(id, this.generation).finally(() => this.refreshes.delete(id)),
      );
    return this.refreshes.get(id);
  }
  // One renewal per account at a time; a logout meanwhile discards its result.
  async renew(id, generation) {
    const account = (await this.data()).accounts[id];
    if (!account?.access_token || generation !== this.generation) throw new Error('ChatGPT was signed out.');
    if (account.expiresAt > Date.now() + 60000) return account.access_token;
    const renewed = await renewedAccount({ account, endpoints: this.endpoints, issuer: this.issuer });
    await this.change((latest) => {
      if (generation !== this.generation || !latest.accounts[id]?.access_token)
        throw new Error('ChatGPT was signed out.');
      latest.accounts[id] = renewed;
    });
    return renewed.access_token;
  }
  // Local invalidation happens first, so no request can use the account while remote revocation is pending.
  async logout(id) {
    this.generation++;
    this.cancel();
    let captured = null;
    await this.change((current) => {
      const record = current.accounts[id];
      if (record) {
        if (record.refresh_token) captured = { token: record.refresh_token, clientId: record.client_id };
        delete record.access_token;
        delete record.refresh_token;
        delete record.id_token;
        record.scopes = [];
      }
      if (current.activeId === id) current.activeId = null;
    });
    const revoked = captured ? await this.endpoints.revoke(captured) : false;
    return { revoked, state: await this.state() };
  }
  close() {
    this.generation++;
    this.cancel();
  }
}
module.exports = { ChatGPTAuth };
