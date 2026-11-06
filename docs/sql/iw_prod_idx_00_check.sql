-- Kiểm tra trước/sau khi tạo index (chỉ đọc). Xem mục 6.4 của database-health-performance-iw_prod.md
-- Chạy: sudo -u postgres psql -d iw_prod -f iw_prod_idx_00_check.sql
\pset pager off
\timing on

\echo '== 1. Phiên bản, quyền, dung lượng'
SELECT version(), current_user, current_database(),
       pg_size_pretty(pg_database_size(current_database())) AS db_size;

\echo '== 2. Index ix_* đã có (trước khi chạy: kỳ vọng 0 dòng)'
SELECT c.relname AS index_name, t.relname AS table_name, i.indisvalid AS valid,
       pg_size_pretty(pg_relation_size(c.oid)) AS size, s.idx_scan
FROM pg_index i
JOIN pg_class c ON c.oid = i.indexrelid
JOIN pg_class t ON t.oid = i.indrelid
LEFT JOIN pg_stat_user_indexes s ON s.indexrelid = i.indexrelid
WHERE c.relname LIKE 'ix\_%'
ORDER BY t.relname, c.relname;

\echo '== 3. Index INVALID (kỳ vọng 0 dòng; nếu có -> DROP INDEX CONCURRENTLY rồi chạy lại)'
SELECT indexrelid::regclass AS invalid_index, indrelid::regclass AS table_name
FROM pg_index WHERE NOT indisvalid;

\echo '== 4. Tiến trình CREATE INDEX đang chạy (nếu có)'
SELECT p.pid, p.relid::regclass AS table_name, p.index_relid::regclass AS index_name, p.phase,
       p.blocks_done, p.blocks_total, p.tuples_done, p.tuples_total,
       now() - a.query_start AS running_for
FROM pg_stat_progress_create_index p JOIN pg_stat_activity a USING (pid);

\echo '== 5. Truy vấn đang chạy > 5 s (CREATE INDEX CONCURRENTLY phải chờ các transaction này kết thúc)'
SELECT pid, datname, application_name, client_addr, now() - xact_start AS xact_age,
       wait_event_type, wait_event, left(query, 100) AS query
FROM pg_stat_activity
WHERE state <> 'idle' AND pid <> pg_backend_pid() AND now() - xact_start > interval '5 s'
ORDER BY xact_start;

\echo '== 6. Kế hoạch thực thi các truy vấn nóng (EXPLAIN, không chạy thật) - sau khi tạo index phải thấy "Index Scan"'
EXPLAIN SELECT * FROM emails_schedule_items WHERE emails_schedule_id = 508658;
EXPLAIN SELECT * FROM emails_schedule WHERE taskid = '6114708' LIMIT 1;
EXPLAIN SELECT * FROM procinst_info WHERE proc_inst_id = '6114576' AND info_key = 'DESC';
EXPLAIN SELECT * FROM ho_so WHERE process_instance_id = '6114576';
EXPLAIN SELECT * FROM taskinst_detail WHERE pro_inst_id = '6114576';
EXPLAIN SELECT * FROM user_action WHERE procinst_id = '6114576' ORDER BY id DESC;
EXPLAIN SELECT * FROM notification WHERE user_id = 'x' AND trang_thai = 0 ORDER BY notification_time DESC LIMIT 1;
EXPLAIN SELECT * FROM act_hi_taskinst WHERE assignee_ = 'x' AND end_time_ IS NOT NULL ORDER BY end_time_ DESC LIMIT 20;
EXPLAIN SELECT * FROM act_id_info WHERE user_id_ = 'x' AND key_ = 'HT_DON_VI' AND parent_id_ IS NULL;
