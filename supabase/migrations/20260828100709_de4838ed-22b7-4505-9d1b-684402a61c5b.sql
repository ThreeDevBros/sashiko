-- Nightly retention cleanup to prevent disk exhaustion (pg_cron history + email logs)
create or replace function public.cleanup_operational_logs()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from cron.job_run_details where end_time < now() - interval '2 days';
  delete from public.email_send_log where created_at < now() - interval '30 days';
end;
$$;

revoke all on function public.cleanup_operational_logs() from public, anon, authenticated;

select cron.schedule(
  'cleanup-operational-logs',
  '15 3 * * *',
  $$select public.cleanup_operational_logs();$$
);