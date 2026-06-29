create table email_events (
  id          uuid        primary key default gen_random_uuid(),
  message_id  text        not null,
  note_id     uuid        not null references notes(id) on delete cascade,
  recipient   text        not null,
  event_type  text        not null,
  created_at  timestamptz not null default now()
);

create index on email_events (note_id, created_at desc);
create index on email_events (message_id);

alter table email_events enable row level security;

grant select, insert on table email_events to anon, authenticated;

create policy "anyone can insert email_events"
  on email_events for insert to anon, authenticated
  with check (true);

create policy "anyone can read email_events"
  on email_events for select to anon, authenticated
  using (true);
