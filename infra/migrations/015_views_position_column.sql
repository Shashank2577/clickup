-- Add position column to views table (required by views-service repository)
ALTER TABLE views ADD COLUMN IF NOT EXISTS position integer NOT NULL DEFAULT 0;
