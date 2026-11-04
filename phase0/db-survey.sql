-- Phase 0 – khảo sát DB iWorkflow (READ-ONLY). Chạy trên bản sao DB prod:
--   psql -X -h <host> -p <port> -U <user> -d <db> -f db-survey.sql > db-survey-result.txt
-- Không xuất giá trị bí mật; mọi truy vấn chỉ đọc.

SET default_transaction_read_only = on;
SET statement_timeout = '120s';
\pset pager off
\pset footer off

\echo '=== 1. Phiên bản & kích thước DB'
SELECT version();
SELECT current_database(), pg_size_pretty(pg_database_size(current_database()));

\echo '=== 2. Bảng lớn nhất (top 60)'
SELECT schemaname, relname, n_live_tup, pg_size_pretty(pg_total_relation_size(relid)) AS size
FROM pg_stat_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 60;

\echo '=== 3. Quy trình đã deploy (key, số version, version mới nhất có bị suspend)'
SELECT key_, max(name_) AS name, count(*) AS versions, max(version_) AS latest_version,
       bool_or(suspension_state_ = 2) AS any_suspended
FROM act_re_procdef GROUP BY key_ ORDER BY key_;

\echo '=== 4. Mức sử dụng 12 tháng gần nhất theo quy trình'
SELECT d.key_, count(*) AS started_12m, count(p.end_time_) AS finished_12m,
       round(avg(EXTRACT(EPOCH FROM (p.end_time_ - p.start_time_)) / 86400)::numeric, 1) AS avg_days
FROM act_hi_procinst p JOIN act_re_procdef d ON d.id_ = p.proc_def_id_
WHERE p.start_time_ >= now() - interval '12 months'
GROUP BY d.key_ ORDER BY started_12m DESC;

\echo '=== 5. Hồ sơ ĐANG CHẠY theo quy trình + tuổi (ngày) – quyết định thời gian drain'
SELECT d.key_, d.version_, count(*) AS running,
       min(p.start_time_)::date AS oldest_start,
       percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM now() - p.start_time_) / 86400) AS median_age_days,
       max(EXTRACT(EPOCH FROM now() - p.start_time_) / 86400)::int AS max_age_days
FROM act_hi_procinst p JOIN act_re_procdef d ON d.id_ = p.proc_def_id_
WHERE p.end_time_ IS NULL
GROUP BY d.key_, d.version_ ORDER BY running DESC;

\echo '=== 5b. Tổng hồ sơ đang chạy theo độ tuổi / version mới nhất'
SELECT count(*) AS running,
  count(*) FILTER (WHERE d.version_ = (SELECT max(version_) FROM act_re_procdef x WHERE x.key_ = d.key_)) AS on_latest_version,
  count(*) FILTER (WHERE p.start_time_ > now() - interval '90 days') AS age_lt_90d,
  count(*) FILTER (WHERE p.start_time_ <= now() - interval '90 days' AND p.start_time_ > now() - interval '365 days') AS age_90_365d,
  count(*) FILTER (WHERE p.start_time_ <= now() - interval '365 days') AS age_gt_1y
FROM act_hi_procinst p JOIN act_re_procdef d ON d.id_ = p.proc_def_id_ WHERE p.end_time_ IS NULL;

\echo '=== 6. Task đang mở theo quy trình/bước'
SELECT d.key_, t.task_def_key_, max(t.name_) AS name, count(*) AS open_tasks,
       count(*) FILTER (WHERE t.assignee_ IS NULL) AS unassigned,
       count(*) FILTER (WHERE t.due_date_ < now()) AS overdue
FROM act_ru_task t JOIN act_re_procdef d ON d.id_ = t.proc_def_id_
GROUP BY d.key_, t.task_def_key_ ORDER BY open_tasks DESC;

\echo '=== 7. Kiểu biến quy trình đang chạy (serializable = cần xử lý riêng)'
SELECT type_, count(*) FROM act_ru_variable GROUP BY type_ ORDER BY 2 DESC;
SELECT substring(encode(b.bytes_, 'escape') from '(com\.eform\.[A-Za-z0-9_.$]+|java\.util\.[A-Za-z]+|org\.[A-Za-z0-9_.]+)') AS java_class, count(*)
FROM act_ru_variable v JOIN act_ge_bytearray b ON b.id_ = v.bytearray_id_
WHERE v.type_ = 'serializable' GROUP BY 1 ORDER BY 2 DESC;
SELECT name_, count(*) FROM act_ru_variable WHERE type_ = 'serializable' GROUP BY name_ ORDER BY 2 DESC LIMIT 30;

\echo '=== 8. Job/timer đang chờ'
SELECT type_, handler_type_, count(*), min(duedate_) AS next_due FROM act_ru_job GROUP BY 1, 2;

\echo '=== 9. Inventory phần tử BPMN (bản mới nhất + bản đang có instance chạy)'
WITH defs AS (
  SELECT d.id_, d.key_, d.version_, d.deployment_id_, d.resource_name_
  FROM act_re_procdef d
  WHERE d.version_ = (SELECT max(version_) FROM act_re_procdef x WHERE x.key_ = d.key_)
     OR d.id_ IN (SELECT DISTINCT proc_def_id_ FROM act_ru_execution)
), bpmn AS (
  SELECT defs.key_, defs.version_, convert_from(b.bytes_, 'UTF8')::xml AS x
  FROM defs JOIN act_ge_bytearray b ON b.deployment_id_ = defs.deployment_id_ AND b.name_ = defs.resource_name_
)
SELECT (xpath('local-name(/*)', n))[1]::text AS el, count(*) AS occurrences, count(DISTINCT key_) AS in_processes
FROM bpmn, LATERAL unnest(xpath('//*[local-name()="process"]//*', x)) AS n
GROUP BY el ORDER BY occurrences DESC;

\echo '=== 9b. multi-instance / callActivity / subprocess theo quy trình (bản mới nhất)'
WITH bpmn AS (
  SELECT d.key_, convert_from(b.bytes_, 'UTF8')::xml AS x
  FROM act_re_procdef d JOIN act_ge_bytearray b ON b.deployment_id_ = d.deployment_id_ AND b.name_ = d.resource_name_
  WHERE d.version_ = (SELECT max(version_) FROM act_re_procdef x WHERE x.key_ = d.key_)
)
SELECT key_,
  cardinality(xpath('//*[local-name()="multiInstanceLoopCharacteristics"]', x)) AS multi_instance,
  array_to_string(xpath('//*[local-name()="callActivity"]/@calledElement', x)::text[], ',') AS called,
  cardinality(xpath('//*[local-name()="subProcess" or local-name()="transaction"]', x)) AS sub_process,
  cardinality(xpath('//*[local-name()="userTask"]', x)) AS user_tasks
FROM bpmn ORDER BY key_;

\echo '=== 10. Service task / listener: class, expression, delegateExpression'
WITH bpmn AS (
  SELECT d.key_, convert_from(b.bytes_, 'UTF8')::xml AS x
  FROM act_re_procdef d JOIN act_ge_bytearray b ON b.deployment_id_ = d.deployment_id_ AND b.name_ = d.resource_name_
  WHERE d.version_ = (SELECT max(version_) FROM act_re_procdef x WHERE x.key_ = d.key_)
)
SELECT v::text AS implementation, count(*) AS occurrences, string_agg(DISTINCT key_, ', ') AS processes
FROM bpmn, LATERAL unnest(xpath(
  '//*[local-name()="serviceTask" or local-name()="taskListener" or local-name()="executionListener" or local-name()="sendTask"]/@*[local-name()="class" or local-name()="expression" or local-name()="delegateExpression" or local-name()="type"]', x)) AS v
GROUP BY 1 ORDER BY 2 DESC;

\echo '=== 11. Script task, timer, điều kiện gateway'
WITH bpmn AS (
  SELECT d.key_, convert_from(b.bytes_, 'UTF8')::xml AS x
  FROM act_re_procdef d JOIN act_ge_bytearray b ON b.deployment_id_ = d.deployment_id_ AND b.name_ = d.resource_name_
  WHERE d.version_ = (SELECT max(version_) FROM act_re_procdef x WHERE x.key_ = d.key_)
)
SELECT 'scriptFormat' AS kind, v::text AS value, count(*) FROM bpmn,
  LATERAL unnest(xpath('//*[local-name()="scriptTask"]/@scriptFormat', x)) v GROUP BY 1, 2
UNION ALL
SELECT 'timer', v::text, count(*) FROM bpmn,
  LATERAL unnest(xpath('//*[local-name()="timeDuration" or local-name()="timeDate" or local-name()="timeCycle"]/text()', x)) v GROUP BY 1, 2
UNION ALL
SELECT 'condition', left(trim(v::text), 120), count(*) FROM bpmn,
  LATERAL unnest(xpath('//*[local-name()="conditionExpression"]/text()', x)) v GROUP BY 1, 2
ORDER BY 1, 3 DESC;

\echo '=== 12. Form key (quy ước MÃ_BIỂU_MẤU#BIẾN_NÚT) ↔ biểu mẫu tồn tại'
WITH bpmn AS (
  SELECT d.key_, convert_from(b.bytes_, 'UTF8')::xml AS x
  FROM act_re_procdef d JOIN act_ge_bytearray b ON b.deployment_id_ = d.deployment_id_ AND b.name_ = d.resource_name_
  WHERE d.version_ = (SELECT max(version_) FROM act_re_procdef x WHERE x.key_ = d.key_)
), fk AS (
  SELECT DISTINCT key_, split_part(v::text, '#', 1) AS form_code, split_part(v::text, '#', 2) AS button_var FROM bpmn,
    LATERAL unnest(xpath('//@*[local-name()="formKey"]', x)) v
)
SELECT fk.key_, fk.form_code, fk.button_var, (bm.id IS NOT NULL) AS bieu_mau_exists
FROM fk LEFT JOIN bieu_mau bm ON upper(bm.ma) = upper(fk.form_code) ORDER BY 1, 2;

\echo '=== 13. Danh mục biểu mẫu & độ phức tạp'
SELECT bm.ma, bm.ten, bm.trang_thai,
       (SELECT count(*) FROM bm_o o WHERE o.bieu_mau_id = bm.id) AS cells,
       (SELECT count(*) FROM bm_o_truong_thong_tin t WHERE t.bieu_mau_id = bm.id) AS fields,
       (SELECT count(*) FROM formula f WHERE f.bieu_mau_id = bm.id) AS formulas
FROM bieu_mau bm ORDER BY fields DESC NULLS LAST;

\echo '=== 14. Người dùng / nhóm / thuộc tính user'
SELECT (SELECT count(*) FROM act_id_user) AS users, (SELECT count(*) FROM act_id_group) AS groups,
       (SELECT count(*) FROM act_id_membership) AS memberships;
SELECT key_, count(*) FROM act_id_info GROUP BY key_ ORDER BY 2 DESC;

\echo '=== 15. Tham số hệ thống (đã che bí mật)'
SELECT ma, CASE WHEN ma ~* '(PASS|SECRET|KEY|TOKEN|ACCOUNT|USER)' THEN '****'
                ELSE left(gia_tri, 120) END AS gia_tri
FROM ht_tham_so ORDER BY ma;

\echo '=== 16. Mức sử dụng các phân hệ phụ (quyết định giữ/bỏ)'
SELECT 'blog_article' AS t, count(*), max(created_date)::text AS last FROM blog_article
UNION ALL SELECT 'chat_message', count(*), max(send_date)::text FROM chat_message
UNION ALL SELECT 'file_management', count(*), max(ngay_tao)::text FROM file_management
UNION ALL SELECT 'signature', count(*), max(ngay_ky)::text FROM signature
UNION ALL SELECT 'bao_cao_thong_ke', count(*), max(ngay_tao)::text FROM bao_cao_thong_ke
UNION ALL SELECT 'emails_schedule', count(*), NULL FROM emails_schedule
UNION ALL SELECT 'email_phe_duyet', count(*), NULL FROM email_phe_duyet
UNION ALL SELECT 'ho_so', count(*), max(ngay_tao)::text FROM ho_so;

\echo '=== 17. Định dạng dữ liệu hồ sơ (XML/JSON) – mẫu cấu trúc, không lấy giá trị'
SELECT count(*) AS total,
       count(*) FILTER (WHERE ho_so_gia_tri IS NOT NULL) AS has_xml,
       count(*) FILTER (WHERE ho_so_json IS NOT NULL) AS has_json,
       pg_size_pretty(sum(octet_length(coalesce(ho_so_gia_tri, '')))::bigint) AS xml_size
FROM ho_so;

\echo '=== 18. Baseline hiệu năng: truy vấn tốn thời gian nhất (cần extension pg_stat_statements)'
SELECT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements') AS has_pss \gset
\if :has_pss
-- PostgreSQL < 13: đổi *_exec_time thành total_time/mean_time/max_time.
SELECT calls, round(total_exec_time::numeric / 1000, 1) AS total_s, round(mean_exec_time::numeric, 1) AS mean_ms,
       round(max_exec_time::numeric, 1) AS max_ms, rows, left(regexp_replace(query, '\s+', ' ', 'g'), 200) AS query
FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 30;
\else
\echo 'pg_stat_statements chưa bật – đề nghị DBA bật trên prod vài ngày trước khi đo baseline.'
\endif
