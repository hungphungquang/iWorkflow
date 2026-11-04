import Link from "next/link";
import { PageHeader, WireNote } from "@/components/ui";
import { FourMSimulator } from "./simulator";

export default function FourMSimulatePage() {
  return (
    <>
      <Link href="/processes/4m" className="mb-3 inline-flex text-xs text-slate-500 hover:text-slate-800">
        ‹ Thay đổi 4M
      </Link>
      <PageHeader
        title="Mô phỏng luồng 4M"
        description="Đóng vai từng người xử lý để đi qua mọi nhánh: phê duyệt, yêu cầu chỉnh sửa, từ chối, phân công cán bộ, Tổng Giám đốc tiếp tục / hủy."
      />
      <FourMSimulator />
      <div className="mt-4">
        <WireNote>
          Engine mô phỏng trong trình duyệt chạy đúng các gateway của 5 BPMN đang dùng (giữ nguyên biến P4M_Button_PDTC, Button_4M_TPPC, Button_4M_XL). Trên hệ thật, Flowable thực thi chính các file BPMN đã chuyển đổi; màn hình này dùng để nghiệp vụ duyệt luồng và làm kịch bản kiểm thử.
        </WireNote>
      </div>
    </>
  );
}
