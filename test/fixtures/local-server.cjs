const { createServer } = require('node:http');
const index = process.argv.indexOf('--port'),
  port = Number(process.argv[index + 1]);
const server = createServer(async (req, res) => {
  for await (const chunk of req) void chunk;
  res.setHeader('content-type', 'application/json');
  if (req.url === '/health' || req.url === '/') res.end('{"status":"ok"}');
  else if (req.url === '/props')
    res.end(
      JSON.stringify({
        default_generation_settings: { n_ctx: Number(process.argv[process.argv.indexOf('-c') + 1]) },
        total_slots: 1,
      }),
    );
  else if (req.url === '/inference') res.end('{"text":"Local fixture transcript"}');
  else if (req.url === '/v1/models') res.end('{"data":[{"id":"fixture-local"}]}');
  else {
    res.writeHead(404);
    res.end('{}');
  }
});
server.listen(port, '127.0.0.1');
process.on('SIGTERM', () => server.close(() => process.exit(0)));
