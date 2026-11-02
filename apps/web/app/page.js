import { revalidatePath } from 'next/cache';
import { connection } from 'next/server';

const api = process.env.API_URL ?? 'http://localhost:3001';
const zl = (grosze) => `${(grosze / 100).toFixed(2)} zł`;
const get = async (path) => (await fetch(api + path)).json();

async function addExpense(form) {
  'use server';
  // "Maciej:60, Partner:40" -> { Maciej: 60, Partner: 40 }; no weight = 1, so "A, B" splits equally
  const shares = Object.fromEntries(form.get('split').split(',').map((part) => {
    const [name, weight = '1'] = part.split(':');
    return [name.trim(), Number(weight)];
  }));
  const res = await fetch(`${api}/expenses`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      payer: form.get('payer').trim(),
      amount: Math.round(Number(form.get('amount')) * 100),
      description: form.get('description'),
      shares,
    }),
  });
  // ponytail: generic error page; add inline form errors when someone hits it
  if (!res.ok) throw new Error(`API rejected the expense: ${res.status}`);
  revalidatePath('/');
}

export default async function Home() {
  await connection(); // render on each request; the API isn't reachable at build time
  const [balances, expenses] = await Promise.all([get('/balances'), get('/expenses')]);

  return (
    <main>
      <h1>cash-splits</h1>

      <h2>Balances</h2>
      <table>
        <thead><tr><th>Person</th><th>Balance</th></tr></thead>
        <tbody>
          {balances.map((b) => (
            <tr key={b.person}>
              <td>{b.person}</td>
              <td className="num">{b.balance > 0 ? `is owed ${zl(b.balance)}` : b.balance < 0 ? `owes ${zl(-b.balance)}` : 'settled'}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>Add expense</h2>
      <form action={addExpense}>
        <label htmlFor="payer">Paid by</label>
        <input id="payer" name="payer" required />

        <label htmlFor="amount">Amount (zł)</label>
        <input id="amount" name="amount" type="number" inputMode="decimal" min="0.01" step="0.01" required />

        <label htmlFor="description">Description</label>
        <input id="description" name="description" />

        <label htmlFor="split">Split between</label>
        <span id="split-hint" className="hint">Name:weight, comma-separated. Maciej:60, Partner:40 or Maciej, Partner for equal.</span>
        <input id="split" name="split" required pattern="\s*[^:,]+(:[1-9]\d*)?(\s*,\s*[^:,]+(:[1-9]\d*)?)*\s*" aria-describedby="split-hint" />

        <button>Add expense</button>
      </form>

      <h2>Expenses</h2>
      <table>
        <thead><tr><th>Date</th><th>Description</th><th>Paid by</th><th>Amount</th></tr></thead>
        <tbody>
          {expenses.map((e) => (
            <tr key={e.id}>
              <td>{new Date(e.created_at).toLocaleDateString('pl-PL')}</td>
              <td>{e.description}</td>
              <td>{e.payer}</td>
              <td className="num">{zl(e.amount)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
