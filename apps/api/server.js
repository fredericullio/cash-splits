import express from 'express';
import postgres from 'postgres';

export const sql = postgres(process.env.DATABASE_URL ?? 'postgres://postgres:postgres@localhost:5433/cash_splits');

const isExpense = (b) =>
  typeof b?.payer === 'string' && b.payer.trim() !== '' &&
  Number.isInteger(b.amount) && b.amount > 0 &&
  (b.description === undefined || typeof b.description === 'string') &&
  b.shares?.constructor === Object && Object.keys(b.shares).length > 0 &&
  Object.values(b.shares).every((w) => Number.isInteger(w) && w > 0);

const isRecurring = (b) => isExpense(b) && Number.isInteger(b.day_of_month) && b.day_of_month >= 1 && b.day_of_month <= 28;

const expense = (b) => ({ payer: b.payer, amount: b.amount, description: b.description ?? '', shares: sql.json(b.shares) });

// idempotent: unique (recurring_id, period) makes a second run in the same month a no-op
export const generateRecurring = async () => (await sql`
  insert into expenses (payer, amount, description, shares, recurring_id, period)
  select payer, amount, description, shares, id, date_trunc('month', current_date)::date
  from recurring_expenses where day_of_month <= extract(day from current_date)
  on conflict (recurring_id, period) do nothing`).count;

export const app = express();
app.use(express.json());

app.get('/health', (req, res) => res.send('ok'));
app.get('/', (req, res) => res.send(`Hello from ${process.env.APP_VERSION ?? 'dev'}`));

app.get('/expenses', async (req, res) => res.json(await sql`select * from expenses order by id desc`));
app.post('/expenses', async (req, res) => {
  if (!isExpense(req.body)) return res.status(400).send('invalid input');
  res.status(201).json((await sql`insert into expenses ${sql(expense(req.body))} returning *`)[0]);
});

app.get('/recurring', async (req, res) => res.json(await sql`select * from recurring_expenses order by id`));
app.post('/recurring', async (req, res) => {
  if (!isRecurring(req.body)) return res.status(400).send('invalid input');
  const row = { ...expense(req.body), day_of_month: req.body.day_of_month };
  res.status(201).json((await sql`insert into recurring_expenses ${sql(row)} returning *`)[0]);
});

// positive balance = others owe this person; rounded per person, so totals can be off by a grosz
app.get('/balances', async (req, res) => res.json(await sql`
  select person, round(sum(delta))::int as balance from (
    select payer as person, amount::numeric as delta from expenses
    union all
    select s.key, -e.amount * s.value::numeric / (select sum(value::numeric) from jsonb_each_text(e.shares))
    from expenses e, jsonb_each_text(e.shares) s
  ) t group by person order by person`));

// invalid JSON body -> 400 (status set by express.json); anything else -> logged 500
app.use((err, req, res, next) => {
  const status = err.status ?? 500;
  if (status >= 500) console.error(err);
  res.status(status).send(status < 500 ? 'invalid input' : 'internal error');
});

if (import.meta.main) app.listen(process.env.PORT ?? 3000);
