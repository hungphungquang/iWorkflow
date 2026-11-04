-- Phân tích họ quy trình 4M Change trên iWorkflow – READ-ONLY.
-- Chạy: psql -X -w -h 10.118.29.21 -U iworkflow -d iw_prod -f analysis-4m.sql -o 4m/analysis-4m.txt
SET default_transaction_read_only = on;
SET statement_timeout = '300s';
\pset footer off

\set fam '(''Process4MChange'',''Process4MChangeResult'',''RelSecProc_2510'',''RelSecProcResult'',''AntoanProc_2510'')'
\set forms '(''P4MForm_Request_BTMV'',''P4MForm_BTMV_RV'',''P4MForm_Results_BTMV'',''P4MF_Results_BTMV_RV'',''P4M_PBXL'',''P4M_CBXL'',''P4M_PBXL_RS'',''P4M_CBXL_RS'',''P4M_ATXL'',''P4M_PBXL_BMC'',''P4M_CBXL_BMC'',''P4M_PBXL_BMC_RS'',''P4M_CBXL_BMC_RS'',''P4M_CBATXL_BMC'',''P4M_RiskAssessment'',''RiskAm_BMC_View'',''P4MF_PBXL_BMC_view'',''P4M_PBXL_BMC_RS_View'',''P4MF_PBXL_BMC_RS_V'',''P4MForm_PBXL_BMC_RS'')'

\echo '=== 1. Biểu mẫu 4M: cấu trúc'
SELECT bm.ma, bm.ten, bm.loai_bieu_mau AS loai, bm.trang_thai AS tt, bm.so_hang, bm.so_cot, bm.buttons,
       (SELECT count(*) FROM bm_o_truong_thong_tin x WHERE x.bieu_mau_id = bm.id) AS fields,
       (SELECT string_agg(DISTINCT c.ma, ', ') FROM bm_o o JOIN bieu_mau c ON c.id = o.bieu_mau_con_id WHERE o.bieu_mau_id = bm.id) AS sub_forms
FROM bieu_mau bm WHERE bm.ma IN :forms ORDER BY bm.ma;

\echo '=== 2. Trường thông tin theo biểu mẫu (thứ tự hàng/ô)'
SELECT bm.ma AS form, h.thu_tu AS row, o.thu_tu AS cell, t.ma AS field, t.ten AS label,
       t.kieu_du_lieu AS dtype, t.loai_hien_thi AS display, t.required AS req, x.readonly AS ro,
       ldm.ma AS picklist, t.maxlength AS maxlen, nullif(t.default_value, '') AS def, nullif(t.change_item, '') AS change_item
FROM bm_o_truong_thong_tin x
JOIN bieu_mau bm ON bm.id = x.bieu_mau_id
JOIN truong_thong_tin t ON t.id = x.truong_thong_tin_id
LEFT JOIN bm_hang h ON h.id = x.bm_hang_id
LEFT JOIN bm_o o ON o.id = x.bm_o_id
LEFT JOIN loai_danh_muc ldm ON ldm.id = t.loai_danh_muc_id
WHERE bm.ma IN :forms
ORDER BY bm.ma, h.thu_tu, o.thu_tu, x.thu_tu;

\echo '=== 3. Danh mục (picklist) dùng trong biểu mẫu 4M'
SELECT ldm.ma AS picklist, ldm.ten AS picklist_name, dm.ma AS code, dm.ten AS label, dm.thu_tu, dm.trang_thai AS tt
FROM loai_danh_muc ldm JOIN danh_muc dm ON dm.loai_danh_muc_id = ldm.id
WHERE ldm.id IN (SELECT t.loai_danh_muc_id FROM bm_o_truong_thong_tin x JOIN bieu_mau bm ON bm.id = x.bieu_mau_id
                 JOIN truong_thong_tin t ON t.id = x.truong_thong_tin_id WHERE bm.ma IN :forms)
ORDER BY ldm.ma, dm.thu_tu, dm.ma;

\echo '=== 4. Khối lượng theo năm (hồ sơ gốc)'
SELECT d.key_, extract(year FROM p.start_time_)::int AS year, count(*) AS started,
       count(p.end_time_) AS ended, count(*) FILTER (WHERE p.end_time_ IS NULL) AS open,
       round(avg(EXTRACT(EPOCH FROM (p.end_time_ - p.start_time_)) / 86400)::numeric, 1) AS avg_days_ended
FROM act_hi_procinst p JOIN act_re_procdef d ON d.id_ = p.proc_def_id_
WHERE d.key_ IN :fam AND p.super_process_instance_id_ IS NULL
GROUP BY 1, 2 ORDER BY 1, 2;

\echo '=== 5. Thời gian xử lý theo bước (task đã hoàn thành, 3 năm gần nhất)'
SELECT d.key_, t.task_def_key_, max(t.name_) AS step, count(*) AS done,
       round(percentile_cont(0.5) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM t.end_time_ - t.start_time_) / 3600)::numeric, 1) AS median_h,
       round(percentile_cont(0.9) WITHIN GROUP (ORDER BY EXTRACT(EPOCH FROM t.end_time_ - t.start_time_) / 3600)::numeric, 1) AS p90_h,
       round(100.0 * count(*) FILTER (WHERE t.due_date_ IS NOT NULL AND t.end_time_ > t.due_date_) / nullif(count(*) FILTER (WHERE t.due_date_ IS NOT NULL), 0), 1) AS late_pct
FROM act_hi_taskinst t JOIN act_re_procdef d ON d.id_ = t.proc_def_id_
WHERE d.key_ IN :fam AND t.end_time_ IS NOT NULL AND t.start_time_ > now() - interval '3 years'
GROUP BY 1, 2 ORDER BY 1, done DESC;

\echo '=== 6. Phân bố quyết định (giá trị biến nút bấm, 3 năm gần nhất)'
SELECT d.key_, v.name_ AS button_var, v.text_ AS value, count(*) AS times
FROM act_hi_detail v
JOIN act_hi_procinst p ON p.id_ = v.proc_inst_id_
JOIN act_re_procdef d ON d.id_ = p.proc_def_id_
WHERE d.key_ IN :fam AND v.name_ IN ('P4M_Button_PDTC', 'Button_4M_TPPC', 'Button_4M_XL', 'Button_4M_ATPC')
  AND v.time_ > now() - interval '3 years'
GROUP BY 1, 2, 3 ORDER BY 1, 2, times DESC;

\echo '=== 7. Số phòng ban liên quan mỗi yêu cầu 4M (sub-process RelSecProc_2510 / RelSecProcResult)'
SELECT pd.key_ AS parent, cd.key_ AS child, count(*) AS parents,
       round(avg(n)::numeric, 1) AS avg_sections, max(n) AS max_sections
FROM (SELECT p.id_, p.proc_def_id_, c.proc_def_id_ AS child_def, count(*) AS n
      FROM act_hi_procinst p JOIN act_hi_procinst c ON c.super_process_instance_id_ = p.id_
      WHERE p.start_time_ > now() - interval '3 years' GROUP BY 1, 2, 3) s
JOIN act_re_procdef pd ON pd.id_ = s.proc_def_id_ JOIN act_re_procdef cd ON cd.id_ = s.child_def
WHERE pd.key_ IN :fam GROUP BY 1, 2;

\echo '=== 8. Người/đầu mối phòng ban liên quan nhận nhiều nhất (init của RelSec, 3 năm)'
SELECT d.key_, v.text_ AS section_manager, count(*) AS requests
FROM act_hi_varinst v JOIN act_hi_procinst p ON p.id_ = v.proc_inst_id_ JOIN act_re_procdef d ON d.id_ = p.proc_def_id_
WHERE d.key_ IN ('RelSecProc_2510', 'RelSecProcResult') AND v.name_ = 'init' AND p.start_time_ > now() - interval '3 years'
GROUP BY 1, 2 ORDER BY 1, 3 DESC LIMIT 40;

\echo '=== 9. Đơn vị đề xuất (P4MForm_DonVi) và phân loại 4M (P4M_class), 3 năm'
SELECT v.name_, v.text_ AS value, count(DISTINCT v.proc_inst_id_) AS cases
FROM act_hi_varinst v JOIN act_hi_procinst p ON p.id_ = v.proc_inst_id_ JOIN act_re_procdef d ON d.id_ = p.proc_def_id_
WHERE d.key_ = 'Process4MChange' AND v.name_ IN ('P4MForm_DonVi', 'P4M_class') AND p.start_time_ > now() - interval '3 years'
GROUP BY 1, 2 ORDER BY 1, 3 DESC;

\echo '=== 10. Đơn vị: người đại diện / lãnh đạo (dùng cho _DAI_DIEN, _LANH_DAO)'
SELECT ma, ten, nguoi_dai_dien, lanh_dao_dai_dien, trang_thai FROM ht_donvi ORDER BY ma;

\echo '=== 11. Mã hồ sơ 4M (procinst_info) – mẫu'
SELECT process_name, code_first, count(*) AS n, max(code_last) AS max_seq
FROM procinst_info WHERE process_name IN ('Process4MChange', 'Process4MChangeResult')
GROUP BY 1, 2 ORDER BY 1, 2 DESC LIMIT 20;
