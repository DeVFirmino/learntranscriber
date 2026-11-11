const LOCAL_IDENTITY = 'LearnTranscriber Dev';

function localSigningIdentity(identities, preferred) {
  const names = Array.from(identities.matchAll(/"([^"\r\n]+)"/g), (match) => match[1]);
  const requested = preferred?.trim();
  if (requested) {
    if (names.filter((name) => name === requested).length !== 1)
      throw new Error(
        'LEARNTRANSCRIBER_LOCAL_IDENTITY is not available or is ambiguous in the valid signing identities.',
      );
    return requested;
  }
  const development = names.filter((name) => name.startsWith('Apple Development:'));
  if (development.length > 1)
    throw new Error(
      'Multiple Apple Development identities are available. Set LEARNTRANSCRIBER_LOCAL_IDENTITY to choose one.',
    );
  if (development.length === 1) return development[0];
  return names.includes(LOCAL_IDENTITY) ? LOCAL_IDENTITY : null;
}

module.exports = { LOCAL_IDENTITY, localSigningIdentity };
