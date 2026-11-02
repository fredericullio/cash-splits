import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { app, sql, generateRecurring } from './server.js';

let server, url;
before(async () => {
  await new Promise((resolve) => (server = app.listen(0, resolve)));
  url = `http://localhost:${server.address().port}`;
});
after(() => Promise.all([server.close(), sql.end()]));

// unique names per run, so tests never touch data entered by hand
const a = `ala-${Date.now()}`;
const b = `ola-${Date.now()}`;
const post = (path, body) =>
  fetch(url + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });

test('GET /health returns ok', async () => {
  const res = await fetch(`${url}/health`);
  assert.equal(await res.text(), 'ok');
});

test('POST /expenses rejects invalid input', async () => {
  for (const body of [
    {},
    { payer: a, amount: -5, shares: { [a]: 1 } },
    { payer: a, amount: 1.5, shares: { [a]: 1 } },
    { payer: a, amount: 100, shares: {} },
    { payer: a, amount: 100, shares: { [a]: 0 } },
  ]) assert.equal((await post('/expenses', body)).status, 400, JSON.stringify(body));
  assert.equal((await fetch(`${url}/expenses`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: 'nope' })).status, 400);
});

test('expenses split proportionally into balances', async () => {
  const res = await post('/expenses', { payer: a, amount: 1000, description: 'rent', shares: { [a]: 60, [b]: 40 } });
  assert.equal(res.status, 201);
  await post('/expenses', { payer: b, amount: 500, shares: { [a]: 1, [b]: 1 } });

  const expenses = await (await fetch(`${url}/expenses`)).json();
  assert.ok(expenses.some((e) => e.payer === a && e.description === 'rent'));

  const balances = await (await fetch(`${url}/balances`)).json();
  const mine = Object.fromEntries(balances.filter((x) => [a, b].includes(x.person)).map((x) => [x.person, x.balance]));
  assert.deepEqual(mine, { [a]: 150, [b]: -150 });
});

test('recurring expense is generated once per month', async () => {
  const res = await post('/recurring', { payer: a, amount: 300, description: 'internet', shares: { [a]: 1 }, day_of_month: 1 });
  assert.equal(res.status, 201);
  const { id } = await res.json();
  assert.equal((await post('/recurring', { payer: a, amount: 300, shares: { [a]: 1 }, day_of_month: 31 })).status, 400);

  await generateRecurring();
  await generateRecurring();
  const [{ count }] = await sql`select count(*)::int from expenses where recurring_id = ${id}`;
  assert.equal(count, 1);
});
