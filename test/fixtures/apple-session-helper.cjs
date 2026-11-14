const args = process.argv.slice(2);
const value = (name) => args[args.indexOf(name) + 1];
const speaker = value('--speaker-label');
const sessionId = value('--session-id');
const send = (message) => process.stdout.write(JSON.stringify({ sessionId, speakerLabel: speaker, ...message }) + '\n');
let received = 0;
let partial = false;
process.stdin.on('data', (chunk) => {
  received += chunk.length;
  if (!partial) {
    partial = true;
    send({ type: 'partial', text: `draft ${speaker}` });
  }
});
process.stdin.on('end', () => {
  if (received) send({ type: 'final', text: `final ${speaker}` });
  process.exit(0);
});
if (args.includes('--startup-error')) {
  send({ type: 'error', error: 'Fixture language unavailable.' });
  process.exit(1);
} else if (args.includes('--delay-ready'))
  setTimeout(() => send({ type: 'ready', resolvedLocale: value('--language') || 'en-US' }), 250);
else send({ type: 'ready', resolvedLocale: value('--language') || 'en-US' });
