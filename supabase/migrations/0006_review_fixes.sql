-- 리뷰 반영 (대표가 Supabase SQL 편집기에서 실행). 0005는 다른 브랜치가 쓰므로 비워 둔다.

-- 조회 인덱스: 완주 공유 링크, 추천 코스, App Store 원거래, IP당 생성 한도, 사용자별·이름별 이벤트
create index if not exists courses_share_id_idx on courses ((data->>'shareId'));
create index if not exists courses_status_shared_idx on courses (status, (data->>'shared'));
create index if not exists users_plus_original_tx_idx on users ((data->>'plusOriginalTxId'));
create index if not exists users_ip_hash_idx on users ((data->>'ipHash'));
create index if not exists events_user_at_idx on events (user_id, at);
create index if not exists events_name_at_idx on events (name, at);

-- Drop 상태 check-and-set: 상태가 from_status 중 하나일 때만 patch를 덮어쓰고 바뀐 data를 돌려준다 (아니면 null).
-- 동시 요청의 중복 생성·Batch 수거 중복을 막는다. patch의 null 값 키는 지운다 (앱에서 undefined로 넘긴 키, 예: batchId 해제)
create or replace function claim_drop(drop_id text, from_status text[], patch jsonb) returns jsonb
language sql as $$
  update drops set data = jsonb_strip_nulls(data || patch)
  where id = drop_id and data->>'status' = any(from_status)
  returning data;
$$;

-- 함수는 서버(service role)만 부른다. 기본으로 public에 주어지는 execute를 거두고 service_role에만 준다
revoke execute on function move_user_data(text, text) from public, anon, authenticated;
revoke execute on function claim_drop(text, text[], jsonb) from public, anon, authenticated;
grant execute on function move_user_data(text, text) to service_role;
grant execute on function claim_drop(text, text[], jsonb) to service_role;

-- 10분마다 Batch 결과 수거 (0003_notify_cron.sql과 같은 형식). CRON_SECRET은 Vault의 'cron_secret'에서 읽는다
select cron.schedule(
  'minicovery-collect',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://minicovery.vercel.app/api/cron/collect',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $$
);
