-- clicks
CREATE TABLE IF NOT EXISTS clicks (
  id bigserial primary key,
  token text unique not null,
  campaign text,
  ip text,
  ua_http text,
  ua_js text,
  language text,
  timezone text,
  inner_w int, inner_h int,
  screen_w int, screen_h int,
  dpr real,
  fp_id text,
  ts_click timestamptz,
  created_at timestamptz default now()
);

CREATE INDEX idx_clicks_ip ON clicks(ip);
CREATE INDEX idx_clicks_ts ON clicks(ts_click);

-- opens
CREATE TABLE IF NOT EXISTS opens (
  id bigserial primary key,
  token text,
  ip text,
  model text,
  os text,
  locale text,
  timezone text,
  screen_w int, screen_h int, dpr real,
  ts_open timestamptz,
  matched_click_id bigint references clicks(id),
  match_score int,
  created_at timestamptz default now()
);

CREATE INDEX idx_opens_ip ON opens(ip);
CREATE INDEX idx_opens_ts ON opens(ts_open);