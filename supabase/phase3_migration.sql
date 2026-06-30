-- Phase 3 Migration: Terms & Conditions column on invoices and quotations
-- Run in Supabase SQL Editor: https://supabase.com/dashboard/project/avodyziayfkvmuyoyuqs/sql

ALTER TABLE invoices    ADD COLUMN IF NOT EXISTS terms text;
ALTER TABLE quotations  ADD COLUMN IF NOT EXISTS terms text;

SELECT 'Phase 3 migration complete' as status;
