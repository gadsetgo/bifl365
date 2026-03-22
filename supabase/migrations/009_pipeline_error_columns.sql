ALTER TABLE pipeline_runs ADD COLUMN IF NOT EXISTS error_message text;
ALTER TABLE pipeline_runs ADD COLUMN IF NOT EXISTS error_log text;
