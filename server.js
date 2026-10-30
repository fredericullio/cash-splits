import { createServer } from 'node:http';

export const server = createServer((req, res) => {
  if (req.url === '/health') return res.end('ok');
  res.end(`Hello from ${process.env.APP_VERSION ?? 'dev'}`);
});

if (import.meta.main) server.listen(process.env.PORT ?? 3000);
