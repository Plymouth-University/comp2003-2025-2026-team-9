-- Update all current public-schema foreign keys that reference auth.users
-- so deleting an auth user automatically deletes dependent public rows.
--
-- This is aimed at user-owned tables such as profiles, peer_swipes,
-- expo_push_tokens, notification_preferences, and similar tables that
-- should not outlive the auth user they belong to.

do $$
declare
  fk record;
  local_columns text;
  referenced_columns text;
  match_clause text;
  update_clause text;
  deferrable_clause text;
begin
  for fk in
    select
      c.oid as constraint_oid,
      n.nspname as table_schema,
      cls.relname as table_name,
      c.conname as constraint_name,
      c.conrelid,
      c.confrelid,
      c.conkey,
      c.confkey,
      c.confmatchtype,
      c.confupdtype,
      c.condeferrable,
      c.condeferred,
      pg_get_constraintdef(c.oid) as constraint_def
    from pg_constraint c
    join pg_class cls on cls.oid = c.conrelid
    join pg_namespace n on n.oid = cls.relnamespace
    where c.contype = 'f'
      and n.nspname = 'public'
      and c.confrelid = 'auth.users'::regclass
  loop
    if position('ON DELETE CASCADE' in upper(fk.constraint_def)) > 0 then
      continue;
    end if;

    select string_agg(quote_ident(att.attname), ', ' order by cols.ordinality)
    into local_columns
    from unnest(fk.conkey) with ordinality as cols(attnum, ordinality)
    join pg_attribute att
      on att.attrelid = fk.conrelid
     and att.attnum = cols.attnum;

    select string_agg(quote_ident(att.attname), ', ' order by cols.ordinality)
    into referenced_columns
    from unnest(fk.confkey) with ordinality as cols(attnum, ordinality)
    join pg_attribute att
      on att.attrelid = fk.confrelid
     and att.attnum = cols.attnum;

    match_clause :=
      case fk.confmatchtype
        when 'f' then ' MATCH FULL'
        when 'p' then ' MATCH PARTIAL'
        else ''
      end;

    update_clause :=
      case fk.confupdtype
        when 'c' then ' ON UPDATE CASCADE'
        when 'n' then ' ON UPDATE SET NULL'
        when 'd' then ' ON UPDATE SET DEFAULT'
        when 'r' then ' ON UPDATE RESTRICT'
        else ' ON UPDATE NO ACTION'
      end;

    deferrable_clause :=
      case
        when fk.condeferrable and fk.condeferred then ' DEFERRABLE INITIALLY DEFERRED'
        when fk.condeferrable then ' DEFERRABLE INITIALLY IMMEDIATE'
        else ' NOT DEFERRABLE'
      end;

    execute format(
      'alter table %I.%I drop constraint %I',
      fk.table_schema,
      fk.table_name,
      fk.constraint_name
    );

    execute format(
      'alter table %I.%I add constraint %I foreign key (%s) references auth.users (%s)%s%s ON DELETE CASCADE%s',
      fk.table_schema,
      fk.table_name,
      fk.constraint_name,
      local_columns,
      referenced_columns,
      match_clause,
      update_clause,
      deferrable_clause
    );
  end loop;
end
$$;
