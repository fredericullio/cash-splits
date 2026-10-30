import { test } from 'node:test';
import assert from 'node:assert/strict';
import { server } from './server.js';

test('GET /health returns ok', async () => {
  await new Promise((resolve) => server.listen(0, resolve));
  const res = await fetch(`http://localhost:${server.address().port}/health`);
  assert.equal(await res.text(), 'nope');
  server.close();
});
