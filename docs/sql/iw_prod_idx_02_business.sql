-- Mục 6.2 – Index nhóm nghiệp vụ (ưu tiên P1). Xem database-health-performance-iw_prod.md mục 6.4
-- Chạy: sudo -u postgres psql -d iw_prod -f iw_prod_idx_02_business.sql
-- KHÔNG chạy với psql -1 / --single-transaction: CREATE INDEX CONCURRENTLY không chạy được trong transaction.
\pset pager off
\set ON_ERROR_STOP on
\timing on

SET application_name = 'iw_create_index';
SET default_transaction_read_only = off;
SET statement_timeout = 0;
SET lock_timeout = 0;
SET maintenance_work_mem = '256MB';

\echo '== [1/14] procinst_info(proc_inst_id, info_key)'
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_procinst_info_proc_key   ON procinst_info (proc_inst_id, info_key);
\echo '== [2/14] ho_so(process_instance_id)'
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_ho_so_process_instance   ON ho_so (process_instance_id);
\echo '== [3/14] taskinst_detail(pro_inst_id) – bảng ~160 MB'
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_taskinst_detail_proinst  ON taskinst_detail (pro_inst_id);
\echo '== [4/14] taskinst_detail(taskinst_id)'
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_taskinst_detail_taskinst ON taskinst_detail (taskinst_id);
\echo '== [5/14] user_action(procinst_id)'
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_user_action_procinst     ON user_action (procinst_id);
\echo '== [6/14] notification(user_id, trang_thai, notification_time DESC)'
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_notification_user        ON notification (user_id, trang_thai, notification_time DESC);
\echo '== [7/14] act_id_info(user_id_, key_)'
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_act_id_info_user_key     ON act_id_info (user_id_, key_);
\echo '== [8/14] act_hi_taskinst(assignee_, end_time_ DESC)'
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_act_hi_taskinst_assignee ON act_hi_taskinst (assignee_, end_time_ DESC);
\echo '== [9/14] emails_schedule_duedate(date_query)'
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_es_duedate_date          ON emails_schedule_duedate (date_query);
\echo '== [10/14] bm_o_truong_thong_tin(bieu_mau_id)'
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_bm_o_tt_bieu_mau         ON bm_o_truong_thong_tin (bieu_mau_id);
\echo '== [11/14] bm_o_truong_thong_tin(bm_o_id)'
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_bm_o_tt_bm_o             ON bm_o_truong_thong_tin (bm_o_id);
\echo '== [12/14] bm_o(bieu_mau_id)'
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_bm_o_bieu_mau            ON bm_o (bieu_mau_id);
\echo '== [13/14] bm_o(bm_hang_id)'
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_bm_o_bm_hang             ON bm_o (bm_hang_id);
\echo '== [14/14] bm_hang(bieu_mau_id)'
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_bm_hang_bieu_mau         ON bm_hang (bieu_mau_id);

\echo '== ANALYZE toàn database (cập nhật thống kê cho planner, gồm cả các bảng chưa từng ANALYZE)'
ANALYZE;

\echo '== Kết quả'
SELECT c.relname AS index_name, t.relname AS table_name, i.indisvalid AS valid,
       pg_size_pretty(pg_relation_size(c.oid)) AS size
FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid JOIN pg_class t ON t.oid = i.indrelid
WHERE c.relname LIKE 'ix\_%'
ORDER BY t.relname, c.relname;
