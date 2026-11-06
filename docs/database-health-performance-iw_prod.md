# Báo cáo phân tích hiệu năng & sức khỏe Database server – iWorkflow (`iw_prod`)

| Mục | Giá trị |
|---|---|
| Máy chủ | `10.118.29.21:5432` – PostgreSQL **17.9** (RHEL-family, x86_64) |
| CSDL phân tích | `iw_prod` (28 GB) – cùng instance có `iw_dev` (318 MB) |
| Thời điểm thu thập | 06/11/2026, ~14:20–14:35 giờ VN (giờ làm việc) |
| Phương pháp | Chỉ đọc (`default_transaction_read_only=on`), user `iworkflow` |
| Tài liệu liên quan | [database-structure-iw_prod.md](./database-structure-iw_prod.md) – cấu trúc CSDL |

---

## 0. Tóm tắt điều hành

1. **Server không quá tải, nhưng bị một job "đốt" gần như toàn bộ tài nguyên.** Tải ứng dụng thực tế rất nhẹ: khoảng 3,7 transaction/giây, trung bình 0,26 phiên đang chạy, không lock và không deadlock. Tuy vậy, mỗi giây DB đọc khoảng **38–50 MB** dữ liệu, cache hit chỉ **21–27%**, và đã tạo **559 GB file tạm** kể từ 02/05/2026.
2. **Nguyên nhân chính là job gửi mail `SendMailsSchedule`, chạy 3 phút một lần.**
   - Hai bảng `emails_schedule` và `emails_schedule_items` **không có bất kỳ index hay khóa chính nào**.
   - Câu truy vấn lấy mail chờ gửi dùng `NOT IN (subquery)`. Mỗi lần chạy mất **tới ~100 giây** CPU.
   - Hai bảng này chiếm **98,9% tổng số block đọc** của `iw_prod` kể từ 02/05, và **96% thời gian DB bận** trong 10 phút lấy mẫu.
3. **Có 5.753 lịch mail bị "kẹt" vĩnh viễn ở trạng thái chờ.** Các item của chúng đã gửi lỗi ≥ 4 lần, nên job không bao giờ đóng chúng lại. Vì vậy cứ 3 phút job lại quét lại toàn bộ.
4. **Các truy vấn nghiệp vụ khác thiếu index trên cột tra cứu.** Ví dụ `ho_so.process_instance_id`, `procinst_info.proc_inst_id`, `taskinst_detail.pro_inst_id`, `user_action.procinst_id`, `notification.user_id`, `act_hi_taskinst.assignee_`. Mỗi truy vấn tốn 20–125 ms thay vì < 1 ms, và một số chạy hàng triệu lần.
5. **Cấu hình PostgreSQL gần như mặc định khi cài đặt**: `shared_buffers=128MB`, `work_mem=4MB`, chưa có `pg_stat_statements`, chưa ghi log truy vấn chậm, `ssl=off`, `archive_mode=off`, không có replica, và múi giờ đặt sai (`Etc/GMT+7` = **UTC−7**).
6. Các mảng **lành mạnh**: không có nguy cơ XID wraparound, bloat thấp, checkpoint đều theo lịch, không có index hỏng, không lock chờ.

> **Khắc phục nhanh, hiệu quả nhất, rủi ro thấp:** tạo 3–4 index cho nhóm bảng email (mục 6.1) và đóng 5.753 lịch mail kẹt (mục 5.4). Ước tính lượng đọc của DB giảm **> 90%**.
>
> **Cập nhật 06/11/2026:** đã tạo 18 index (mục 6.5). Lượng block đọc giảm **89%**, cache hit tăng từ 21% lên **98%**, các truy vấn nghiệp vụ còn < 0,2 ms. Truy vấn mail Q1 vẫn mất ~26 s mỗi lần, cần thêm bước ở mục 5.4.

---

## 1. Phạm vi, phương pháp và giới hạn

**Đã thực hiện**
- Snapshot toàn bộ thống kê `pg_catalog`: `pg_stat_database`, `pg_stat_checkpointer`, `pg_stat_bgwriter`, `pg_stat_wal`, `pg_stat_io`, `pg_stat_user_tables/indexes`, `pg_statio_*`, `pg_settings`, `pg_locks`, `pg_stat_activity`, sequences, XID age.
- Lấy mẫu tải trong **10 phút**: chụp `pg_stat_activity` mỗi 2 giây (300 mẫu), và chụp delta các bộ đếm tại thời điểm đầu và cuối.
- Đối chiếu mã nguồn ứng dụng đã decompile (`analysis/src`) để xác định các truy vấn nóng. Sau đó chạy `EXPLAIN` / `EXPLAIN ANALYZE` (read-only) trên 12 truy vấn tiêu biểu.

**Giới hạn**

| Giới hạn | Ảnh hưởng |
|---|---|
| User `iworkflow` không phải superuser và không có `pg_monitor` / `pg_read_all_settings` | Không xem được `data_directory`, `pg_hba`, tablespace |
| Chưa cài `pg_stat_statements` (thiếu gói contrib) | Không có thống kê tổng hợp theo câu SQL. Truy vấn nóng được suy ra từ lấy mẫu, mã nguồn và bộ đếm theo bảng |
| `track_io_timing=off` | Không đo được độ trễ I/O thực tế |
| Không có quyền SSH vào OS (cổng 1511 từ chối, cổng 22 đóng) | Chưa có CPU, RAM, loại đĩa, iostat. Xem [Phụ lục A](#phụ-lục-a--script-kiểm-tra-mức-os-cho-quản-trị-viên) để admin bổ sung |
| Bộ đếm thống kê reset ngày **02/05/2026** (cluster được tạo mới và restore dữ liệu) | Số liệu tích lũy bao trùm ~188 ngày, có lẫn cả quá trình restore ban đầu |

---

## 2. Bảng điểm sức khỏe

| # | Hạng mục | Đánh giá | Ghi chú chính |
|---|---|:-:|---|
| 1 | Tải tổng thể (TPS, phiên active) | 🟢 | 3,7 TPS; trung bình 0,26 phiên active, tối đa 1 |
| 2 | Truy vấn & index | 🟠 | Đã tạo 18 index ngày 06/11 (mục 6.5). Truy vấn mail Q1 vẫn ~26 s do `NOT IN` |
| 3 | Cache hit ratio | 🟢 | Trước: 27% (tích lũy), 21% (lúc lấy mẫu). **Sau khi tạo index: 98,2%** |
| 4 | File tạm (temp) | 🟠 | 90.492 file, 559 GB (~3 GB/ngày), do `work_mem` nhỏ và `NOT IN` |
| 5 | Cấu hình bộ nhớ / planner | 🟠 | Gần như mặc định khi cài đặt |
| 6 | Quan sát / giám sát | 🔴 | Không có `pg_stat_statements`, không log truy vấn chậm, `track_io_timing` off |
| 7 | Vacuum / Analyze | 🟡 | Vài bảng dead tuple > 10%; nhiều bảng nhỏ chưa từng ANALYZE |
| 8 | Bloat | 🟢 | Ước tính < 60 MB mỗi bảng |
| 9 | XID wraparound | 🟢 | Tuổi XID ~351k (ngưỡng 200M) |
| 10 | Lock / deadlock | 🟢 | 0 deadlock, không có lock chờ trong 300 mẫu |
| 11 | Checkpoint / WAL | 🟢 | 53.593 checkpoint theo lịch, chỉ 54 checkpoint bị ép; WAL ~190 MB/ngày |
| 12 | Sao lưu & tính sẵn sàng | 🔴 | `archive_mode=off`, không replica → không có PITR. Cần xác nhận lịch `pg_dump` |
| 13 | Bảo mật | 🟠 | `ssl=off` (45/45 kết nối không mã hóa), `listen_addresses=*`, mọi client dùng chung user `iworkflow` |
| 14 | Múi giờ | 🟡 | `TimeZone=Etc/GMT+7` nghĩa là **UTC−7**, lệch 14 giờ so với giờ VN |
| 15 | Toàn vẹn dữ liệu | 🟡 | `data_checksums=off` |
| 16 | Kết nối | 🟡 | 45/100 kết nối. `iw_dev` dùng chung server production (20 kết nối) |

---

## 3. Thông tin máy chủ và cấu hình

### 3.1 Thông tin chung

| Thông số | Giá trị |
|---|---|
| Phiên bản | PostgreSQL 17.9 (gcc 14.3.1, Red Hat) |
| Khởi động lúc | 02/05/2026 14:27 (−07) – uptime ~187 ngày |
| Vai trò | Primary đơn lẻ (không có standby, không có replication slot) |
| Database | `iw_prod` 28 GB · `iw_dev` 318 MB · `postgres` · `template0/1` |
| Bảng lớn nhất | `act_ge_bytearray` **25 GB** (24 GB là nội dung file trong TOAST, 94k bản ghi) – chiếm ~90% dung lượng CSDL |
| Role superuser | `btmv`, `postgres`. Ứng dụng dùng `iworkflow` (sở hữu 77/79 bảng) |

### 3.2 Rà soát tham số cấu hình

Chưa biết dung lượng RAM và loại đĩa của server. Các giá trị đề xuất bên dưới giả định **RAM 16 GB, SSD**; xem bảng 3.3 cho các cỡ RAM khác.

| Tham số | Hiện tại | Đề xuất | Lý do | Cần restart |
|---|---|---|---|:-:|
| `shared_buffers` | **128 MB** | 4 GB (~25% RAM) | CSDL 28 GB, phần dữ liệu "nóng" ngoài file đính kèm khoảng 2–3 GB | ✔ |
| `effective_cache_size` | 4 GB | 10–12 GB (~70% RAM) | Giúp planner chọn index scan hợp lý | |
| `work_mem` | **4 MB** | 16–32 MB | Giảm file tạm. `NOT IN` hiện không hash được vì thiếu bộ nhớ | |
| `maintenance_work_mem` | 64 MB | 512 MB–1 GB | Tăng tốc VACUUM và CREATE INDEX | |
| `random_page_cost` | 4 | 1.1 (nếu SSD) | Giá trị mặc định 4 là cho HDD, khiến planner ngại dùng index | |
| `effective_io_concurrency` | 1 | 200 (SSD) | Cho phép prefetch khi bitmap heap scan | |
| `max_wal_size` | 1 GB | 4 GB | Dư địa cho các đợt ghi lớn (import, cập nhật hàng loạt) | |
| `checkpoint_completion_target` | 0.9 | giữ nguyên | | |
| `jit` | on | off | OLTP không hưởng lợi từ JIT. Truy vấn có cost lớn (truy vấn mail) còn tốn thêm thời gian biên dịch | |
| `shared_preload_libraries` | (trống) | `pg_stat_statements` | Bắt buộc để giám sát truy vấn | ✔ |
| `track_io_timing` | off | on | Đo độ trễ I/O, chi phí rất thấp | |
| `log_min_duration_statement` | -1 | 1000 (ms) | Ghi log truy vấn chậm | |
| `log_lock_waits` | off | on | | |
| `log_temp_files` | -1 | 10MB | Phát hiện truy vấn tràn ra đĩa | |
| `log_autovacuum_min_duration` | 10min | 1s | Theo dõi autovacuum | |
| `idle_in_transaction_session_timeout` | 0 | 10min | Tránh phiên giữ transaction quá lâu (tổng đã tích lũy 129.628 s idle-in-transaction) | |
| `autovacuum_vacuum_scale_factor` | 0.2 | 0.05 (hoặc đặt riêng cho bảng lớn) | Xem mục 7 | |
| `autovacuum_analyze_scale_factor` | 0.1 | 0.05 | | |
| `TimeZone` / `log_timezone` | `Etc/GMT+7` (UTC−7) | `Asia/Ho_Chi_Minh` | **Phải kiểm tra tác động trước khi đổi** (mục 9.3) | reload |
| `ssl` | off | on | Mã hóa kết nối (mục 9.2) | reload |
| `archive_mode` | off | on, cùng với `archive_command` hoặc pgBackRest/Barman | Có PITR (mục 9.1) | ✔ |

### 3.3 Gợi ý theo dung lượng RAM

| RAM | shared_buffers | effective_cache_size | work_mem | maintenance_work_mem |
|---|---|---|---|---|
| 8 GB | 2 GB | 6 GB | 16 MB | 512 MB |
| 16 GB | 4 GB | 12 GB | 32 MB | 1 GB |
| 32 GB | 8 GB | 24 GB | 32–64 MB | 1–2 GB |

> `work_mem` được cấp cho **mỗi thao tác sort/hash trong mỗi phiên**. Với khoảng 45 kết nối và tải thấp, 32 MB vẫn an toàn.

---

## 4. Phân tích tải (workload)

### 4.1 Bộ đếm tích lũy từ 02/05/2026 (~187 ngày)

| Chỉ số | `iw_prod` | `iw_dev` |
|---|---:|---:|
| Commit | 57,8 triệu (~3,6 TPS) | 10,3 triệu |
| Tỷ lệ rollback | 0,002% | 0,003% |
| Block đọc (đọc từ ngoài shared_buffers) | **102,8 tỷ** (~766 TiB, ~50 MB/s) | 135 triệu |
| Block hit | 38,7 tỷ | 1,64 tỷ |
| **Cache hit ratio** | **27,4%** | 92,4% |
| Số dòng trả về (tup_returned) | 815 tỷ | 13,5 tỷ |
| File tạm | **90.492 file / 559 GB** | 39 / 74 MB |
| Deadlock | 0 | 0 |
| Phiên bị bỏ ngang (abandoned) | 1.982 / 3.445 | 87 / 408 |

**Ý nghĩa:**
- Tải ghi rất nhỏ: chỉ 19,5 triệu insert trong 188 ngày, phần lớn từ đợt restore.
- Tải đọc thì cực lớn: trung bình mỗi transaction quét ~14.000 dòng.
- `pg_stat_io` xác nhận phần lớn lượng đọc là **bulkread**, tức seq scan bảng lớn qua ring buffer. Cụ thể ~45 tỷ block do client backend đọc và ~57 tỷ block do parallel worker đọc.

### 4.2 Lấy mẫu 10 phút (06/11/2026, 14:22–14:32 giờ VN)

| Chỉ số | Giá trị |
|---|---|
| TPS `iw_prod` | 3,7 commit/s |
| Block đọc | **4.831 block/s ≈ 37,7 MB/s** |
| Cache hit | **21,3%** |
| Dòng trả về | 34.224 dòng/s |
| Ghi (insert/update/delete) | 0,08 / 0,06 / 0,01 dòng/s |
| WAL | ~1 KB/s |
| File tạm | 8 file / 36 MB |
| Phiên active | trung bình **0,26**, tối đa **1**; 26% số mẫu có ít nhất 1 phiên active |
| Lock chờ | 0/300 mẫu |
| Wait event (khi active) | **CPU 92%**, `IO:BuffileRead` (đọc file tạm) 4%, `IO:DataFileRead` 1% |

Kết nối trung bình: `iw_prod` có 23,8 phiên idle, `iw_dev` có 20 phiên idle. Gần như không có phiên idle-in-transaction.

**Truy vấn chiếm thời gian active:**

| Số mẫu | Thời gian chạy dài nhất | Truy vấn |
|---:|---:|---|
| **75 / 78** (96%) | **98,6 s** | `select emailsschd0_.* from emails_schedule … not in (select … from emails_schedule_items) …` (job `SendMailsSchedule`) |
| 1 | 0,0 s | lazy-load `emails_schedule_items` theo `emails_schedule_id` |
| 1 | 0,0 s | `select hoso0_.* from ho_so …` |

**Delta theo bảng trong 10 phút (top 10):**

| Bảng | seq_scan | Dòng đọc tuần tự | idx_scan | Block heap đọc | Block heap hit |
|---|---:|---:|---:|---:|---:|
| `emails_schedule_items` | 81 | **12.061.689** | 0 | **2.662.593** | 25.760 |
| `act_id_info` | 704 | 1.553.024 | 0 | 54 | 18.954 |
| `emails_schedule` | 9 | 1.345.469 | 0 | 146.972 | 99 |
| `ho_so` | 73 | 1.250.092 | 5 | 7.734 | 265.999 |
| `user_action` | 5 | 644.920 | 0 | 10.975 | 4.236 |
| `bm_o` | 28 | 558.992 | 53 | 302 | 8.207 |
| `bm_o_truong_thong_tin` | 101 | 470.155 | 25 | 106 | 5.272 |
| `procinst_info` | 22 | 422.224 | 0 | 768 | 4.864 |
| `act_hi_comment` | 13 | 333.762 | 0 | 1.668 | 5.560 |
| `act_hi_taskinst` | 6 | 318.561 | 395 | 17.419 | 23.591 |

**Nhận định:**
- `emails_schedule_items` cùng `emails_schedule` chiếm **97% số block đọc** trong khoảng lấy mẫu, tương đương ~21 GB đọc qua lại một bảng chỉ 766 MB.
- Wait event chủ yếu là CPU chứ không phải `DataFileRead`. Như vậy dữ liệu đang được phục vụ từ **page cache của OS**, đĩa chưa phải điểm nghẽn. Chi phí thực sự là **CPU và băng thông bộ nhớ**: copy và lọc hàng chục triệu dòng mỗi phút.
- Hệ thống hiện "chịu được" vì tải người dùng thấp. Tuy nhiên khi OS cache bị đẩy ra (backup, đọc file đính kèm lớn, tăng người dùng), các seq scan này sẽ chuyển thành I/O đĩa thật, và độ trễ của toàn hệ thống sẽ tăng vọt.

### 4.3 Bảng có I/O lớn nhất (tích lũy)

| Bảng | Block heap đọc | Hit % | Ghi chú |
|---|---:|---:|---|
| `emails_schedule_items` | **92,6 tỷ** | 9,9% | 3,49 triệu seq scan, đã đọc 466 tỷ dòng |
| `emails_schedule` | **9,0 tỷ** | 1,2% | 416 nghìn seq scan, đã đọc 82 tỷ dòng |
| `act_hi_taskinst` | 533 triệu | 27,6% | Thiếu index `assignee_` |
| `act_ge_bytearray` (TOAST) | 513 triệu (~3,9 TiB) | **5,0%** | Đọc nội dung file đính kèm hoặc deploy resource |
| `act_hi_varinst` | 27,6 triệu | 14,8% | |
| `ho_so` | 27,4 triệu | 99,7% | 3,67 triệu seq scan (bảng nhỏ nên nằm trong cache) |
| `taskinst_detail` | 3,5 triệu | 2,5% | Thiếu index `pro_inst_id` |

> Riêng hai bảng `emails_schedule*` chiếm **101,6 / 102,8 tỷ block đọc (98,9%)**. Loại hai bảng này ra thì cache hit ratio của phần còn lại đạt **≈ 96%**, một con số chấp nhận được.

---

## 5. Vấn đề #1 – Job gửi email (`SendMailsSchedule`)

### 5.1 Cơ chế

[TimerStart.java](../analysis/src/com/eform/job/TimerStart.java) khởi tạo 3 `java.util.Timer` với `scheduleAtFixedRate`:

| Job | Chu kỳ | Truy vấn chính |
|---|---|---|
| `SendMailsSchedule` | **180 s** | `getEmailsSchedule(10)` + lazy-load items |
| `TaskDueDateSchedule` | **10 s** | `emails_schedule_duedate` theo ngày |
| `SyncUserGroupAD` | 3600 s | đồng bộ AD |

Truy vấn HQL nằm trong [EmailsScheduleDaoImpl.java](../analysis/src/com/eform/dao/EmailsScheduleDaoImpl.java):

```sql
SELECT o FROM EmailsSchdule o
WHERE ( o.id IN     (SELECT e.emailsSchdule.id FROM EmailsScheduleItems e
                      WHERE e.trangThai = 0 AND e.sendNumber < 4)
     OR o.id NOT IN (SELECT e.emailsSchdule.id FROM EmailsScheduleItems e) )
  AND o.trangThai = 0
-- setMaxResults(10)
```

### 5.2 Kế hoạch thực thi (EXPLAIN)

```
Limit  (cost=101572..58375288 rows=10)
  -> Seq Scan on emails_schedule o  (cost=101572..23915634894 rows=4104)
       Filter: trang_thai = 0 AND (hashed SubPlan 1 OR NOT (SubPlan 2))
       SubPlan 2
         -> Materialize (rows=438690)
              -> Seq Scan on emails_schedule_items
```

- `NOT IN` buộc PostgreSQL tạo **SubPlan không hash**: tập 438k id không vừa `work_mem=4MB`. Vì vậy với **mỗi** dòng `emails_schedule` đang chờ, planner phải dò tuần tự danh sách 438k id đã materialize (và tràn ra file tạm).
- Ước tính cost là **2,4 × 10¹⁰**. Thực tế đo được truy vấn chạy **tới 98,6 s**, trong khi chu kỳ job chỉ 180 s.
- Mỗi email lấy ra được, Hibernate lazy-load items theo `emails_schedule_id`. Thao tác này là parallel seq scan 97k block, **125 ms** mỗi lần (Q2). Đó là lý do có 3,49 triệu seq scan trên `emails_schedule_items`.
- `getEmailsScheduleByTaskID` cũng là seq scan, **114 ms** mỗi lần (Q3).

### 5.3 Dữ liệu "kẹt"

| `emails_schedule.trang_thai` | Số dòng |
|---|---:|
| 0 – chờ gửi | **5.774** |
| 1 – đã gửi | 441.183 |
| 2 – bỏ qua (task không còn active) | 1.599 |

Phân rã 5.774 lịch đang chờ:

| Nhóm | Số lượng | Ý nghĩa |
|---|---:|---|
| Có item còn được thử lại (`trang_thai=0 AND send_number<4`) | **0** | Hiện không còn mail nào cần gửi lại |
| Không có item nào | 21 | Bị chọn lại ở **mọi** lượt chạy. Cần kiểm tra có gửi mail lặp hay không |
| **Kẹt**: mọi item đã gửi xong hoặc đã lỗi ≥ 4 lần | **5.753** | Không bao giờ được chọn, nhưng vẫn phải quét qua `NOT IN` ở mỗi lượt |

Trong bảng items có 5.751 dòng `trang_thai=0, send_number=4`. Đây là các mail đã gửi thất bại 4 lần mà ứng dụng **không chuyển lịch cha sang trạng thái kết thúc**.

### 5.4 Khắc phục (theo thứ tự ưu tiên)

**(a) Tạo index.** Không cần sửa code, làm được ngay. Xem DDL ở [mục 6.1](#61-nhóm-email--ưu-tiên-p0) và hướng dẫn chạy ở [mục 6.4](#64-hướng-dẫn-thực-hiện-trên-server). Index loại bỏ seq scan của Q2/Q3. Q1 (`NOT IN`) cần làm thêm (b) hoặc tăng `work_mem`.

**(b) Đóng các lịch kẹt.** Cần nghiệp vụ xác nhận mã trạng thái (ví dụ dùng `3` = "gửi thất bại", mã mới cần thống nhất với ứng dụng):

```sql
-- Kiểm tra trước
WITH agg AS (
  SELECT emails_schedule_id, bool_or(trang_thai = 0 AND send_number < 4) AS can_retry
  FROM emails_schedule_items GROUP BY emails_schedule_id)
SELECT count(*) FROM emails_schedule o JOIN agg a ON a.emails_schedule_id = o.id
WHERE o.trang_thai = 0 AND NOT a.can_retry;          -- kỳ vọng ~5.753

-- Thực hiện (trong cửa sổ bảo trì, sau khi đã backup)
BEGIN;
WITH agg AS (
  SELECT emails_schedule_id, bool_or(trang_thai = 0 AND send_number < 4) AS can_retry
  FROM emails_schedule_items GROUP BY emails_schedule_id)
UPDATE emails_schedule o SET trang_thai = 3          -- mã trạng thái do nghiệp vụ quyết định
FROM agg a
WHERE a.emails_schedule_id = o.id AND o.trang_thai = 0 AND NOT a.can_retry;
COMMIT;
```

**(c) Sửa code** (đưa vào bản nâng cấp):
- Viết lại truy vấn, bỏ `NOT IN`. Đã đo thử bằng `EXPLAIN ANALYZE`:

  | Phương án | Không có index | Có index (dự kiến) |
  |---|---:|---:|
  | Hiện tại (`IN … OR NOT IN …`) | ~100 s | vẫn chậm (planner không chuyển `NOT IN` thành anti-join) |
  | `EXISTS … OR NOT EXISTS …` | > 120 s (bị timeout) | < 10 ms |
  | Gom nhóm + `LEFT JOIN` (bên dưới) | **1,2 s** | < 1 s |

  ```sql
  -- Phương án khuyến nghị (dùng native query, hoặc EXISTS kèm index)
  SELECT o.* FROM emails_schedule o
  WHERE o.trang_thai = 0
    AND (   EXISTS (SELECT 1 FROM emails_schedule_items e
                    WHERE e.emails_schedule_id = o.id AND e.trang_thai = 0 AND e.send_number < 4)
         OR NOT EXISTS (SELECT 1 FROM emails_schedule_items e
                        WHERE e.emails_schedule_id = o.id))
  ORDER BY o.id
  LIMIT 10;
  ```

- Khi mọi item của một lịch đều đã hết lượt thử (`send_number >= 4`), chuyển lịch sang trạng thái kết thúc.
- Dùng `JOIN FETCH` để nạp items cùng lịch, thay vì lazy-load từng lịch một (N+1).
- Đổi `java.util.Timer` sang `ScheduledExecutorService` hoặc Spring `@Scheduled(fixedDelay=…)`. Như vậy lượt sau chỉ bắt đầu khi lượt trước đã xong.

**(d) Dọn dữ liệu lịch sử.** 441k lịch đã gửi cùng nội dung `html` chiếm khoảng 1,2 GB. Nên archive hoặc xóa bản ghi `trang_thai IN (1,2)` cũ hơn N tháng, sau đó chạy `VACUUM`.

**(e) Thêm khóa chính.** `emails_schedule(id)`, `emails_schedule_items(id)`, `emails_schedule_duedate(id)` hiện không có PK. Việc này cũng cần thiết cho logical replication và cho công cụ migrate.

---

## 6. Vấn đề #2 – Thiếu index trên các cột tra cứu

Kết quả EXPLAIN các truy vấn nóng, lấy từ DAO trong `analysis/src/com/eform/dao`:

| # | Truy vấn (nguồn) | Kế hoạch hiện tại | Thời gian | Tần suất (seq_scan tích lũy) |
|---|---|---|---:|---:|
| Q2 | `emails_schedule_items` theo `emails_schedule_id` | Parallel Seq Scan, 97k block | **125 ms** | 3,49 triệu |
| Q3 | `emails_schedule` theo `taskid` | Seq Scan, 29k block | **114 ms** | 416k |
| Q9 | `taskinst_detail` theo `pro_inst_id` | Seq Scan, 20k block | **103 ms** | 181 |
| Q5 | `ho_so` theo `process_instance_id` | Seq Scan, 3,9k block | 29 ms | 3,67 triệu |
| Q7 | `notification` theo `user_id`, `trang_thai` | Parallel Seq Scan | 23 ms | 129k |
| Q11 | `act_hi_taskinst` theo `assignee_` (hộp thư, lịch sử) | Parallel Seq Scan | 23 ms | 373k |
| Q8 | `user_action` theo `procinst_id` | Seq Scan | 22 ms | 6.514 |
| Q4 | `procinst_info` theo `proc_inst_id`, `info_key` | Seq Scan | 2 ms | **3,04 triệu** |
| Q10 | `bm_o_truong_thong_tin` theo `bieu_mau_id` | Seq Scan | 1 ms | **4,74 triệu** |
| Q6 | `act_id_info` theo `user_id_`, `key_` | Seq Scan | 0,5 ms | **14,9 triệu** |
| Q12 | `emails_schedule_duedate` theo ngày (mỗi 10 s) | Seq Scan | 0,2 ms | 1,6 triệu |

### 6.1 Nhóm email – ưu tiên P0

```sql
-- Chạy bằng user iworkflow (owner). CONCURRENTLY không khóa ghi, nhưng KHÔNG chạy được trong transaction block.
SET maintenance_work_mem = '512MB';
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_esi_schedule_id
    ON emails_schedule_items (emails_schedule_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_esi_retry
    ON emails_schedule_items (emails_schedule_id)
    WHERE trang_thai = 0 AND send_number < 4;
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_es_pending
    ON emails_schedule (id) WHERE trang_thai = 0;
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_es_taskid
    ON emails_schedule (taskid);
ANALYZE emails_schedule; ANALYZE emails_schedule_items;
```

### 6.2 Nhóm nghiệp vụ – ưu tiên P1

```sql
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_procinst_info_proc_key   ON procinst_info (proc_inst_id, info_key);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_ho_so_process_instance   ON ho_so (process_instance_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_taskinst_detail_proinst  ON taskinst_detail (pro_inst_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_taskinst_detail_taskinst ON taskinst_detail (taskinst_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_user_action_procinst     ON user_action (procinst_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_notification_user        ON notification (user_id, trang_thai, notification_time DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_act_id_info_user_key     ON act_id_info (user_id_, key_);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_act_hi_taskinst_assignee ON act_hi_taskinst (assignee_, end_time_ DESC);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_es_duedate_date          ON emails_schedule_duedate (date_query);
-- FK chưa có index trên nhóm biểu mẫu (bảng nhỏ nhưng truy vấn hàng triệu lần)
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_bm_o_tt_bieu_mau ON bm_o_truong_thong_tin (bieu_mau_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_bm_o_tt_bm_o     ON bm_o_truong_thong_tin (bm_o_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_bm_o_bieu_mau    ON bm_o (bieu_mau_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_bm_o_bm_hang     ON bm_o (bm_hang_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS ix_bm_hang_bieu_mau ON bm_hang (bieu_mau_id);
ANALYZE;
```

**Lưu ý khi tạo index:**
- Nếu một lệnh `CONCURRENTLY` bị lỗi giữa chừng, nó sẽ để lại index `INVALID`. Khi đó cần `DROP INDEX CONCURRENTLY` rồi tạo lại. Kiểm tra bằng: `SELECT indexrelid::regclass FROM pg_index WHERE NOT indisvalid;`
- Sau 1–2 tuần, kiểm tra `pg_stat_user_indexes.idx_scan` để xác nhận index được dùng.
- Tổng dung lượng các index mới ước tính < 150 MB.

### 6.3 Vấn đề ở code ứng dụng

| Vị trí | Vấn đề | Đề xuất |
|---|---|---|
| [HoSoDaoImpl.java](../analysis/src/com/eform/dao/HoSoDaoImpl.java) dòng 95 | `query.getResultList() != null ? query.getResultList() : …` làm **truy vấn chạy 2 lần** | Gán kết quả vào biến (`getResultList()` không bao giờ trả về `null`) |
| [UserActionDaoImpl.java](../analysis/src/com/eform/dao/UserActionDaoImpl.java) dòng 91 | Như trên | Như trên |
| [KeyProcessDAOImpl.java](../analysis/src/com/eform/dao/KeyProcessDAOImpl.java) dòng 62 và 83 | Như trên | Như trên |
| [DateTaskDaoImpl.java](../analysis/src/com/eform/dao/DateTaskDaoImpl.java) dòng 39 | Như trên | Như trên |
| Các bảng tham số nhỏ (`bieu_mau` 9,5 triệu seq scan, `ht_tham_so` 8,7 triệu, `act_id_info` 14,9 triệu) | Được đọc lại liên tục cho dữ liệu gần như tĩnh | Cache ở tầng ứng dụng (Spring Cache hoặc Caffeine) |

### 6.4 Hướng dẫn thực hiện trên server

Các script nằm trong [sql/](./sql/):

| File | Nội dung | Ghi dữ liệu? |
|---|---|:-:|
| [iw_prod_idx_00_check.sql](./sql/iw_prod_idx_00_check.sql) | Kiểm tra trước/sau: index `ix_*`, index INVALID, tiến độ, transaction dài, EXPLAIN 9 truy vấn nóng | Không |
| [iw_prod_idx_01_email.sql](./sql/iw_prod_idx_01_email.sql) | Mục 6.1 – 4 index nhóm email cộng ANALYZE | Có (index) |
| [iw_prod_idx_02_business.sql](./sql/iw_prod_idx_02_business.sql) | Mục 6.2 – 14 index nghiệp vụ cộng `ANALYZE` toàn DB | Có (index) |
| [iw_prod_idx_99_rollback.sql](./sql/iw_prod_idx_99_rollback.sql) | Gỡ toàn bộ index trên (`DROP INDEX CONCURRENTLY`) | Có |

**Thông tin cần biết trước khi chạy**
- `CREATE INDEX CONCURRENTLY` **không khóa đọc/ghi**, nên chạy được trong giờ làm việc. Dù vậy, nên chọn lúc ít người dùng (trưa hoặc sau 17:30).
- Lệnh phải chờ mọi transaction đang mở kết thúc, gồm cả truy vấn mail có thể chạy tới ~100 s. Vì vậy một index có thể "đứng" 1–2 phút ở phase `waiting for old snapshots`; đây là hiện tượng bình thường.
- Thời gian ước tính: script 01 khoảng 2–6 phút, script 02 khoảng 1–3 phút. Tổng dung lượng index mới < 150 MB.
- Nếu phiên SSH bị ngắt giữa chừng, index đang tạo sẽ ở trạng thái **INVALID**. Vì vậy phải chạy trong `tmux`/`screen` hoặc `nohup`.
- Kiểm tra trên `iw_dev` trước (cùng server, dữ liệu nhỏ, chạy trong vài giây), sau đó mới chạy trên `iw_prod`.

**Bước 1 – Chép script lên server** (chạy trên máy Windows, trong thư mục dự án; đổi `<user>`):

```powershell
scp -P 1511 -r "docs\sql" <user>@10.118.29.21:/tmp/iw_sql
```

(Hoặc mở file và dán nội dung vào `vi /tmp/iw_sql/<tên file>` trên server.)

**Bước 2 – Trên server: chuẩn bị phiên làm việc**

```bash
ssh -p 1511 <user>@10.118.29.21
tmux new -s idx                       # hoặc: screen -S idx ; nếu mất kết nối: tmux attach -t idx
chmod 755 /tmp/iw_sql && chmod 644 /tmp/iw_sql/*.sql
df -h /var/lib/pgsql                  # cần trống > 1 GB (đường dẫn PGDATA mặc định của PGDG)
which psql || export PATH=/usr/pgsql-17/bin:$PATH
sudo -u postgres psql -d iw_prod -c "select current_user, version();"
```

> Dùng `sudo -u postgres` (xác thực peer, không cần mật khẩu). Index tạo ra tự động thuộc owner của bảng (`iworkflow`). Nếu không có sudo, dùng: `psql -h 127.0.0.1 -U iworkflow -d iw_prod -f …`.

**Phương án khi đăng nhập bằng `root` và không có `tmux`/`screen`** (server không ra được Internet nên không `dnf install` được; các script **không cần Internet**):

```bash
# Không chạy psql trực tiếp bằng root (sẽ lỗi: FATAL: role "root" does not exist)
PSQL=$(command -v psql || echo /usr/pgsql-17/bin/psql); echo $PSQL
chown -R postgres:postgres /tmp/iw_sql
su - postgres -c "$PSQL -X -d iw_prod -c 'select current_user, version()'"

# Chạy nền, không bị ảnh hưởng khi SSH ngắt (setsid + nohup), log ra file
setsid nohup su - postgres -c "cd /tmp/iw_sql && $PSQL -X -d iw_dev -f iw_prod_idx_01_email.sql" > /tmp/iw_sql/dev_01.log 2>&1 < /dev/null &
tail -f /tmp/iw_sql/dev_01.log          # Ctrl-C chỉ thoát tail, không dừng psql
```

Thay `iw_dev` bằng `iw_prod` và thay tên file (`…_02_business.sql`, `…_00_check.sql`) cho các bước tiếp theo. **Chạy tuần tự:** chờ log hiện bảng "Kết quả" rồi mới chạy script kế tiếp.

**Bước 3 – Chạy thử trên `iw_dev`**

```bash
cd /tmp/iw_sql
sudo -u postgres psql -d iw_dev -f iw_prod_idx_01_email.sql
sudo -u postgres psql -d iw_dev -f iw_prod_idx_02_business.sql
sudo -u postgres psql -d iw_dev -f iw_prod_idx_00_check.sql | less    # cột valid = t, EXPLAIN có "Index Scan"
```

**Bước 4 – Chạy trên `iw_prod`** (ghi log ra file)

```bash
cd /tmp/iw_sql
sudo -u postgres psql -d iw_prod -f iw_prod_idx_00_check.sql > check_before.log 2>&1
sudo -u postgres psql -d iw_prod -f iw_prod_idx_01_email.sql 2>&1 | tee idx_01.log
# Kiểm tra: mọi dòng "Kết quả" phải có valid = t, sau đó mới chạy tiếp
sudo -u postgres psql -d iw_prod -f iw_prod_idx_02_business.sql 2>&1 | tee idx_02.log
sudo -u postgres psql -d iw_prod -f iw_prod_idx_00_check.sql > check_after.log 2>&1
grep -E "Index Scan|Bitmap|Seq Scan" check_after.log
```

**Theo dõi tiến độ** (mở thêm một cửa sổ tmux: `Ctrl-b c`):

```bash
sudo -u postgres psql -d iw_prod -c "select pid, relid::regclass, index_relid::regclass, phase, blocks_done, blocks_total from pg_stat_progress_create_index;"
```

**Xử lý sự cố**

| Hiện tượng | Xử lý |
|---|---|
| `ERROR` và script dừng (do `ON_ERROR_STOP`) | Đọc thông báo lỗi. Chạy `iw_prod_idx_00_check.sql` để xem có index INVALID không |
| Có index `valid = f` (INVALID) | `sudo -u postgres psql -d iw_prod -c "DROP INDEX CONCURRENTLY <tên_index>;"` rồi chạy lại script. Script dùng `IF NOT EXISTS`, nên index đã tạo xong sẽ được bỏ qua |
| Đứng lâu ở phase `waiting for old snapshots` / `waiting for writers` | Xem mục 5 của check script: transaction nào đang chạy lâu. Chờ nó kết thúc, **không** kill tiến trình CREATE INDEX |
| Cần hủy giữa chừng | `select pg_cancel_backend(pid) from pg_stat_activity where application_name='iw_create_index';` rồi DROP index INVALID (nếu có) |
| Muốn gỡ toàn bộ | `sudo -u postgres psql -d iw_prod -f iw_prod_idx_99_rollback.sql` |

**Sau khi chạy**
- Không cần restart ứng dụng: planner dùng index mới ngay với các truy vấn kế tiếp.
- Sau 1–2 ngày, kiểm tra cột `idx_scan` (mục 2 của check script) và chụp lại các số liệu ở [mục 10.1](#101-chỉ-số-theo-dõi-sau-khi-khắc-phục).
- Index giải quyết phần lazy-load items, tra cứu theo `taskid` và các truy vấn nghiệp vụ (Q2–Q12). **Riêng truy vấn mail Q1** dùng `NOT IN`, nên không tận dụng được index. Q1 chỉ nhanh lên sau khi:
  - đóng 5.753 lịch kẹt (mục 5.4b), hoặc
  - tăng `work_mem` để `NOT IN` được hash, ví dụ `ALTER DATABASE iw_prod SET work_mem = '64MB';`. Thay đổi này áp dụng cho kết nối mới, nên cần restart ứng dụng hoặc làm mới connection pool.

### 6.5 Kết quả sau khi tạo index (06/11/2026)

18 index `ix_*` đã được tạo trên `iw_dev` và `iw_prod`. Tất cả đều `valid = t` và không có lỗi. Index lớn nhất (`ix_esi_schedule_id`) mất 29,6 giây, các index khác dưới 1 giây. `ANALYZE` toàn DB mất 5,8 giây.

**Thời gian truy vấn (`EXPLAIN ANALYZE`, read-only)**

| Truy vấn | Trước | Sau | Kế hoạch sau |
|---|---:|---:|---|
| Q2 – items theo `emails_schedule_id` | 125 ms | 0,128 ms | Index Scan `ix_esi_schedule_id` |
| Q3 – `emails_schedule` theo `taskid` | 114 ms | 0,108 ms | Index Scan `ix_es_taskid` |
| Q9 – `notification` theo user | 103 ms | 0,031 ms | Index Scan `ix_notification_user` |
| Q5 – `ho_so` theo process instance | 29 ms | 0,058 ms | Index Scan `ix_ho_so_process_instance` |
| Q7 – `taskinst_detail` | 23 ms | 0,067 ms | Index Scan `ix_taskinst_detail_proinst` |
| Q8 – `user_action` | 22 ms | 0,079 ms | Index Scan `ix_user_action_procinst` |
| Q11 – `act_id_info` | 23 ms | 0,049 ms | Index Scan `ix_act_id_info_user_key` |
| Q4 – `procinst_info` | 2,2 ms | 0,083 ms | Index Scan `ix_procinst_info_proc_key` |
| Q6, Q12 | 0,2–0,5 ms | 0,04 ms | Index Scan |

**Lấy mẫu 10 phút, so sánh trước và sau (`iw_prod`, cùng phương pháp như mục 4.2)**

| Chỉ số | Trước (14:22) | Sau (16:03) | Thay đổi |
|---|---:|---:|---|
| Block đọc từ đĩa/OS | 4.831 /s (37,7 MB/s) | 551 /s (4,3 MB/s) | **−89%** |
| Cache hit | 21,3% | **98,2%** | +77 điểm |
| Đọc tuần tự `emails_schedule_items` | 81 seq scan, 12,06 triệu dòng | 0 | Hết seq scan |
| Đọc tuần tự `emails_schedule` | 9 seq scan, 1,35 triệu dòng | 0 | Hết seq scan |
| Seq scan `act_id_info`, `ho_so`, `procinst_info`, `notification`, `bm_o*` | 1,1–1,5 triệu dòng mỗi bảng | Không còn trong top | Đã dùng index |
| Phiên active trung bình | 0,26 | 0,15 | −42% |
| Truy vấn mail Q1: số mẫu active / thời gian lâu nhất | 75 mẫu / 98,6 s | 44 mẫu / **26 s** | Nhanh hơn ~4 lần, nhưng vẫn chậm |
| File tạm | 8 file, 36 MB | 5 file, 34 MB | Gần như không đổi |

Trong 10 phút sau khi tạo, các index đã được ứng dụng sử dụng (`pg_stat_user_indexes.idx_scan`): `ix_esi_schedule_id` 5.534 lần, `ix_bm_hang_bieu_mau` 766, `ix_ho_so_process_instance` 644, `ix_bm_o_tt_bm_o` 443, `ix_procinst_info_proc_key` 321… Chỉ `ix_bm_o_tt_bieu_mau` và `ix_taskinst_detail_taskinst` chưa được dùng. Nên xem lại sau 1–2 tuần trước khi quyết định giữ hay bỏ.

**Việc còn lại: truy vấn mail Q1**
- Q1 vẫn chiếm ~91% thời gian CPU của DB khi có phiên active.
- `ix_esi_schedule_id` đã bị đọc **~1,44 tỷ dòng index**. Nguyên nhân: `NOT IN` không được hash (với `work_mem = 4MB`), nên subquery bị quét lại nhiều lần cho từng lịch đang chờ.
- Muốn xử lý dứt điểm, làm **một trong các cách** ở mục 5.4:
  - đóng 5.753 lịch kẹt (5.4b);
  - `ALTER DATABASE iw_prod SET work_mem = '64MB'` rồi làm mới connection pool;
  - sửa code (5.4c).

---

## 7. Bảo trì: vacuum, analyze, bloat, index

### 7.1 Dead tuple và autovacuum

| Bảng | Dòng sống | Dead | Dead % | Lần autovacuum gần nhất |
|---|---:|---:|---:|---|
| `notification` | 178.021 | 24.953 | 12,3% | 02/05/2026 (chỉ 1 lần) |
| `ho_so` | 17.346 | 2.013 | 10,4% | 12/10/2026 |
| `act_ru_task` | 8.081 | 1.447 | 15,2% | 26/10/2026 |
| `bm_hang` | 5.084 | 790 | 13,4% | 04/10/2026 |
| `act_ru_identitylink` | 32.839 | 4.860 | 12,9% | 24/08/2026 |
| `act_ru_execution` | 11.017 | 1.425 | 11,5% | 26/10/2026 |
| `emails_schedule` | 449.629 | 41.752 | 8,5% | 02/05/2026 (chỉ 1 lần) |
| `act_hi_varinst` | 713.394 | 65.062 | 8,4% | 02/05/2026 (chỉ 1 lần) |

Đề xuất đặt ngưỡng autovacuum riêng cho các bảng hay cập nhật:

```sql
ALTER TABLE notification     SET (autovacuum_vacuum_scale_factor = 0.05, autovacuum_analyze_scale_factor = 0.05);
ALTER TABLE emails_schedule  SET (autovacuum_vacuum_scale_factor = 0.05, autovacuum_analyze_scale_factor = 0.05);
ALTER TABLE emails_schedule_items SET (autovacuum_vacuum_scale_factor = 0.05, autovacuum_analyze_scale_factor = 0.05);
ALTER TABLE act_hi_varinst   SET (autovacuum_vacuum_scale_factor = 0.05);
ALTER TABLE ho_so            SET (autovacuum_vacuum_scale_factor = 0.05);
VACUUM (ANALYZE) notification, ho_so, emails_schedule, emails_schedule_items, act_hi_varinst;
```

Một số bảng **chưa từng được ANALYZE**: `ht_quyen`, `ht_chucvu`, `ht_cau_hinh_quy_trinh`, `ht_cau_hinh_ck_pdf`, `nhom_quy_trinh`, `tham_so_in`, `act_id_user`, `act_id_group`, `act_id_membership`… Chạy `ANALYZE;` một lần cho toàn CSDL.

### 7.2 Bloat

Ước tính bloat thấp (lớn nhất là `emails_schedule_items` ~60 MB, `act_hi_detail` ~50 MB). **Chưa cần** VACUUM FULL hay `pg_repack`.

### 7.3 Index không dùng, trùng, hoặc thiếu

| Loại | Số lượng | Ghi chú |
|---|---:|---|
| Index chưa từng được dùng (`idx_scan=0`) | 58 (~221 MB) | Lớn nhất thuộc `act_hi_detail` (pkey 75 MB, `time` 48 MB, `act_inst` 26 MB, `name` 24 MB, `task_id` 22 MB). Đây là index chuẩn của **Activiti engine**, **không nên xóa** |
| Index trùng | 1 | `act_procdef_info`: `act_uniq_info_procdef` và `act_idx_procdef_info_proc` (16 kB, không đáng kể) |
| FK chưa có index | 37 | Liệt kê trong `health.txt`. Ưu tiên nhóm `bm_*` và `ho_so` (mục 6.2) |
| Index INVALID | 0 | 🟢 |

### 7.4 Checkpoint, WAL, XID

- Checkpoint có 53.593 lần theo lịch và chỉ 54 lần bị ép (phần lớn trong đợt restore). Trung bình mỗi checkpoint ghi rất ít buffer. 🟢
- WAL: 35 GB trong 188 ngày (~190 MB/ngày). Lúc lấy mẫu chỉ ~1 KB/s. 🟢
- Tuổi XID ~351k so với ngưỡng 200 triệu, không có nguy cơ wraparound. Sequence đều là `bigint`. 🟢

---

## 8. Kết nối

| Nguồn | Database | Application | Số kết nối | Trạng thái |
|---|---|---|---:|---|
| 10.118.29.20 (app server) | `iw_prod` | (trống) | 20 | idle, pool đã mở 3 ngày |
| 10.118.29.20 (app server) | `iw_dev` | (trống) | 20 | idle |
| 10.118.22.50 | `iw_prod` | `iworkflow-4m-ui-readonly` | 4–5 | idle hoặc active |

**Nhận xét:**
- 45/100 kết nối là đủ dư địa.
- **Môi trường dev dùng chung server production.** Nếu dev chạy truy vấn nặng, restore, hoặc thử nghiệm, production sẽ bị ảnh hưởng trực tiếp. Nên tách `iw_dev` sang server khác.
- Client `iworkflow-4m-ui-readonly` dùng **cùng user `iworkflow`**, user có toàn quyền ghi. Nên tạo role chỉ đọc riêng (xem mục 9.2).
- 1.982/3.445 phiên bị "abandoned" (client ngắt kết nối mà không gửi lệnh kết thúc), thường do restart ứng dụng hoặc pool bị kill. Nên bật `tcp_keepalives_idle=60` và kiểm tra cấu hình pool (cho phép đóng gọn kết nối, đặt `maxLifetime`).

---

## 9. Sẵn sàng, bảo mật, vận hành

### 9.1 Sao lưu và tính sẵn sàng 🔴

- `archive_mode=off`, không có replica và replication slot, nên **không thể khôi phục về một thời điểm (PITR)** và không có máy dự phòng.
- **Cần xác nhận với quản trị viên:** hiện có `pg_dump` hoặc snapshot VM định kỳ không? Đã từng test restore chưa? Mức mất dữ liệu chấp nhận được (RPO) và thời gian khôi phục (RTO) là bao nhiêu?
- **Đề xuất:**
  - Dùng pgBackRest hoặc Barman: full backup hàng tuần, differential hàng ngày, cộng WAL archiving liên tục.
  - Cân nhắc thêm một streaming replica (hot standby). Replica này cũng có thể phục vụ client read-only `4m-ui`.
- `act_ge_bytearray` chiếm 25 GB (nội dung file). Nên cân nhắc chuyển file ra object storage, để backup và restore nhanh hơn.

### 9.2 Bảo mật 🟠

| Hiện trạng | Đề xuất |
|---|---|
| `ssl=off`, mật khẩu và dữ liệu truyền dạng rõ | Bật `ssl=on` (chứng chỉ nội bộ) và đổi `pg_hba.conf` sang `hostssl … scram-sha-256` |
| `listen_addresses='*'` | Giới hạn bằng `pg_hba.conf` và firewall, chỉ cho phép 10.118.29.20, 10.118.22.50 và máy quản trị |
| Mọi ứng dụng dùng chung `iworkflow` (owner) | Tạo `iw_app` (DML), `iw_readonly` (chỉ `SELECT`), `iw_monitor` (`GRANT pg_monitor`) |
| Không xem được `pg_hba` | Admin rà soát lại, đảm bảo không có `trust` hoặc `md5` |

```sql
-- Chạy bằng superuser
CREATE ROLE iw_readonly LOGIN PASSWORD '***';
GRANT CONNECT ON DATABASE iw_prod TO iw_readonly;
GRANT USAGE ON SCHEMA public TO iw_readonly;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO iw_readonly;
ALTER DEFAULT PRIVILEGES FOR ROLE iworkflow IN SCHEMA public GRANT SELECT ON TABLES TO iw_readonly;

CREATE ROLE iw_monitor LOGIN PASSWORD '***';
GRANT pg_monitor TO iw_monitor;
```

### 9.3 Múi giờ 🟡

- `TimeZone = log_timezone = Etc/GMT+7`. Theo quy ước POSIX, ký hiệu này là **UTC−7**, không phải giờ Việt Nam (UTC+7). Hệ quả:
  - `now()` trong DB và timestamp trong log **lệch 14 giờ**. Ví dụ lúc 14:21 giờ VN, server báo `00:21-07`.
  - Cột `timestamp without time zone` được điền bằng `now()` hoặc `CURRENT_TIMESTAMP` phía DB sẽ bị lưu sai giờ.
- **Trước khi đổi sang `Asia/Ho_Chi_Minh`:**
  - Xác định cột nào được điền từ phía DB (default hoặc trigger) và cột nào từ JVM.
  - Kiểm tra JDBC và Hibernate (`hibernate.jdbc.time_zone`).
  - Đổi trên môi trường test trước. Đổi sai có thể làm lệch dữ liệu thời gian mới so với dữ liệu cũ.

### 9.4 Toàn vẹn dữ liệu 🟡

`data_checksums=off`: lỗi hỏng trang dữ liệu do đĩa sẽ không bị phát hiện. Có thể bật bằng `pg_checksums --enable`, nhưng lệnh này **chạy offline**. Nên làm trong đợt nâng cấp hoặc migrate.

---

## 10. Kế hoạch hành động

| Ưu tiên | Hạng mục | Công sức | Rủi ro | Hiệu quả dự kiến | Mục |
|---|---|---|---|---|---|
| ✅ **P0** | ~~Tạo 4 index nhóm email (`CONCURRENTLY`)~~ – **đã xong 06/11/2026**: block đọc −89%, cache hit 98% | 15 phút | Thấp | Loại bỏ seq scan khi lazy-load items và tra cứu theo `taskid` (phần lớn block đọc) | 6.1, 6.4, 6.5 |
| **P0** | Xử lý truy vấn mail Q1 (vẫn ~26 s mỗi lần): đóng lịch kẹt **hoặc** `ALTER DATABASE iw_prod SET work_mem='64MB'` + làm mới pool | 30 phút | Thấp | Q1 còn vài giây trở xuống | 5.4, 6.5 |
| **P0** | Đóng 5.753 lịch mail kẹt (cần nghiệp vụ xác nhận mã trạng thái) | 30 phút | Thấp | Truy vấn mail còn vài ms | 5.4b |
| **P0** | Xác nhận cơ chế backup hiện tại, test restore | 0,5–1 ngày | — | Giảm rủi ro mất dữ liệu | 9.1 |
| **P0** | Kiểm tra 21 lịch mail không có item (có gửi lặp mỗi 3 phút?) | 1 giờ | — | Tránh spam mail | 5.3 |
| P1 | Cài `postgresql17-contrib`, bật `pg_stat_statements`, log truy vấn chậm, `track_io_timing` (restart) | 1 giờ | Thấp | Có số liệu giám sát | 3.2 |
| P1 | Tinh chỉnh bộ nhớ (`shared_buffers`, `work_mem`, …) theo RAM thực tế (restart) | 1 giờ | Thấp | Cache hit tăng, giảm file tạm | 3.2, 3.3 |
| ✅ P1 | ~~Tạo index nhóm nghiệp vụ, `ANALYZE` toàn DB~~ – **đã xong 06/11/2026**. Còn lại: đặt ngưỡng autovacuum riêng | 1 giờ | Thấp | Truy vấn hồ sơ, hộp thư nhanh hơn 10–100 lần (đo thực tế: 200–3.000 lần) | 6.2, 6.5, 7.1 |
| P1 | Sửa code: truy vấn mail, đóng lịch khi lỗi ≥ 4 lần, `JOIN FETCH`, gọi `getResultList()` 2 lần, cache tham số | 2–4 ngày | Trung bình | Bền vững về lâu dài | 5.4c, 6.3 |
| P2 | Archive dữ liệu `emails_schedule*` cũ, thêm PK | 1 ngày | Thấp | Giảm 1,2 GB | 5.4d, 5.4e |
| P2 | WAL archiving, PITR (pgBackRest), streaming replica | 2–3 ngày | Trung bình | RPO tính bằng phút, có HA | 9.1 |
| P2 | SSL, tách role, siết `pg_hba` | 1 ngày | Trung bình | Bảo mật | 9.2 |
| P2 | Tách `iw_dev` khỏi server production | 0,5 ngày | Thấp | Cô lập môi trường | 8 |
| P3 | Chuẩn hóa múi giờ, bật data checksums (trong đợt nâng cấp) | theo đợt nâng cấp | Trung bình | Đúng giờ, phát hiện hỏng dữ liệu | 9.3, 9.4 |

### 10.1 Chỉ số theo dõi sau khi khắc phục

```sql
-- 1. Cache hit & file tạm (chụp 2 lần cách nhau 10 phút rồi tính delta)
SELECT datname, xact_commit, blks_read, blks_hit, temp_files, temp_bytes
FROM pg_stat_database WHERE datname = 'iw_prod';

-- 2. Bảng còn bị seq scan nhiều
SELECT relname, seq_scan, seq_tup_read, idx_scan,
       seq_tup_read / NULLIF(seq_scan,0) AS avg_rows_per_seq
FROM pg_stat_user_tables ORDER BY seq_tup_read DESC LIMIT 15;

-- 3. Truy vấn đang chạy > 5 giây
SELECT pid, now()-query_start AS age, wait_event_type, wait_event, left(query,120)
FROM pg_stat_activity WHERE state='active' AND now()-query_start > interval '5 s';

-- 4. Index mới đã được dùng chưa
SELECT relname, indexrelname, idx_scan FROM pg_stat_user_indexes
WHERE indexrelname LIKE 'ix\_%' ORDER BY idx_scan;

-- 5. Sau khi có pg_stat_statements: top truy vấn theo tổng thời gian
SELECT calls, round(total_exec_time) AS total_ms, round(mean_exec_time,1) AS mean_ms,
       shared_blks_read, temp_blks_written, left(query,120)
FROM pg_stat_statements ORDER BY total_exec_time DESC LIMIT 20;
```

**Mục tiêu sau P0 và P1:**
- Cache hit `iw_prod` > 95%.
- `blks_read` < 200 block/s.
- `temp_bytes` gần 0.
- Không còn truy vấn nào chạy > 1 s trong `pg_stat_activity`.

---

## Phụ lục A – Script kiểm tra mức OS cho quản trị viên

Chạy trên `10.118.29.21` bằng root hoặc sudo. Gửi lại file kết quả để bổ sung phần CPU, RAM và đĩa vào báo cáo.

```bash
#!/bin/bash
# iw_db_oscheck.sh – thu thập thông tin OS & PostgreSQL (read-only)
OUT=/tmp/iw_db_oscheck_$(date +%Y%m%d_%H%M).txt
{
echo "== OS";            cat /etc/os-release | head -3; uname -r; uptime
echo "== CPU";           nproc; lscpu | egrep 'Model name|Socket|Core|Thread|MHz'
echo "== RAM";           free -m; cat /proc/meminfo | egrep 'HugePages_Total|Hugepagesize|Dirty'
echo "== Disk";          df -hT; lsblk -o NAME,SIZE,ROTA,TYPE,MOUNTPOINT
echo "== IO (5x2s)";     iostat -xm 2 5 2>/dev/null || echo "cài sysstat để có iostat"
echo "== VM (5x2s)";     vmstat 2 5
echo "== Top CPU";       ps -eo pid,user,pcpu,pmem,rss,etime,cmd --sort=-pcpu | head -15
echo "== Kernel";        sysctl vm.swappiness vm.overcommit_memory vm.dirty_ratio vm.dirty_background_ratio
cat /sys/kernel/mm/transparent_hugepage/enabled
echo "== Limits";        ulimit -a
echo "== PG data dir";   sudo -u postgres psql -Atc "show data_directory"
PGDATA=$(sudo -u postgres psql -Atc "show data_directory")
du -sh "$PGDATA" "$PGDATA"/pg_wal "$PGDATA"/log 2>/dev/null
echo "== postgresql.auto.conf"; cat "$PGDATA"/postgresql.auto.conf
echo "== pg_hba (bỏ comment)"; grep -v '^\s*#' "$PGDATA"/pg_hba.conf | grep -v '^\s*$'
echo "== Lỗi trong log 7 ngày gần nhất"
find "$PGDATA"/log -name '*.log' -mtime -7 -exec grep -hE 'ERROR|FATAL|PANIC|could not|out of memory|terminated' {} + | \
  sed -E 's/^[0-9-]+ [0-9:.]+ [^ ]+ \[[0-9]+\] //' | sort | uniq -c | sort -rn | head -40
echo "== Backup jobs";   crontab -l -u postgres 2>/dev/null; ls /etc/cron.d/ 2>/dev/null; systemctl list-timers --all | head -20
echo "== Zabbix agent";  systemctl status zabbix-agent* --no-pager 2>/dev/null | head -5
} > "$OUT" 2>&1
echo "Đã ghi: $OUT"
```

Nếu có **Zabbix** (agent đang mở cổng 10050), xin trích xuất lịch sử 30 ngày gần nhất của: CPU utilization, load average, memory available, disk read/write IOPS & latency, network.

## Phụ lục B – Bật `pg_stat_statements` và log truy vấn chậm

```bash
# 1. Cài gói contrib (RHEL/Rocky/Alma, repo PGDG)
sudo dnf install -y postgresql17-contrib
```

```sql
-- 2. Chạy bằng superuser (postgres/btmv)
ALTER SYSTEM SET shared_preload_libraries = 'pg_stat_statements';
ALTER SYSTEM SET pg_stat_statements.track = 'top';
ALTER SYSTEM SET pg_stat_statements.max = 10000;
ALTER SYSTEM SET track_io_timing = on;
ALTER SYSTEM SET log_min_duration_statement = '1s';
ALTER SYSTEM SET log_lock_waits = on;
ALTER SYSTEM SET log_temp_files = '10MB';
ALTER SYSTEM SET log_autovacuum_min_duration = '1s';
ALTER SYSTEM SET log_line_prefix = '%m [%p] %q%u@%d %a ';
-- (kèm các tham số bộ nhớ ở mục 3.2)
```

```bash
# 3. Restart trong cửa sổ bảo trì (~10-30 s gián đoạn)
sudo systemctl restart postgresql-17
```

```sql
-- 4. Tạo extension trong iw_prod và cấp quyền xem cho tài khoản giám sát
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
GRANT pg_read_all_stats TO iw_monitor;
```

## Phụ lục C – Dữ liệu gốc

Các file thô thu thập được (lưu ngoài repo, có thể cung cấp khi cần):

| File | Nội dung |
|---|---|
| `health.txt` / `health.json` | Snapshot đầy đủ 34 nhóm thống kê |
| `sample.json`, `sample_analysis.txt` | Lấy mẫu 10 phút (300 mẫu `pg_stat_activity` cộng delta bộ đếm) |
| `explain.txt`, `explain_q1_rewrite.txt` | Kế hoạch thực thi Q1–Q12 và các phương án viết lại Q1 |
| `health.py`, `sampler.py`, `analyze_sample.py` | Script thu thập (read-only), có thể chạy lại để so sánh trước và sau khi khắc phục |
