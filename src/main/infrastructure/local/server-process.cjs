const net = require('node:net');
const { setTimeout: delay } = require('node:timers/promises');
const { jsonReply } = require('./context-measurement.cjs');
const { slotCapacity } = require('../../domain/providers/local-server.cjs');

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;
  await new Promise((resolve) => server.close(resolve));
  return port;
}

/**
 * Spawns a local server for `runtime` with a minimal environment, keeping the end of its stderr. `runtime.exit`
 * settles when it exits; a server that exits while starting, or fails to spawn, leaves an error on the runtime.
 */
function spawnServer({ spawn, binary, args, runtime, onExit }) {
  const env = Object.fromEntries(
    ['PATH', 'HOME', 'TMPDIR', 'LANG'].filter((k) => process.env[k]).map((k) => [k, process.env[k]]),
  );
  const child = spawn(binary, args, { shell: false, stdio: ['ignore', 'ignore', 'pipe'], env });
  runtime.child = child;
  runtime.stderr = '';
  child.stderr?.on('data', (chunk) => {
    runtime.stderr = (runtime.stderr + String(chunk)).slice(-8192);
  });
  runtime.exit = new Promise((resolve) => {
    const finished = (error) => {
      const starting = runtime.status === 'starting';
      runtime.child = null;
      runtime.status = 'stopped';
      if (error || starting) runtime.error = 'The server exited. Check the executable and model compatibility.';
      clearTimeout(runtime.idle);
      resolve();
      onExit();
    };
    child.once('error', () => finished(true));
    child.once('exit', () => finished(false));
  });
}

/**
 * Polls the server's health until it answers, then, for a language model, reads the context each slot really has.
 * Returns that capacity, or null for Whisper.
 */
async function waitForServer({ fetch, runtime, type, config, signal }) {
  for (;;) {
    signal.throwIfAborted();
    if (!runtime.child)
      throw new Error('The local server exited before becoming ready. Check its executable and model.');
    let ready = false;
    try {
      const response = await fetch(runtime.base + (type === 'llm' ? '/health' : '/'), {
        signal: AbortSignal.any([signal, AbortSignal.timeout(1000)]),
        redirect: 'error',
      });
      await response.body?.cancel();
      ready = response.ok;
    } catch (error) {
      if (signal.aborted) throw error;
    }
    if (ready) {
      if (type !== 'llm') return null;
      const props = await jsonReply(
        await fetch(runtime.base + '/props', {
          signal: AbortSignal.any([signal, AbortSignal.timeout(5000)]),
          redirect: 'error',
        }),
      );
      return slotCapacity(props, config);
    }
    await delay(500, undefined, { signal });
  }
}

// Asks the server to exit, then kills it if it does not within two seconds.
async function terminateServer(runtime) {
  const child = runtime.child;
  child.kill('SIGTERM');
  await Promise.race([runtime.exit, delay(2000)]);
  if (runtime.child) {
    child.kill('SIGKILL');
    await Promise.race([runtime.exit, delay(1000)]);
  }
}

module.exports = { freePort, spawnServer, waitForServer, terminateServer };
