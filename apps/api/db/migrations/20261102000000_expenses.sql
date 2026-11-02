-- migrate:up
create table recurring_expenses (
  id int generated always as identity primary key,
  payer text not null,
  amount int not null check (amount > 0), -- grosze
  description text not null default '',
  shares jsonb not null, -- {"person": weight}, split proportionally
  day_of_month int not null check (day_of_month between 1 and 28)
);

create table expenses (
  id int generated always as identity primary key,
  payer text not null,
  amount int not null check (amount > 0), -- grosze
  description text not null default '',
  shares jsonb not null, -- {"person": weight}, split proportionally
  recurring_id int references recurring_expenses,
  period date, -- month the recurring expense was generated for
  created_at timestamptz not null default now(),
  unique (recurring_id, period) -- recurring job can run twice safely
);

-- migrate:down
drop table expenses, recurring_expenses;
