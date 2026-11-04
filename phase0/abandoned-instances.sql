-- Hồ sơ (process instance) bỏ dở > 1 năm trên iWorkflow – READ-ONLY (không tạo bảng tạm).
-- Định nghĩa: end_time_ IS NULL và lần thao tác gần nhất (bắt đầu/kết thúc task, hoặc ngày tạo nếu chưa có task) <= now() - 365 ngày.
-- Chạy: psql -X -w -h 10.118.29.21 -U iworkflow -d iw_prod -f abandoned-instances.sql -o abandoned-summary.txt

SET default_transaction_read_only = on;
SET statement_timeout = '300s';
\pset footer off

\set ab 'WITH last_act AS (SELECT p.id_, p.proc_def_id_, p.start_time_, p.start_user_id_, p.super_process_instance_id_, coalesce(greatest(max(t.start_time_), max(t.end_time_)), p.start_time_) AS last_touch FROM act_hi_procinst p LEFT JOIN act_hi_taskinst t ON t.proc_inst_id_ = p.id_ WHERE p.end_time_ IS NULL GROUP BY p.id_), ab AS (SELECT l.id_ AS proc_inst_id, d.key_ AS process_key, d.name_ AS process_name, d.version_, (d.version_ = (SELECT max(version_) FROM act_re_procdef x WHERE x.key_ = d.key_)) AS on_latest_version, nullif(concat_ws(''-'', nullif(pi.code_first, ''''), nullif(pi.code_last, '''')), '''') AS case_code, l.start_time_::date AS started, l.start_user_id_ AS started_by, l.last_touch::date AS last_activity, (current_date - l.last_touch::date) AS idle_days, l.super_process_instance_id_ AS parent_inst_id FROM last_act l JOIN act_re_procdef d ON d.id_ = l.proc_def_id_ LEFT JOIN LATERAL (SELECT code_first, code_last FROM procinst_info i WHERE i.proc_inst_id = l.id_ ORDER BY i.id DESC LIMIT 1) pi ON true WHERE l.last_touch <= now() - interval ''365 days''), ab_task AS (SELECT ab.proc_inst_id, string_agg(DISTINCT t.name_, '' | '') AS current_steps, string_agg(DISTINCT t.assignee_, '', '') FILTER (WHERE t.assignee_ IS NOT NULL) AS assignees, string_agg(DISTINCT il.group_id_, '', '') FILTER (WHERE il.group_id_ IS NOT NULL) AS candidate_groups FROM ab JOIN act_ru_execution e ON e.proc_inst_id_ = ab.proc_inst_id OR e.super_exec_ IN (SELECT id_ FROM act_ru_execution WHERE proc_inst_id_ = ab.proc_inst_id) JOIN act_ru_task t ON t.proc_inst_id_ = e.proc_inst_id_ LEFT JOIN act_ru_identitylink il ON il.task_id_ = t.id_ AND il.type_ = ''candidate'' GROUP BY ab.proc_inst_id) '

\echo '=== A. Tổng quan'
:ab SELECT (SELECT count(*) FROM act_hi_procinst WHERE end_time_ IS NULL) AS open_total,
       count(*) AS abandoned_gt_1y,
       count(*) FILTER (WHERE parent_inst_id IS NULL) AS top_level,
       count(*) FILTER (WHERE parent_inst_id IS NOT NULL) AS sub_process,
       min(started) AS oldest_started, max(last_activity) AS newest_last_activity
FROM ab;

\echo '=== B. Theo quy trình (hồ sơ gốc, không tính sub-process)'
:ab SELECT process_key, max(process_name) AS process_name, count(*) AS abandoned,
       count(*) FILTER (WHERE NOT on_latest_version) AS on_old_version,
       min(started) AS oldest_started, max(last_activity) AS newest_last_activity,
       round(avg(idle_days)) AS avg_idle_days
FROM ab WHERE parent_inst_id IS NULL
GROUP BY process_key ORDER BY abandoned DESC;

\echo '=== C. Theo năm tạo hồ sơ (hồ sơ gốc)'
:ab SELECT extract(year FROM started)::int AS year_started, count(*) AS abandoned
FROM ab WHERE parent_inst_id IS NULL GROUP BY 1 ORDER BY 1;

\echo '=== D. Bước đang dừng (top 30, hồ sơ gốc)'
:ab SELECT ab.process_key, coalesce(t.current_steps, '(không có task mở)') AS current_step, count(*) AS abandoned
FROM ab LEFT JOIN ab_task t USING (proc_inst_id)
WHERE ab.parent_inst_id IS NULL
GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 30;

\echo '=== E. Người đang giữ task bỏ dở (top 30, hồ sơ gốc)'
:ab SELECT coalesce(a, '(chưa giao – chỉ có nhóm/không có task)') AS assignee, count(*) AS abandoned_cases
FROM ab LEFT JOIN ab_task t USING (proc_inst_id)
LEFT JOIN LATERAL unnest(string_to_array(t.assignees, ', ')) a ON true
WHERE ab.parent_inst_id IS NULL
GROUP BY 1 ORDER BY 2 DESC LIMIT 30;

\echo '=== F. Xuất danh sách chi tiết -> abandoned-instances.csv'
\set export :ab 'SELECT ab.proc_inst_id, ab.case_code, ab.process_key, ab.process_name, ab.version_, ab.on_latest_version, ab.started, ab.started_by, ab.last_activity, ab.idle_days, t.current_steps, t.assignees, t.candidate_groups, ab.parent_inst_id, p.case_code AS parent_case_code FROM ab LEFT JOIN ab_task t USING (proc_inst_id) LEFT JOIN ab p ON p.proc_inst_id = ab.parent_inst_id ORDER BY ab.process_key, ab.started'
\o abandoned-instances.csv
\pset format csv
:export;
\o
