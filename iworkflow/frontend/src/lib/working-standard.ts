export type ReviewStage = "manager" | "staff" | "recheck" | "completed" | "cancelled" | "unknown";

export type ReviewTaskStatus = "completed" | "pending" | "stopped";
export type ReviewEvent = { at: string; actor: string; action: string; comment: string; status?: ReviewTaskStatus };

export function reviewTaskStatus(ended: boolean, reason: string | null): ReviewTaskStatus {
  if (!ended) return "pending";
  const normalized = reason?.trim().toLowerCase();
  return normalized && normalized !== "completed" ? "stopped" : "completed";
}
export type StandardReview = {
  id: string;
  parentId: string;
  code: string;
  title: string;
  standardNo: string;
  revision: string;
  requester: string;
  department: string;
  manager: string;
  staff: string;
  stage: ReviewStage;
  startedAt: string;
  dueAt: string;
  endedAt: string;
  managerComment: string;
  staffComment: string;
  summary: string;
  history: ReviewEvent[];
  attachments: { id: string; name: string; url?: string }[];
};

export type ReviewPerson = { id: string; name: string };
export type ReviewParent = {
  id: string;
  state: "running" | "completed" | "cancelled" | "unknown";
  endedAt: string;
  startedAt?: string;
  reviewsCompletedAt?: string;
  totalReviews: number;
  completedReviews: number;
  pendingReviews: number;
  cancelledReviews: number;
};
export type ReviewSnapshot = {
  source: "demo" | "iw_prod";
  loadedAt: string;
  reviews: StandardReview[];
  people: ReviewPerson[];
  parents?: ReviewParent[];
};

export function getReviewParent(snapshot: ReviewSnapshot, parentId: string): ReviewParent | null {
  const parent = snapshot.parents?.find((item) => item.id === parentId);
  if (snapshot.source === "iw_prod") return parent ?? null;
  const reviews = snapshot.reviews.filter((review) => review.parentId === parentId);
  if (!reviews.length) return null;
  return {
    id: parentId, state: parent?.state ?? "running", endedAt: parent?.endedAt ?? "",
    startedAt: parent?.startedAt || reviews.reduce((earliest, review) => review.startedAt < earliest ? review.startedAt : earliest, reviews[0].startedAt),
    reviewsCompletedAt: reviews.reduce((latest, review) => review.endedAt > latest ? review.endedAt : latest, ""),
    totalReviews: reviews.length,
    completedReviews: reviews.filter((review) => review.stage === "completed").length,
    pendingReviews: reviews.filter((review) => !review.endedAt).length,
    cancelledReviews: reviews.filter((review) => review.stage === "cancelled").length,
  };
}

export function parentApprovalState(parent: ReviewParent | null): "running" | "completed" {
  return parent && parent.totalReviews > 0 && parent.completedReviews === parent.totalReviews ? "completed" : "running";
}

export type WorkingStandardCase = {
  id: string;
  code: string;
  title: string;
  standardNo: string;
  startedAt: string;
  completedAt: string;
  reviews: StandardReview[];
  parent: ReviewParent | null;
  approvalState: "running" | "completed";
};

export function groupReviewCases(snapshot: ReviewSnapshot): WorkingStandardCase[] {
  const grouped = new Map<string, StandardReview[]>();
  for (const review of snapshot.reviews) {
    const siblings = grouped.get(review.parentId);
    if (siblings) siblings.push(review);
    else grouped.set(review.parentId, [review]);
  }
  return [...grouped].map(([id, reviews]) => {
    const first = reviews[0];
    const parent = getReviewParent(snapshot, id);
    const approvalState = parentApprovalState(parent);
    const startedAt = parent?.startedAt || reviews.reduce((earliest, review) => review.startedAt < earliest ? review.startedAt : earliest, first.startedAt);
    const completedAt = approvalState === "completed" ? parent?.reviewsCompletedAt || reviews.reduce((latest, review) => review.endedAt > latest ? review.endedAt : latest, "") : "";
    return { id, code: first.code, title: first.title, standardNo: first.standardNo, startedAt, completedAt, reviews, parent, approvalState };
  });
}

export function isCaseOverdue(item: WorkingStandardCase, now: string, department = "") {
  return item.reviews.some((review) => (!department || review.department === department) && !review.endedAt && !!review.dueAt && Date.parse(review.dueAt) < Date.parse(now));
}

export function summarizeReviewCases(snapshot: ReviewSnapshot, months: 3 | 6 | 12 = 12, department = "") {
  const since = reviewPeriodStart(snapshot.loadedAt, months);
  const now = Date.parse(snapshot.loadedAt);
  const cases = groupReviewCases(snapshot).filter((item) => Date.parse(item.startedAt) >= Date.parse(since) && Date.parse(item.startedAt) <= now && (!department || item.reviews.some((review) => review.department === department)));
  const completed = cases.filter((item) => item.approvalState === "completed");
  const pending = cases.filter((item) => item.approvalState === "running");
  const overdue = (item: WorkingStandardCase, unit = department) => isCaseOverdue(item, snapshot.loadedAt, unit);
  const durations = completed.map((item) => (Date.parse(item.completedAt) - Date.parse(item.startedAt)) / 86400000).filter((days) => Number.isFinite(days) && days >= 0);
  const start = new Date(since);
  const monthly = Array.from({ length: months + 1 }, (_, index) => {
    const month = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1));
    const key = month.toISOString().slice(0, 7);
    return { key, label: `${month.getUTCMonth() + 1}/${String(month.getUTCFullYear()).slice(-2)}`, value: cases.filter((item) => item.startedAt.slice(0, 7) === key).length, secondary: completed.filter((item) => item.completedAt.slice(0, 7) === key).length };
  });
  const departments = [...new Set(cases.flatMap((item) => item.reviews.map((review) => review.department)))].filter((unit) => !department || unit === department).map((name) => {
    const related = cases.filter((item) => item.reviews.some((review) => review.department === name));
    return { name, started: related.length, parents: related.length, completed: related.filter((item) => item.approvalState === "completed").length, pending: related.filter((item) => item.approvalState === "running").length, overdue: related.filter((item) => overdue(item, name)).length };
  }).sort((left, right) => right.overdue - left.overdue || right.pending - left.pending || right.started - left.started || left.name.localeCompare(right.name));
  const ageDays = (item: WorkingStandardCase) => Math.max(0, (now - Date.parse(item.startedAt)) / 86400000);
  const aging = [
    { label: "0–2 ngày", value: pending.filter((item) => ageDays(item) <= 2).length },
    { label: "Trên 2–7 ngày", value: pending.filter((item) => ageDays(item) > 2 && ageDays(item) <= 7).length },
    { label: "Trên 7–14 ngày", value: pending.filter((item) => ageDays(item) > 7 && ageDays(item) <= 14).length },
    { label: "Trên 14 ngày", value: pending.filter((item) => ageDays(item) > 14).length },
  ];
  const attention = [...pending].sort((left, right) => Number(overdue(right)) - Number(overdue(left)) || ageDays(right) - ageDays(left));
  const reviewCount = cases.reduce((total, item) => total + (item.parent?.totalReviews ?? item.reviews.length), 0);
  return {
    since, cases, parentCount: cases.length, started: cases.length, completed: completed.length, pending: pending.length, overdue: pending.filter((item) => overdue(item)).length,
    completionRate: cases.length ? completed.length / cases.length * 100 : null,
    averageDays: durations.length ? durations.reduce((total, days) => total + days, 0) / durations.length : null,
    reviewCount, reviewsPerParent: cases.length ? reviewCount / cases.length : null,
    monthly, departments, aging, attention,
    statuses: [{ state: "running" as const, value: pending.length }, { state: "completed" as const, value: completed.length }],
  };
}

export const reviewStageLabel: Record<ReviewStage, string> = {
  manager: "Chờ phòng ban thẩm định", staff: "Chờ nhân viên xác nhận", recheck: "Chờ trưởng phòng duyệt lại",
  completed: "Đã hoàn tất", cancelled: "Đã dừng / hủy", unknown: "Cần kiểm tra trạng thái",
};
export const reviewStageTone = { manager: "blue", staff: "amber", recheck: "violet", completed: "green", cancelled: "gray", unknown: "red" } as const;

export function reviewPeriodStart(now: string, months: number) {
  const date = new Date(now);
  const target = new Date(date);
  target.setUTCDate(1);
  target.setUTCMonth(target.getUTCMonth() - months);
  const lastDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(date.getUTCDate(), lastDay));
  return target.toISOString();
}

export function summarizeReviews(snapshot: ReviewSnapshot, months: 3 | 6 | 12 = 12, department = "") {
  const now = Date.parse(snapshot.loadedAt);
  const since = reviewPeriodStart(snapshot.loadedAt, months);
  const selected = snapshot.reviews.filter((review) => !department || review.department === department);
  const cohort = selected.filter((review) => Date.parse(review.startedAt) >= Date.parse(since) && Date.parse(review.startedAt) <= now);
  const pending = selected.filter((review) => !review.endedAt && Date.parse(review.startedAt) <= now);
  const isOverdue = (review: StandardReview) => !!review.dueAt && Date.parse(review.dueAt) < now;
  const completed = cohort.filter((review) => review.stage === "completed" && !!review.endedAt && Date.parse(review.endedAt) <= now);
  const durations = completed.map((review) => (Date.parse(review.endedAt) - Date.parse(review.startedAt)) / 86400000).filter((days) => Number.isFinite(days) && days >= 0);
  const start = new Date(since);
  const monthly = Array.from({ length: months + 1 }, (_, index) => {
    const month = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1));
    const key = month.toISOString().slice(0, 7);
    return {
      key, label: `${month.getUTCMonth() + 1}/${String(month.getUTCFullYear()).slice(-2)}`,
      value: cohort.filter((review) => review.startedAt.slice(0, 7) === key).length,
      secondary: completed.filter((review) => review.endedAt.slice(0, 7) === key).length,
    };
  });
  const stages = (["manager", "staff", "recheck", "unknown"] as ReviewStage[]).map((stage) => ({ stage, value: pending.filter((review) => review.stage === stage).length }));
  const statuses = (["manager", "staff", "recheck", "completed", "cancelled", "unknown"] as ReviewStage[]).map((stage) => ({ stage, value: cohort.filter((review) => review.stage === stage).length }));
  const cohortPending = cohort.filter((review) => !review.endedAt);
  const departments = [...new Set(selected.map((review) => review.department))].map((name) => {
    const opened = pending.filter((review) => review.department === name);
    return {
      name, started: cohort.filter((review) => review.department === name).length,
      parents: new Set(cohort.filter((review) => review.department === name).map((review) => review.parentId)).size,
      completed: completed.filter((review) => review.department === name).length,
      pending: opened.length, overdue: opened.filter(isOverdue).length,
    };
  }).sort((left, right) => right.overdue - left.overdue || right.pending - left.pending || right.started - left.started || left.name.localeCompare(right.name));
  const ageDays = (review: StandardReview) => Math.max(0, (now - Date.parse(review.startedAt)) / 86400000);
  const aging = [
    { label: "0–2 ngày", value: pending.filter((review) => ageDays(review) <= 2).length },
    { label: "Trên 2–7 ngày", value: pending.filter((review) => ageDays(review) > 2 && ageDays(review) <= 7).length },
    { label: "Trên 7–14 ngày", value: pending.filter((review) => ageDays(review) > 7 && ageDays(review) <= 14).length },
    { label: "Trên 14 ngày", value: pending.filter((review) => ageDays(review) > 14).length },
  ];
  const attention = [...pending].sort((left, right) => Number(isOverdue(right)) - Number(isOverdue(left)) || ageDays(right) - ageDays(left));
  const parentCount = new Set(cohort.map((review) => review.parentId)).size;
  return {
    since, parentCount, started: cohort.length, completed: completed.length,
    cancelled: cohort.filter((review) => review.stage === "cancelled").length,
    completionRate: cohort.length ? completed.length / cohort.length * 100 : null,
    averageDays: durations.length ? durations.reduce((sum, days) => sum + days, 0) / durations.length : null,
    reviewsPerParent: parentCount ? cohort.length / parentCount : null,
    pending: pending.length, overdue: pending.filter(isOverdue).length,
    monthly, stages, statuses, cohortPending: cohortPending.length, cohortOverdue: cohortPending.filter(isOverdue).length,
    departments, aging, attention,
  };
}

export type ReviewAction =
  | { type: "assign"; staff: string; comment: string }
  | { type: "confirm"; comment: string }
  | { type: "approve"; comment: string };

export type DepartmentSortKey = "name" | "started" | "completed" | "pending" | "overdue";
export type DepartmentSort = { key: DepartmentSortKey; direction: "asc" | "desc" };

export function sortReviewDepartments(departments: ReturnType<typeof summarizeReviews>["departments"], sort: DepartmentSort | null) {
  if (!sort) return [...departments];
  return [...departments].sort((left, right) => {
    const comparison = sort.key === "name"
      ? left.name.localeCompare(right.name, "vi", { numeric: true })
      : left[sort.key] - right[sort.key];
    return (sort.direction === "asc" ? comparison : -comparison) || left.name.localeCompare(right.name, "vi", { numeric: true });
  });
}

export function reviewAssignee(review: StandardReview) {
  return ["completed", "cancelled", "unknown"].includes(review.stage) ? "" : review.stage === "staff" ? review.staff : review.manager;
}

export function applyReview(review: StandardReview, action: ReviewAction, actor: string, now: string, people: ReviewPerson[]): StandardReview {
  if (["completed", "cancelled", "unknown"].includes(review.stage)) throw new Error("Lượt thẩm định đã kết thúc hoặc không thể xử lý.");
  if (!actor || actor !== reviewAssignee(review)) throw new Error("Bạn không phải người xử lý bước hiện tại.");
  const comment = action.comment.trim();
  if (!comment) throw new Error("Vui lòng nhập ý kiến xử lý.");
  let next: StandardReview;
  let label: string;
  const dueAt = new Date(Date.parse(now) + 2 * 86400000).toISOString();
  if (action.type === "confirm") {
    if (review.stage !== "staff") throw new Error("Bước này không dành cho nhân viên xác nhận.");
    next = { ...review, stage: "recheck", staffComment: comment, dueAt };
    label = "Nhân viên xác nhận";
  } else {
    if (review.stage === "staff") throw new Error("Cần nhân viên xác nhận trước khi trưởng phòng xử lý.");
    if (action.type === "assign") {
      if (!action.staff || action.staff === actor || !people.some((person) => person.id === action.staff)) {
        throw new Error("Vui lòng chọn nhân viên hợp lệ.");
      }
      next = { ...review, stage: "staff", staff: action.staff, managerComment: comment, staffComment: "", dueAt };
      label = `Phân công: ${people.find((person) => person.id === action.staff)!.name}`;
    } else {
      next = { ...review, stage: "completed", managerComment: comment, endedAt: now };
      label = "Phòng ban phê duyệt";
    }
  }
  return { ...next, history: [...review.history, { at: now, actor, action: label, comment }] };
}

export function buildReviewDemo(): ReviewSnapshot {
  const people = [
    { id: "ws-manager-qa", name: "Alex Morgan · QA Manager" },
    { id: "ws-manager-pe", name: "Jordan Lee · PE Manager" },
    { id: "ws-staff-qa", name: "Sam Taylor · QA Staff" },
    { id: "ws-staff-pe", name: "Casey Miller · PE Staff" },
  ];
  const parents = [
    { parentId: "ws-parent-1", code: "WS-2026-0418", title: "Tiêu chuẩn kiểm tra chất lượng công đoạn", standardNo: "WS-QA-042", revision: "03", summary: "Cập nhật tiêu chí kiểm tra ngoại quan và phương pháp ghi nhận kết quả tại công đoạn cuối." },
    { parentId: "ws-parent-2", code: "WS-2026-0419", title: "Tiêu chuẩn vận hành thiết bị sản xuất", standardNo: "WS-PE-108", revision: "05", summary: "Điều chỉnh trình tự kiểm tra trước vận hành và trách nhiệm xác nhận của từng ca." },
    { parentId: "ws-parent-3", code: "WS-2026-0420", title: "Tiêu chuẩn quản lý thay đổi thông số", standardNo: "WS-PE-116", revision: "02", summary: "Bổ sung yêu cầu kiểm soát thông số và lưu hồ sơ sau thay đổi." },
  ];
  const stages: ReviewStage[] = ["manager", "staff", "recheck", "completed", "manager", "completed"];
  const reviews = stages.map((stage, index): StandardReview => {
    const qa = index % 2 === 0;
    const manager = qa ? people[0].id : people[1].id;
    const staff = qa ? people[2].id : people[3].id;
    const startedAt = "2026-11-02T08:00:00.000Z";
    const history: ReviewEvent[] = [{ at: startedAt, actor: manager, action: "Tiếp nhận thẩm định", comment: "Phòng ban liên quan nhận yêu cầu từ hồ sơ Working Standard." }];
    if (stage === "staff" || stage === "recheck") history.push({ at: "2026-11-03T08:00:00.000Z", actor: manager, action: "Phân công nhân viên", comment: "Kiểm tra nội dung thay đổi và tính phù hợp tại công đoạn." });
    if (stage === "recheck") history.push({ at: "2026-11-04T08:00:00.000Z", actor: staff, action: "Nhân viên xác nhận", comment: "Đã đối chiếu thực tế, nội dung phù hợp." });
    if (stage === "completed") history.push({ at: "2026-11-04T10:00:00.000Z", actor: manager, action: "Phòng ban phê duyệt", comment: "Đồng ý nội dung tiêu chuẩn." });
    return {
      ...parents[Math.floor(index / 2)], id: `ws-review-${index + 1}`, requester: "Riley Parker", department: qa ? "QA · Đảm bảo chất lượng" : "PE · Kỹ thuật sản xuất",
      manager, staff: stage === "manager" ? "" : staff, stage, startedAt,
      dueAt: index === 0 ? "2026-11-04T08:00:00.000Z" : "2026-11-07T08:00:00.000Z",
      endedAt: stage === "completed" ? "2026-11-04T10:00:00.000Z" : "",
      managerComment: stage === "manager" ? "" : "Kiểm tra nội dung thay đổi và tính phù hợp tại công đoạn.",
      staffComment: stage === "recheck" ? "Đã đối chiếu thực tế, nội dung phù hợp." : "",
      history, attachments: [],
    };
  });
  return { source: "demo", loadedAt: "2026-11-05T08:00:00.000Z", reviews, people };
}