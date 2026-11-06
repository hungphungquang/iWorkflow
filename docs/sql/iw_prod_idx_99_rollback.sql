-- Gỡ toàn bộ index đã tạo ở mục 6.1/6.2 (chỉ dùng khi cần rollback, hoặc dọn index INVALID).
-- Chạy: sudo -u postgres psql -d iw_prod -f iw_prod_idx_99_rollback.sql
-- DROP INDEX CONCURRENTLY không khóa đọc/ghi và không chạy được trong transaction.
\pset pager off
\timing on
SET application_name = 'iw_drop_index';
SET default_transaction_read_only = off;
SET statement_timeout = 0;

DROP INDEX CONCURRENTLY IF EXISTS ix_esi_schedule_id;
DROP INDEX CONCURRENTLY IF EXISTS ix_esi_retry;
DROP INDEX CONCURRENTLY IF EXISTS ix_es_pending;
DROP INDEX CONCURRENTLY IF EXISTS ix_es_taskid;

DROP INDEX CONCURRENTLY IF EXISTS ix_procinst_info_proc_key;
DROP INDEX CONCURRENTLY IF EXISTS ix_ho_so_process_instance;
DROP INDEX CONCURRENTLY IF EXISTS ix_taskinst_detail_proinst;
DROP INDEX CONCURRENTLY IF EXISTS ix_taskinst_detail_taskinst;
DROP INDEX CONCURRENTLY IF EXISTS ix_user_action_procinst;
DROP INDEX CONCURRENTLY IF EXISTS ix_notification_user;
DROP INDEX CONCURRENTLY IF EXISTS ix_act_id_info_user_key;
DROP INDEX CONCURRENTLY IF EXISTS ix_act_hi_taskinst_assignee;
DROP INDEX CONCURRENTLY IF EXISTS ix_es_duedate_date;
DROP INDEX CONCURRENTLY IF EXISTS ix_bm_o_tt_bieu_mau;
DROP INDEX CONCURRENTLY IF EXISTS ix_bm_o_tt_bm_o;
DROP INDEX CONCURRENTLY IF EXISTS ix_bm_o_bieu_mau;
DROP INDEX CONCURRENTLY IF EXISTS ix_bm_o_bm_hang;
DROP INDEX CONCURRENTLY IF EXISTS ix_bm_hang_bieu_mau;
