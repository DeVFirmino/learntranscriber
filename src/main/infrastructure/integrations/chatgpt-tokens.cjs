const { validateIdentity, planScopes } = require('../../domain/integrations/chatgpt-identity.cjs');

const expiresAt = (tokens) => Date.now() + Number(tokens.expires_in || 3600) * 1000;

/**
 * Exchanges an authorization code for the plan's tokens and returns the new account record. The identity token
 * must carry the sign-in's nonce and, for a saved account, its subject.
 */
async function exchangedAccount({ endpoints, issuer, issued, code, flow, redirect, subject }) {
  const tokens = await endpoints.tokenGrant(
    { grant_type: 'authorization_code', client_id: issued, code, code_verifier: flow.verifier, redirect_uri: redirect },
    flow.controller.signal,
  );
  const identity = validateIdentity(tokens.id_token, await endpoints.keys(), {
    issuer,
    clientId: issued,
    nonce: flow.nonce,
    subject,
    now: Date.now(),
  });
  return {
    ...identity,
    client_id: issued,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
    id_token: tokens.id_token,
    scopes: planScopes(tokens),
    expiresAt: expiresAt(tokens),
  };
}

/**
 * Exchanges a saved account's refresh token for a new access token and returns the renewed account record. The
 * plan's direct token use must still be granted, and a new identity token must belong to the same subject.
 */
async function renewedAccount({ account, endpoints, issuer }) {
  if (!account.refresh_token) throw new Error('Sign in to ChatGPT again.');
  const tokens = await endpoints.tokenGrant({
    grant_type: 'refresh_token',
    client_id: account.client_id,
    refresh_token: account.refresh_token,
  });
  if (!tokens.access_token || tokens.token_type?.toLowerCase() !== 'bearer')
    throw new Error('ChatGPT renewal failed. Sign in again.');
  const scopes = tokens.scope ? tokens.scope.split(' ') : account.scopes;
  if (!scopes.includes('chatgpt.tokens.use.direct')) throw new Error('ChatGPT plan usage is no longer authorized.');
  if (tokens.id_token)
    validateIdentity(tokens.id_token, await endpoints.keys(), {
      issuer,
      clientId: account.client_id,
      subject: account.subject,
      now: Date.now(),
    });
  return {
    ...account,
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token || account.refresh_token,
    id_token: tokens.id_token || account.id_token,
    scopes,
    expiresAt: expiresAt(tokens),
  };
}

module.exports = { exchangedAccount, renewedAccount };
