-- Mục 6.1 – Index nhóm email (ưu tiên P0). Xem database-health-performance-iw_prod.md mục 6.4
-- Chạy: sudo -u postgres psql -d iw_prod -f iw_prod_idx_01_email.sql
-- KHÔNG chạy với psql -1 / --single-transaction: CREATE INDEX CONCURRENTLY không chạy được trong transaction.
-- Script idempotent (IF NOT EXISTS): có thể chạy lại an toàn, trừ khi còn index INVALID (xem iw_prod_idx_00_check.sql).
\pset pager off
\set ON_ERROR_STOP on
\timing on

SET application_name = 'iw_create_index';
SET default_transaction_read_only = off;
SET statement_timeout = 0;
SET lock_timeout = 0;
SET maintenance_work_mem = '256MB';

\echo '== [1/4] emails_schedule_items(emails_schedule_id) – bảng ~760 MB'
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_esi_schedule_id
    ON emails_schedule_items (emails_schedule_id);

\echo '== [2/4] emails_schedule_items – partial: item còn được gửi lại'
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_esi_retry
    ON emails_schedule_items (emails_schedule_id)
    WHERE trang_thai = 0 AND send_number < 4;

\echo '== [3/4] emails_schedule – partial: lịch đang chờ gửi'
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_es_pending
    ON emails_schedule (id) WHERE trang_thai = 0;

\echo '== [4/4] emails_schedule(taskid)'
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_es_taskid
    ON emails_schedule (taskid);

\echo '== ANALYZE'
ANALYZE emails_schedule;
ANALYZE emails_schedule_items;

\echo '== Kết quả'
SELECT c.relname AS index_name, i.indisvalid AS valid, pg_size_pretty(pg_relation_size(c.oid)) AS size
FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
WHERE c.relname IN ('ix_esi_schedule_id', 'ix_esi_retry', 'ix_es_pending', 'ix_es_taskid')
ORDER BY 1;
