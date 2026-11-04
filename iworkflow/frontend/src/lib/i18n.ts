// Minimal i18n: locale persisted per browser, dictionaries co-located with the screens that use them.
// Phase A translates navigation and dashboards only (decision 05/2026); forms and case data stay Vietnamese.

import type { FourMStepId } from "./fourm";
import type { CaseState, DueStatus } from "./fourm-case";
import { createPersistentStore } from "./store";

export type Locale = "vi" | "en";
export const locales: { id: Locale; label: string; short: string }[] = [
  { id: "vi", label: "Tiếng Việt", short: "VI" },
  { id: "en", label: "English", short: "EN" },
];

const localeStore = createPersistentStore<Locale>("iw.locale", () => "vi");
export const useLocale = localeStore.use;
export const setLocale = (l: Locale) => localeStore.set(l);

export function useMessages<T>(dict: Record<Locale, T>): T {
  return dict[useLocale()];
}

const TZ = "Asia/Ho_Chi_Minh";
export const intlTag = (l: Locale) => (l === "vi" ? "vi-VN" : "en-GB");

export const fmtNum = (n: number, l: Locale, digits = 0) => n.toLocaleString(intlTag(l), { maximumFractionDigits: digits, minimumFractionDigits: 0 });
export const fmtDate = (iso: string, l: Locale) => new Date(iso).toLocaleDateString(intlTag(l), { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric" });
export const fmtDayMonth = (iso: string, l: Locale) => new Date(iso).toLocaleDateString(intlTag(l), { timeZone: TZ, day: "2-digit", month: "2-digit" });
export const fmtDateTime = (iso: string, l: Locale) =>
  new Date(iso).toLocaleString(intlTag(l), { timeZone: TZ, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
export const fmtLongDate = (iso: string, l: Locale) => new Date(iso).toLocaleDateString(intlTag(l), { timeZone: TZ, weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" });

export function fmtHours(h: number, l: Locale) {
  const abs = Math.abs(h);
  if (abs < 24) return l === "vi" ? `${fmtNum(abs, l)} giờ` : `${fmtNum(abs, l)} h`;
  return l === "vi" ? `${fmtNum(abs / 24, l, 1)} ngày` : `${fmtNum(abs / 24, l, 1)} days`;
}

/** Terms shared by navigation, top bar and the four dashboards. */
export const common = {
  vi: {
    nav: {
      groupDash: "Dashboard",
      home: "Trang chủ cá nhân",
      unit: "Đơn vị của tôi",
      company: "Tổng quan công ty",
      track4m: "Theo dõi 4M",
      group4m: "Thay đổi 4M",
      cases4m: "Hồ sơ & việc 4M",
      new4m: "Tạo yêu cầu 4M",
      groupWork: "Công việc chung",
      tasks: "Hộp việc (các quy trình)",
      newCase: "Tạo hồ sơ",
      cases: "Tra cứu hồ sơ",
      search: "Tìm kiếm toàn văn",
      reports: "Báo cáo",
      groupDesign: "Thiết kế",
      processes: "Quy trình",
      forms: "Biểu mẫu",
      groupSystem: "Hệ thống",
      admin: "Quản trị",
      migration: "Chuyển đổi hệ cũ",
      footer: "Wireframe · dữ liệu mẫu",
    },
    top: {
      search: "Tìm trong toàn bộ nội dung hồ sơ…  (Ctrl + K)",
      notifications: "Thông báo",
      markAll: "Đánh dấu đã đọc",
      noNotes: "Không có thông báo",
      actAs: "Đóng vai (demo)",
      clock: "Đồng hồ demo",
      plus1d: "+1 ngày",
      reset: "Khôi phục dữ liệu mẫu",
      language: "Ngôn ngữ",
    },
    state: { running: "Đang xử lý", completed: "Hoàn tất", rejected: "Từ chối", cancelled: "Đã hủy" } as Record<CaseState, string>,
    due: { overdue: "Quá hạn", dueSoon: "Sắp đến hạn", normal: "Trong hạn" } as Record<DueStatus, string>,
    cases: "hồ sơ",
    tasks: "việc",
    viewAll: "Xem tất cả",
    open: "Mở",
  },
  en: {
    nav: {
      groupDash: "Dashboards",
      home: "My home",
      unit: "My unit",
      company: "Company overview",
      track4m: "4M tracking",
      group4m: "4M Change",
      cases4m: "4M cases & tasks",
      new4m: "New 4M request",
      groupWork: "General work",
      tasks: "Inbox (all processes)",
      newCase: "New case",
      cases: "Case lookup",
      search: "Full-text search",
      reports: "Reports",
      groupDesign: "Design",
      processes: "Processes",
      forms: "Forms",
      groupSystem: "System",
      admin: "Administration",
      migration: "Legacy migration",
      footer: "Wireframe · sample data",
    },
    top: {
      search: "Search all case content…  (Ctrl + K)",
      notifications: "Notifications",
      markAll: "Mark all read",
      noNotes: "No notifications",
      actAs: "Act as (demo)",
      clock: "Demo clock",
      plus1d: "+1 day",
      reset: "Reset sample data",
      language: "Language",
    },
    state: { running: "In progress", completed: "Completed", rejected: "Rejected", cancelled: "Cancelled" } as Record<CaseState, string>,
    due: { overdue: "Overdue", dueSoon: "Due soon", normal: "On track" } as Record<DueStatus, string>,
    cases: "cases",
    tasks: "tasks",
    viewAll: "View all",
    open: "Open",
  },
} satisfies Record<Locale, unknown>;

export const stepNames: Record<Locale, Record<FourMStepId, string>> = {
  vi: {
    create: "Tạo yêu cầu",
    mgr: "TP kiểm tra",
    gm: "GM phê duyệt",
    relsec: "Phòng liên quan thẩm định",
    gd: "TGĐ quyết định",
    result: "Nhập kết quả",
    rmgr: "TP kiểm tra KQ",
    rgm: "GM duyệt KQ",
    rrelsec: "Phòng liên quan xác nhận KQ",
    rgd: "TGĐ quyết định (KQ)",
    review: "Xác nhận hoàn thành",
  },
  en: {
    create: "Create request",
    mgr: "Manager check",
    gm: "GM approval",
    relsec: "Related sections review",
    gd: "GD decision",
    result: "Input result",
    rmgr: "Manager check result",
    rgm: "GM approve result",
    rrelsec: "Related sections confirm result",
    rgd: "GD decision (result)",
    review: "Requester confirmation",
  },
};
