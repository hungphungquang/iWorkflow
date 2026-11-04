# So sánh iWorkflow với các nền tảng BPMN và best practice – đề xuất bổ sung core function

> Đầu vào: [iworkflow-project-overview.md](iworkflow-project-overview.md), [rewrite-plan.md](rewrite-plan.md), [process-4m-analysis.md](process-4m-analysis.md), [abandoned-instances-report.md](abandoned-instances-report.md), mã nguồn decompile [analysis/src](../analysis/src), BPMN 4M tại [phase0/bpmn-4m](../phase0/bpmn-4m). Số liệu prod chụp ngày 03/11/2026.
> Đối chiếu với: Camunda 8 (Zeebe, Tasklist, Operate, Optimize, Connectors), Flowable Work/Design (BPMN, CMMN, DMN, Forms), Pega / Appian (case management, SLA), ServiceNow Flow Designer.
>
> **Điều chỉnh ưu tiên (04/11/2026):** chủ dự án xác định frontend (dễ dùng, nhanh, nhiều thống kê) là ưu tiên số 1. Thứ tự thực hiện các mục dưới đây được sắp lại trong [frontend-first-roadmap.md](frontend-first-roadmap.md) §5.

## 1. Kết luận

- **Lõi BPMN của hệ hiện tại đủ dùng.** User task, gateway, multi-instance, call activity, transaction với cancel/error boundary đều đang chạy, và Flowable hỗ trợ đầy đủ.
- **Phần thiếu chủ yếu nằm quanh engine.** Đó là quản trị vòng đời hồ sơ, SLA và escalation, phân công theo vai trò, quản trị phiên bản và xử lý sự cố. Số liệu prod chỉ ra đúng các điểm này:
  - **5.795/8.318 hồ sơ mở (70%) bỏ dở hơn 1 năm**, trong đó 1.128 là bản nháp đã thành process instance;
  - **1.769 hồ sơ chạy trên version cũ** và không có cách chuyển sang version mới;
  - **38–64% lượt xử lý trễ SLA** ở các bước chính của 4M, nhưng không có cơ chế leo thang;
  - 4M: một phòng chọn YCCS (yêu cầu chỉnh sửa) thì mọi phòng phải thẩm định lại, tối đa 98 lượt phòng liên quan cho một hồ sơ.
- Phần lớn các năng lực còn thiếu đã có sẵn trong Flowable (DMN, CMMN, migration, timer, dead-letter job). Việc cần làm chủ yếu là **cấu hình, API và UI**, không phải tự viết engine.

## 2. Bằng chứng hiện trạng

| Chủ đề | Hiện trạng | Nguồn |
|---|---|---|
| SLA | Chỉ có `dueDate` cố định trong BPMN (`P2D`, `P3D`, `P7D`). Việc nhắc hạn do Java Timer `TaskDueDateSchedule` gửi mail. BPMN 4M có 2 boundary event, đều là cancel/error, **không có timer** | [Process4MChange.bpmn20.xml](../phase0/bpmn-4m/Process4MChange.bpmn20.xml), [iworkflow-project-overview.md §5](iworkflow-project-overview.md) |
| Tỷ lệ trễ | TP kiểm tra 38,7%, phòng liên quan 38,7%, cán bộ 43,6%, nhập kết quả **64,3%** (trung vị 33 ngày so với SLA 7 ngày) | [process-4m-analysis.md §5.2](process-4m-analysis.md) |
| Phân công | Username Tổng Giám đốc ghi cứng trong BPMN. Chỉ có **Reassign/Transfer thủ công** (`setAssignee`, `setOwner`); không có ủy quyền theo thời gian, người thay thế hay xử lý khi vắng mặt | [TaskDetailView.java](../analysis/src/com/eform/ui/view/task/TaskDetailView.java) |
| Quy tắc quyết định | Điều kiện gateway so sánh biến nút bấm (`P4M_Button_PDTC`, `Button_4M_TPPC`). Người đề nghị **tự chọn** phòng liên quan | [process-4m-analysis.md §3](process-4m-analysis.md) |
| Vòng đời hồ sơ | 5.795 hồ sơ bỏ dở: nhóm A (nháp) 1.128, nhóm B (chờ xác nhận cuối) 3.874, nhóm C (không còn task) 34, nhóm D (dừng giữa luồng) 512 | [abandoned-instances-report.md](abandoned-instances-report.md) |
| Phiên bản | 1.769 hồ sơ chạy trên version cũ; không có cơ chế chuyển hồ sơ sang version mới | như trên |
| Triển khai quy trình | Modeler deploy thẳng lên prod; `POST /sync` public cho phép deploy BPMN tùy ý | [iworkflow-project-overview.md §8](iworkflow-project-overview.md) |
| Xử lý sự cố | Không có màn hình xem job lỗi hoặc retry. Hồ sơ hỏng (34 hồ sơ 4M không còn task) phải sửa trong DB | [abandoned-instances-report.md §2](abandoned-instances-report.md) |
| Logic theo quy trình | Job riêng cho một quy trình: `UpdateSign4MChange`, `UpdateDataProcessSchedule` (mã phòng ghi cứng) | [iworkflow-project-overview.md §5](iworkflow-project-overview.md) |
| Thông báo | Chỉ có email; `emails_schedule(_items)` khoảng 880k dòng | [rewrite-plan.md §10.2](rewrite-plan.md) |
| Form | Lưới hàng × ô, dữ liệu hồ sơ lưu XML. Quyền theo trường chỉ có ở khối EHS | [process-4m-analysis.md §4](process-4m-analysis.md) |
| Kiểm toán | Không có audit log. Chức năng "xóa toàn bộ dữ liệu" không có xác nhận và không ghi audit | [iworkflow-project-overview.md §8](iworkflow-project-overview.md) |

## 3. Bảng so sánh năng lực

Cột "Kế hoạch" đối chiếu với [rewrite-plan.md](rewrite-plan.md): ✅ đã có, ◐ có một phần, ✗ chưa có.

| Năng lực | Chuẩn ngành | iWorkflow hiện tại | Kế hoạch |
|---|---|---|---|
| **SLA và escalation** | Lịch làm việc, mục tiêu/hạn chót, leo thang tự động (nhắc → báo cấp trên → chuyển người) | `dueDate` cố định và mail nhắc | ◐ chỉ có nhắc hạn |
| **Vòng đời hồ sơ** | Tự hết hạn, đóng hàng loạt có lý do, chính sách lưu giữ | Hồ sơ treo vô thời hạn | ◐ đóng thủ công một lần |
| **Chuyển hồ sơ sang version mới** | Migration API, kiểm tra trước, ánh xạ activity, chạy theo đợt | Không có | ✗ |
| **Phân công** | Vai trò theo sơ đồ tổ chức, ủy quyền khi vắng mặt, người thay thế, kiểm soát hai người (4 mắt), cân bằng tải | Username ghi cứng, chuyển người thủ công | ◐ mới có `roles.user()` cho Tổng Giám đốc |
| **Quy tắc quyết định (DMN)** | Bảng quyết định tách khỏi luồng, có version, sửa được mà không cần sửa BPMN | Biến nút bấm trên gateway | ✗ |
| **Case management (CMMN)** | Hồ sơ dài hạn có mốc, task phát sinh, timeline, liên kết hồ sơ | Luồng cứng cho hồ sơ kéo dài 130–390 ngày | ✗ |
| **Form** | JSON schema, version gắn với version quy trình, quyền theo trường kiểm tra ở server, lưu nháp | Lưới XML | ◐ viết lại cho tương đương hệ cũ |
| **Quản trị triển khai** | Quy trình lưu trong git, bpmnlint, test, chuyển dev → test → prod có duyệt, xem khác biệt, quay lui | Deploy thẳng | ◐ đã có bpmn-js và test |
| **Xử lý sự cố** (kiểu Camunda Operate) | Job lỗi, retry, dead-letter, sửa biến, di chuyển token | Sửa DB tay | ✗ |
| **Phân tích quy trình** (kiểu Camunda Optimize) | Heatmap trên sơ đồ, biến thể luồng, đếm vòng làm lại, kiểm tra tuân thủ | Báo cáo tĩnh | ◐ có schema `reporting` |
| **Thông báo** | Trong ứng dụng, Teams/Slack, email tổng hợp, người dùng tự chọn cách nhận | Email | ◐ có outbox và SSE |
| **Tích hợp** | Connector, REST/webhook, chống xử lý trùng, retry có dead-letter | SOAP/SMB rời rạc | ◐ có outbox |
| **Kiểm toán và tuân thủ** | Audit log không sửa được, xác thực lại khi ký/duyệt, chính sách lưu trữ | Không có | ◐ có `iw2_audit` |
| **Xác thực** | SSO OIDC/SAML, MFA | LDAP bind + Google Sign-In | ◐ LDAP + Google OIDC |

## 4. Đề xuất core function theo mức ưu tiên

### P0 – Phase 1, không đổi BPMN (vẫn giữ mục tiêu G3)

| # | Chức năng | Nội dung | Giải quyết |
|---|---|---|---|
| 1 | **Bộ máy SLA và escalation đặt ngoài BPMN** | Lịch làm việc (ngày lễ VN, ca làm). Bảng chính sách SLA theo `processKey + activityId`, ghi đè `dueDate` trong BPMN. SLA có thể tính theo biến nghiệp vụ, ví dụ "Nhập kết quả" theo `P4MForm_ExpectedDate`. Chuỗi leo thang: nhắc trước hạn → quá hạn báo TP đơn vị → quá N ngày đề xuất chuyển người | 38–64% trễ SLA, chưa có leo thang |
| 2 | **Dịch vụ xác định người xử lý** | Ánh xạ vai trò → người (`GENERAL_DIRECTOR`, đại diện đơn vị, lãnh đạo đơn vị). **Ủy quyền theo khoảng thời gian**, người thay thế khi vắng mặt. Mọi task đều được phân công qua dịch vụ này, nên không cần sửa BPMN | Username ghi cứng, task bị treo khi người xử lý nghỉ hoặc nghỉ việc |
| 3 | **Bảng điều khiển vận hành** | Danh sách job lỗi/dead-letter kèm retry; hủy/tạm dừng/tiếp tục hồ sơ có lý do; sửa biến có audit; di chuyển token (Flowable change-activity-state); xem sơ đồ đánh dấu vị trí hiện tại | Hồ sơ hỏng phải sửa DB tay |
| 4 | **Thao tác hàng loạt trên hồ sơ** | Lọc theo quy trình, bước, tuổi, nhóm A/B/C/D; hủy hoặc đóng hành chính kèm lý do, sinh biên bản, gửi thông báo cho người liên quan | 5.795 hồ sơ bỏ dở |
| 5 | **Tách bản nháp khỏi process instance** | Bản nháp lưu riêng, có thời hạn và tự xóa sau N ngày; chỉ gọi `startProcess` khi người dùng gửi | Nhóm A: 1.128 nháp đang bị tính là hồ sơ mở |

### P1 – Ngay sau cutover (bắt đầu đổi luồng, cần nghiệp vụ duyệt)

| # | Chức năng | Nội dung | Giải quyết |
|---|---|---|---|
| 6 | **Chuyển hồ sơ sang version mới** | Dùng Flowable `ProcessInstanceMigrationService`: kiểm tra trước, ánh xạ activity giữa hai version, chạy theo đợt, ghi audit | 1.769 hồ sơ kẹt ở version cũ; điều kiện để sửa BPMN mà không để lại hồ sơ kẹt |
| 7 | **Quy trình deploy có kiểm soát** | BPMN/DMN/form lưu trong git; CI chạy bpmnlint, chặn script task/expression nguy hiểm, test bao phủ mọi nhánh gateway; chuyển dev → test → prod qua bước duyệt; xem khác biệt giữa hai version; quay lui | Deploy thẳng, `/sync` public |
| 8 | **Form có version** | Form gắn với version quy trình; quyền theo trường cho từng bước, kiểm tra ở server; dữ liệu hồ sơ lưu có cấu trúc (`jsonb`) để tìm kiếm và báo cáo | Form XML, quyền chỉ kiểm tra ở UI |
| 9 | **DMN cho quy tắc nghiệp vụ** | Ví dụ 4M: loại thay đổi C/D/E/Q/S quyết định phòng **bắt buộc** thẩm định (EHS, QA…); người đề nghị chỉ thêm phòng ngoài danh sách bắt buộc | Thiếu phòng thẩm định, phụ thuộc người đề nghị |
| 10 | **Làm lại một phần và tự bỏ qua bước** | Khi một phòng YCCS, chỉ hỏi lại phòng đó và các phòng chịu ảnh hưởng của phần sửa, giữ kết quả của các phòng còn lại. Tự bỏ qua bước GM khi TP và GM là cùng người (đơn vị 8311) | Tối đa 98 lượt phòng liên quan cho một hồ sơ; duyệt 2 lần |
| 11 | **Timer BPMN cho các bước chờ** | Timer không ngắt luồng để nhắc; timer ngắt luồng để đóng tự động các bước "chờ xác nhận" quá hạn, có thông báo trước | Nhóm B: 3.874 hồ sơ chờ xác nhận cuối |

### P2 – Nâng cao

| # | Chức năng | Nội dung |
|---|---|---|
| 12 | **Phân tích quy trình (process mining)** | Heatmap thời gian và tần suất đặt lên sơ đồ bpmn-js, các biến thể luồng, số vòng làm lại, tỷ lệ tuân thủ SLA theo phòng/người; đọc từ schema `reporting` |
| 13 | **Case management (CMMN) cho 4M** | Mốc "Trước thay đổi" / "Sau thay đổi", task phát sinh (ví dụ yêu cầu bổ sung đánh giá rủi ro), liên kết hồ sơ, timeline. 4M là quy trình kiểm soát thay đổi bắt buộc theo IATF 16949 §8.5.6, nên truy vết và kiểm toán là yêu cầu thật |
| 14 | **Hộp công việc và thông báo hiện đại** | Duyệt hàng loạt, view lưu sẵn, độ ưu tiên, @mention trong bình luận, thông báo trong ứng dụng/Teams, email tổng hợp hằng ngày thay cho mail lẻ, người dùng tự chọn cách nhận |
| 15 | **Xác thực** | SSO OIDC (Entra ID/ADFS) thay cho LDAP bind + Google; MFA; xác thực lại khi phê duyệt hoặc ký |
| 16 | *(Tùy chọn)* **AI hỗ trợ** | Tóm tắt hồ sơ cho người duyệt, gợi ý phòng liên quan; Camunda và Pega đang đưa tính năng này vào sản phẩm |

## 5. Những gì nên thay đổi, không chỉ bổ sung

| Hiện tại | Nên đổi thành |
|---|---|
| Username, SLA, danh sách mã phòng ghi cứng trong BPMN và job | Cấu hình, vai trò và DMN tách khỏi luồng |
| Mã riêng cho từng quy trình chạy bằng job (`UpdateSign4MChange`, `UpdateDataProcessSchedule`) | Delegate hoặc listener trong chính luồng, có test |
| Email gửi trực tiếp trong listener | Sự kiện → outbox → kênh thông báo |
| Quyết định bằng nút ghi biến lên gateway | Giữ cho tương thích, nhưng chuẩn hóa thành `decision` + `comment`, bắt buộc có comment khi YCCS/TC (từ chối) |
| Hồ sơ XML lưu trong `HO_SO` | Dữ liệu hồ sơ có cấu trúc và có version |
| Bản nháp là process instance | Bản nháp lưu riêng, chỉ start khi gửi |
| Modeler deploy thẳng lên prod | Quy trình lưu trong git, có CI và bước duyệt |

## 6. Xếp vào lộ trình

| Thời điểm | Hạng mục | Lý do |
|---|---|---|
| Phase 1d (workflow & task) | #1, #2, #3, #5 | Đều nằm ngoài BPMN, không vi phạm G3 |
| Phase 1e (drain & cutover) | #4 | Cần trước khi tắt hệ cũ để xử lý hồ sơ bỏ dở |
| Ngay sau cutover | #6, #7 trước; sau đó #8–#11 | Mọi thay đổi luồng về sau đều cần migration và quy trình deploy có kiểm soát |
| Phase 2 | #12–#16 | Làm cùng đợt thiết kế lại DB (`jsonb`, schema `reporting`) |

Phạm vi Phase 1 vẫn là tương đương chức năng hệ cũ cộng bảo mật ([rewrite-plan.md §12](rewrite-plan.md)). Các mục P0 được đưa vào vì chúng không đổi luồng nghiệp vụ và trực tiếp giải quyết hồ sơ tồn đọng và trễ SLA.

## 7. Câu hỏi cần nghiệp vụ chốt

1. Lịch làm việc dùng cho SLA: ngày lễ, ca làm, có tính thứ Bảy không?
2. Chuỗi leo thang: quá hạn bao lâu thì báo cấp trên, và ai được chuyển người xử lý?
3. Chính sách ủy quyền: ai được ủy quyền, phạm vi theo quy trình hay toàn bộ, có cần duyệt không?
4. 4M: ma trận loại thay đổi → phòng bắt buộc thẩm định (đầu vào cho DMN #9).
5. Có đồng ý chỉ hỏi lại phòng đã YCCS (#10) và tự bỏ qua bước khi trùng người không?
6. Thời hạn tự đóng các bước "chờ xác nhận" (#11) và thời gian lưu bản nháp (#5).
