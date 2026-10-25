-- 카카오·Google 로그인 계정 찾기 (data->>'kakaoId', data->>'googleSub')
create index if not exists users_kakao_id_idx on users ((data->>'kakaoId'));
create index if not exists users_google_sub_idx on users ((data->>'googleSub'));
