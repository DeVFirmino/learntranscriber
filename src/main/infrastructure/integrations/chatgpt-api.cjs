/**
 * The OpenAI identity endpoints ChatGPT sign-in uses: JSON requests restricted to the issuer and API origins,
 * OpenID discovery and keys, token grants and refresh-token revocation. `fetch` is read on every request.
 */
function chatgptApi({ fetch, issuer, api }) {
  async function json(url, options = {}) {
    const parsed = new URL(url);
    if (parsed.origin !== issuer && parsed.origin !== new URL(api).origin)
      throw new Error('Unexpected ChatGPT endpoint.');
    const response = await fetch(parsed, {
      ...options,
      redirect: 'error',
      signal: options.signal || AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      // The OAuth reason (for example invalid_grant for an expired sign-in) says what to do; tokens are never in it.
      let reason = '';
      try {
        const body = JSON.parse((await response.text()).slice(0, 4000));
        reason = String(body.error_description || body.error?.message || body.error || '').slice(0, 200);
      } catch {
        /* No readable reason. */
      }
      throw new Error(
        `ChatGPT returned HTTP ${response.status}${reason ? ` (${reason})` : ''}. Sign in again or check plan access.`,
      );
    }
    let data;
    try {
      data = await response.json();
    } catch {
      throw new Error('ChatGPT returned an invalid response.');
    }
    if (JSON.stringify(data).length > 1000000) throw new Error('ChatGPT response exceeds the size limit.');
    return data;
  }
  async function discovery() {
    const value = await json(issuer + '/.well-known/openid-configuration');
    if (value.issuer !== issuer || new URL(value.jwks_uri).origin !== issuer)
      throw new Error('Invalid OpenAI identity metadata.');
    return value;
  }
  return {
    json,
    discovery,
    keys: async () => json((await discovery()).jwks_uri),
    tokenGrant: (fields, signal) =>
      json(issuer + '/api/accounts/oauth/token', {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ ...fields, resource: api }),
        signal,
      }),
    // Best effort: whether the issuer confirmed revoking the refresh token.
    async revoke({ token, clientId }) {
      try {
        const metadata = await discovery();
        if (!metadata.revocation_endpoint || new URL(metadata.revocation_endpoint).origin !== issuer) return false;
        const response = await fetch(metadata.revocation_endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({ token, token_type_hint: 'refresh_token', client_id: clientId }),
          redirect: 'error',
          signal: AbortSignal.timeout(10000),
        });
        const revoked = response.ok;
        await response.body?.cancel().catch(() => {});
        return revoked;
      } catch {
        return false;
      }
    },
  };
}
module.exports = { chatgptApi };
