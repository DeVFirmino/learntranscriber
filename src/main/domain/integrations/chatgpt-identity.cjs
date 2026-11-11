const { createHash, createPublicKey, verify } = require('node:crypto');

const SCOPES = 'openid profile email offline_access resource.invoke chatgpt.tokens.use.direct';
const DYNAMIC_CLIENT = 'dynamic_agent_client';

// Verifies an OpenID identity token against the issuer's keys, audience, time window, nonce and known subject.
// `now` is the current time in milliseconds.
function validateIdentity(token, jwks, { issuer, clientId, nonce, subject, now }) {
  const pieces = String(token || '').split('.');
  if (pieces.length !== 3 || String(token).length > 32000) throw new Error('Invalid ChatGPT identity token.');
  let header, claims;
  try {
    header = JSON.parse(Buffer.from(pieces[0], 'base64url'));
    claims = JSON.parse(Buffer.from(pieces[1], 'base64url'));
  } catch {
    throw new Error('Invalid ChatGPT identity token.');
  }
  if (!['RS256', 'ES256'].includes(header.alg) || header.crit) throw new Error('Unsupported identity signature.');
  const keys = (jwks.keys || []).filter(
    (k) => k.kid === header.kid && (!k.alg || k.alg === header.alg) && (!k.use || k.use === 'sig'),
  );
  if (
    keys.length !== 1 ||
    !verify(
      'sha256',
      Buffer.from(pieces[0] + '.' + pieces[1]),
      { key: createPublicKey({ key: keys[0], format: 'jwk' }), dsaEncoding: 'ieee-p1363' },
      Buffer.from(pieces[2], 'base64url'),
    )
  )
    throw new Error('ChatGPT identity signature is invalid.');
  const audiences = Array.isArray(claims.aud) ? claims.aud : [claims.aud],
    seconds = now / 1000;
  if (
    claims.iss !== issuer ||
    !audiences.includes(clientId) ||
    (audiences.length > 1 && claims.azp !== clientId) ||
    !Number.isFinite(claims.exp) ||
    claims.exp < seconds ||
    claims.nbf > seconds + 60 ||
    claims.iat > seconds + 60 ||
    typeof claims.sub !== 'string' ||
    !claims.sub ||
    (nonce && claims.nonce !== nonce) ||
    (subject && claims.sub !== subject)
  )
    throw new Error('ChatGPT identity validation failed.');
  return { subject: claims.sub, email: typeof claims.email === 'string' ? claims.email.slice(0, 200) : '' };
}

// The client id the authorization issued: the redirect's, or the saved one; a dynamic placeholder never counts.
function issuedClient(returned, clientId) {
  const issued = returned || (clientId !== DYNAMIC_CLIENT ? clientId : null);
  if (
    !issued ||
    issued === DYNAMIC_CLIENT ||
    !/^[A-Za-z0-9_-]{1,200}$/.test(issued) ||
    (clientId !== DYNAMIC_CLIENT && issued !== clientId)
  )
    return null;
  return issued;
}

// The authorization request for a PKCE sign-in, registering a dynamic client on first use.
function authorizationParams({ clientId, hostId, redirect, resource, flow, idTokenHint }) {
  return {
    client_id: clientId,
    ext_agent_host_id: hostId,
    response_type: 'code',
    redirect_uri: redirect,
    scope: SCOPES,
    resource,
    state: flow.state,
    nonce: flow.nonce,
    code_challenge_method: 'S256',
    code_challenge: createHash('sha256').update(flow.verifier).digest('base64url'),
    ...(clientId === DYNAMIC_CLIENT ? { agent_name_hint: 'LearnTranscriber' } : {}),
    ...(idTokenHint ? { id_token_hint: idTokenHint } : {}),
  };
}

// The granted scopes, refused unless the plan's direct token use and resource access were both granted.
function planScopes(tokens) {
  const scopes = String(tokens.scope || '').split(' ');
  if (
    !scopes.includes('chatgpt.tokens.use.direct') ||
    !scopes.includes('resource.invoke') ||
    typeof tokens.access_token !== 'string' ||
    tokens.token_type?.toLowerCase() !== 'bearer'
  )
    throw new Error('ChatGPT plan permission was not granted.');
  return scopes;
}

// A stable local id for one identity of one client.
const accountKey = (clientId, subject) =>
  createHash('sha256')
    .update(clientId + '\0' + subject)
    .digest('hex')
    .slice(0, 24);

module.exports = { DYNAMIC_CLIENT, validateIdentity, issuedClient, authorizationParams, planScopes, accountKey };
