CREATE TABLE vehicle_brands (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  brand_key VARCHAR(120) NOT NULL UNIQUE,
  display_name VARCHAR(120) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE vehicle_models (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  brand_id BIGINT NOT NULL REFERENCES vehicle_brands(id),
  model_key VARCHAR(160) NOT NULL,
  display_name VARCHAR(160) NOT NULL,
  model_year INTEGER,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (brand_id, model_key, model_year)
);

CREATE TABLE vehicle_trims (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  model_id BIGINT NOT NULL REFERENCES vehicle_models(id),
  trim_key VARCHAR(240) NOT NULL,
  display_name VARCHAR(240) NOT NULL,
  fuel_type VARCHAR(120),
  source_name VARCHAR(160) NOT NULL,
  source_vehicle_id VARCHAR(160),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (source_name, source_vehicle_id, trim_key)
);

CREATE TABLE vehicle_specs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trim_id BIGINT NOT NULL REFERENCES vehicle_trims(id),
  spec_group VARCHAR(120) NOT NULL,
  spec_name VARCHAR(160) NOT NULL,
  spec_value VARCHAR(240),
  source_checked_at DATE NOT NULL,
  UNIQUE (trim_id, spec_group, spec_name, source_checked_at)
);

CREATE TABLE fuel_economy_records (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trim_id BIGINT NOT NULL REFERENCES vehicle_trims(id),
  combined_value NUMERIC(8, 2),
  unit VARCHAR(40) NOT NULL,
  basis_label VARCHAR(120),
  source_name VARCHAR(160) NOT NULL,
  source_checked_at DATE NOT NULL,
  UNIQUE (trim_id, source_name, source_checked_at)
);

CREATE TABLE price_snapshots (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  trim_id BIGINT NOT NULL REFERENCES vehicle_trims(id),
  min_price_krw BIGINT,
  max_price_krw BIGINT,
  source_name VARCHAR(160) NOT NULL,
  source_checked_at DATE NOT NULL,
  UNIQUE (trim_id, source_name, source_checked_at)
);

CREATE TABLE source_raw_payloads (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_name VARCHAR(160) NOT NULL,
  source_request_key VARCHAR(240) NOT NULL,
  payload_json TEXT NOT NULL,
  captured_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (source_name, source_request_key)
);

CREATE TABLE source_runs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  source_name VARCHAR(160) NOT NULL,
  started_at TIMESTAMP NOT NULL,
  finished_at TIMESTAMP,
  status VARCHAR(40) NOT NULL,
  saved_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  error_summary TEXT
);
