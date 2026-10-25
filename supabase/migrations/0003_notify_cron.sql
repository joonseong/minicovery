create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 10분마다 알림 발송. CRON_SECRET은 Vault의 'cron_secret'에서 읽는다 (대표가 대시보드에서 넣음)
select cron.schedule(
  'minicovery-notify',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://minicovery.vercel.app/api/cron/notify',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
