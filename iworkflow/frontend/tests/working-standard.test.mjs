import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";

const source = fs.readFileSync(new URL("../src/lib/working-standard.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText;
const sandbox = { exports: {} };
vm.runInNewContext(compiled, sandbox);
const { applyReview, buildReviewDemo, reviewAssignee, summarizeReviews, reviewPeriodStart, sortReviewDepartments, getReviewParent, parentApprovalState, groupReviewCases, summarizeReviewCases, reviewTaskStatus } = sandbox.exports;
const translationSource = fs.readFileSync(new URL("../src/lib/i18n-working-standard.ts", import.meta.url), "utf8");
const translationCode = ts.transpileModule(translationSource, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2017 } }).outputText;
const translationSandbox = { exports: {} };
vm.runInNewContext(translationCode, translationSandbox);
const { workingStandardMessages, reviewErrorText } = translationSandbox.exports;
const now = "2026-11-05T09:00:00.000Z";

test("Activiti completed task deletion reason is normal completion, not a stopped task", () => {
  assert.equal(reviewTaskStatus(true, "completed"), "completed");
  assert.equal(reviewTaskStatus(true, " COMPLETED "), "completed");
  assert.equal(reviewTaskStatus(true, null), "completed");
  assert.equal(reviewTaskStatus(true, ""), "completed");
  assert.equal(reviewTaskStatus(true, "  "), "completed");
});

test("task history keeps actual stops separate from unfinished tasks", () => {
  assert.equal(reviewTaskStatus(true, "deleted"), "stopped");
  assert.equal(reviewTaskStatus(true, "cancelled"), "stopped");
  assert.equal(reviewTaskStatus(true, "boundary event interrupted"), "stopped");
  assert.equal(reviewTaskStatus(false, null), "pending");
  assert.equal(reviewTaskStatus(false, "completed"), "pending");
});

test("task-history labels distinguish normal completion from stopped work in both languages", () => {
  const vi = workingStandardMessages.vi.queue.taskStatuses;
  const en = workingStandardMessages.en.queue.taskStatuses;
  assert.equal(vi[reviewTaskStatus(true, "completed")], "Đã xử lý");
  assert.equal(en[reviewTaskStatus(true, "completed")], "Completed");
  assert.equal(vi[reviewTaskStatus(true, "cancelled")], "Đã dừng / hủy");
  assert.equal(en[reviewTaskStatus(false, null)], "In Progress");
});

test("counts department reviews separately from parent cases", () => {
  const { reviews } = buildReviewDemo();
  assert.equal(reviews.length, 6);
  assert.equal(new Set(reviews.map((review) => review.parentId)).size, 3);
});

test("parent state comes from its own process even when the selected review is completed", () => {
  const snapshot = buildReviewDemo();
  const selected = snapshot.reviews[3];
  snapshot.source = "iw_prod";
  snapshot.parents = [{ id: selected.parentId, state: "running", endedAt: "", totalReviews: 7, completedReviews: 4, pendingReviews: 3, cancelledReviews: 0 }];
  const parent = getReviewParent(snapshot, selected.parentId);
  assert.equal(selected.stage, "completed");
  assert.equal(parent.state, "running");
  assert.equal(parent.completedReviews, 4);
  assert.equal(parent.totalReviews, 7);
  assert.equal(parent.pendingReviews, 3);
  snapshot.parents[0] = { ...parent, completedReviews: 7, pendingReviews: 0 };
  assert.equal(getReviewParent(snapshot, selected.parentId).state, "running");
  snapshot.parents[0] = { ...parent, state: "completed", endedAt: now, completedReviews: 7, pendingReviews: 0 };
  assert.equal(getReviewParent(snapshot, selected.parentId).state, "completed");
});

test("missing production parent data is unknown, never inferred from visible siblings", () => {
  const snapshot = { ...buildReviewDemo(), source: "iw_prod" };
  assert.equal(getReviewParent(snapshot, snapshot.reviews[3].parentId), null);
});

test("demo review progress updates independently of parent process state", () => {
  const snapshot = buildReviewDemo();
  const parentId = snapshot.reviews[0].parentId;
  for (const review of snapshot.reviews.filter((item) => item.parentId === parentId)) {
    review.stage = "completed";
    review.endedAt = now;
  }
  const parent = getReviewParent(snapshot, parentId);
  assert.equal(parent.totalReviews, 2);
  assert.equal(parent.completedReviews, 2);
  assert.equal(parent.pendingReviews, 0);
  assert.equal(parent.state, "running");
});

test("case approval is Completed only when every required review is completed, regardless of engine state", () => {
  const parent = { id: "parent", state: "running", endedAt: "", totalReviews: 7, completedReviews: 4, pendingReviews: 3, cancelledReviews: 0 };
  assert.equal(parentApprovalState(parent), "running");
  assert.equal(parentApprovalState({ ...parent, state: "completed", endedAt: now }), "running");
  assert.equal(parentApprovalState({ ...parent, completedReviews: 7, pendingReviews: 0 }), "completed");
  assert.equal(parentApprovalState({ ...parent, completedReviews: 6, pendingReviews: 0, cancelledReviews: 1 }), "running");
  assert.equal(parentApprovalState({ ...parent, totalReviews: 0, completedReviews: 0, pendingReviews: 0 }), "running");
  assert.equal(parentApprovalState(null), "running");
});

test("case list groups by parent ID without duplicating department rows", () => {
  const snapshot = buildReviewDemo();
  const cases = groupReviewCases(snapshot);
  assert.equal(cases.length, 3);
  assert.equal(cases[0].reviews.length, 2);
  assert.equal(new Set(cases.map((item) => item.id)).size, 3);
  for (const review of snapshot.reviews.filter((item) => item.parentId === cases[0].id)) {
    review.stage = "completed";
    review.endedAt = now;
  }
  assert.equal(groupReviewCases(snapshot)[0].approvalState, "completed");
});

test("completed department drilldown cannot mark an incomplete parent case Completed", () => {
  const snapshot = buildReviewDemo();
  snapshot.source = "iw_prod";
  snapshot.reviews = [snapshot.reviews[3]];
  snapshot.parents = [{ id: snapshot.reviews[0].parentId, state: "running", endedAt: "", totalReviews: 7, completedReviews: 4, pendingReviews: 3, cancelledReviews: 0 }];
  const cases = groupReviewCases(snapshot);
  assert.equal(cases.length, 1);
  assert.equal(cases[0].reviews[0].stage, "completed");
  assert.equal(cases[0].approvalState, "running");
  assert.equal(cases[0].parent.totalReviews, 7);
});

test("case dashboard counts parents once and requires all departments for completion", () => {
  const snapshot = buildReviewDemo();
  for (const review of snapshot.reviews.filter((item) => item.parentId === "ws-parent-1")) { review.stage = "completed"; review.endedAt = now; }
  const summary = summarizeReviewCases(snapshot);
  assert.equal(summary.started, 3);
  assert.equal(summary.completed, 1);
  assert.equal(summary.pending, 2);
  assert.equal(summary.completed + summary.pending, summary.started);
  assert.equal(summary.statuses.reduce((total, item) => total + item.value, 0), 3);
  assert.equal(summary.monthly.reduce((total, item) => total + item.value, 0), 3);
  assert.equal(summary.monthly.reduce((total, item) => total + item.secondary, 0), 1);
  assert.equal(summary.aging.reduce((total, item) => total + item.value, 0), 2);
  assert.equal(summary.averageDays, 73 / 24);
  const department = summarizeReviewCases(snapshot, 12, "PE · Kỹ thuật sản xuất");
  assert.equal(department.started, 3);
  assert.equal(department.completed, 1);
  const empty = summarizeReviewCases({ ...snapshot, reviews: [] });
  assert.equal(empty.completionRate, null);
  assert.equal(empty.averageDays, null);
});

test("case dashboard uses the actual parent creation time and full-history approval metadata", () => {
  const snapshot = buildReviewDemo();
  snapshot.source = "iw_prod";
  snapshot.reviews = [snapshot.reviews[3]];
  snapshot.parents = [{ id: snapshot.reviews[0].parentId, state: "running", endedAt: "", startedAt: "2024-01-01T00:00:00.000Z", reviewsCompletedAt: now, totalReviews: 7, completedReviews: 4, pendingReviews: 3, cancelledReviews: 0 }];
  assert.equal(summarizeReviewCases(snapshot).started, 0);
  snapshot.parents[0].startedAt = "2026-11-02T08:00:00.000Z";
  assert.equal(summarizeReviewCases(snapshot).pending, 1);
  assert.equal(summarizeReviewCases(snapshot).completed, 0);
  snapshot.parents[0].completedReviews = 7;
  snapshot.parents[0].pendingReviews = 0;
  const completed = summarizeReviewCases(snapshot);
  assert.equal(completed.completed, 1);
  assert.equal(completed.completionRate, 100);
  assert.equal(completed.averageDays, 73 / 24);
});

test("department stacked chart counts distinct parents and reconciles Completed plus In Progress", () => {
  const snapshot = buildReviewDemo();
  snapshot.reviews.push({ ...snapshot.reviews[0], id: "repeat-qa-review" });
  for (const review of snapshot.reviews.filter((item) => item.parentId === "ws-parent-2")) { review.stage = "completed"; review.endedAt = now; }
  const summary = summarizeReviewCases(snapshot);
  assert.equal(summary.started, 3);
  assert.equal(summary.departments.length, 2);
  for (const unit of summary.departments) {
    assert.equal(unit.started, 3);
    assert.equal(unit.completed, 1);
    assert.equal(unit.pending, 2);
    assert.equal(unit.completed + unit.pending, unit.started);
  }
  const selected = summarizeReviewCases(snapshot, 3, "QA · Đảm bảo chất lượng");
  assert.equal(selected.departments.length, 1);
  assert.equal(selected.departments[0].started, 3);
  assert.equal(selected.departments[0].completed + selected.departments[0].pending, 3);
});

test("manager can approve directly without changing the source record", () => {
  const { reviews, people } = buildReviewDemo();
  const original = reviews[0];
  const next = applyReview(original, { type: "approve", comment: " Approved " }, original.manager, now, people);
  assert.equal(next.stage, "completed");
  assert.equal(next.endedAt, now);
  assert.equal(next.managerComment, "Approved");
  assert.equal(reviewAssignee(next), "");
  assert.equal(original.stage, "manager");
});

test("assignment, staff confirmation, recheck, and reassignment follow the BPMN", () => {
  const { reviews, people } = buildReviewDemo();
  const original = reviews[0];
  const assigned = applyReview(original, { type: "assign", staff: "ws-staff-qa", comment: "Check" }, original.manager, now, people);
  assert.equal(assigned.stage, "staff");
  assert.equal(reviewAssignee(assigned), "ws-staff-qa");
  assert.equal(assigned.dueAt, "2026-11-07T09:00:00.000Z");
  const confirmed = applyReview(assigned, { type: "confirm", comment: "Checked" }, assigned.staff, now, people);
  assert.equal(confirmed.stage, "recheck");
  assert.equal(reviewAssignee(confirmed), original.manager);
  assert.equal(confirmed.staffComment, "Checked");
  const reassigned = applyReview(confirmed, { type: "assign", staff: "ws-staff-qa", comment: "Recheck" }, confirmed.manager, now, people);
  assert.equal(reassigned.stage, "staff");
  assert.equal(reassigned.staffComment, "");
  const completed = applyReview(confirmed, { type: "approve", comment: "Agreed" }, confirmed.manager, now, people);
  assert.equal(completed.stage, "completed");
  assert.equal(completed.history.length, original.history.length + 3);
  assert.equal(completed.history.at(-1).actor, original.manager);
});

test("rejects wrong actor, wrong task, empty comment, and invalid assignment", () => {
  const { reviews, people } = buildReviewDemo();
  const review = reviews[0];
  assert.throws(() => applyReview(review, { type: "approve", comment: "OK" }, "other", now, people));
  assert.throws(() => applyReview(review, { type: "approve", comment: "  " }, review.manager, now, people));
  assert.throws(() => applyReview(review, { type: "confirm", comment: "OK" }, review.manager, now, people));
  for (const staff of ["", "missing", review.manager]) {
    assert.throws(() => applyReview(review, { type: "assign", staff, comment: "Check" }, review.manager, now, people));
  }
  const assigned = applyReview(review, { type: "assign", staff: "ws-staff-qa", comment: "Check" }, review.manager, now, people);
  assert.throws(() => applyReview(assigned, { type: "approve", comment: "OK" }, assigned.staff, now, people));
});

test("completed, cancelled, and unknown states cannot be processed", () => {
  const { reviews, people } = buildReviewDemo();
  for (const stage of ["completed", "cancelled", "unknown"]) {
    const review = { ...reviews[0], stage };
    assert.equal(reviewAssignee(review), "");
    assert.throws(() => applyReview(review, { type: "approve", comment: "OK" }, review.manager, now, people));
  }
});

test("dashboard distinguishes parent cases, completed cohort, backlog, and overdue tasks", () => {
  const summary = summarizeReviews(buildReviewDemo());
  assert.equal(summary.parentCount, 3);
  assert.equal(summary.started, 6);
  assert.equal(summary.completed, 2);
  assert.equal(summary.pending, 4);
  assert.equal(summary.overdue, 1);
  assert.equal(summary.reviewsPerParent, 2);
  assert.equal(summary.averageDays, 50 / 24);
  assert.equal(summary.monthly.reduce((total, month) => total + month.value, 0), 6);
  assert.equal(summary.monthly.reduce((total, month) => total + month.secondary, 0), 2);
  assert.equal(summary.stages.reduce((total, stage) => total + stage.value, 0), 4);
  assert.equal(summary.aging.reduce((total, group) => total + group.value, 0), 4);
  assert.equal(summary.attention[0].id, "ws-review-1");
});

test("dashboard retains older open work but excludes it from period volume and cancelled lead time", () => {
  const snapshot = buildReviewDemo();
  snapshot.reviews.push({ ...snapshot.reviews[0], id: "old", parentId: "old-parent", startedAt: "2024-01-01T00:00:00Z" });
  snapshot.reviews.push({ ...snapshot.reviews[3], id: "cancelled", stage: "cancelled" });
  const summary = summarizeReviews(snapshot, 3);
  assert.equal(summary.parentCount, 3);
  assert.equal(summary.started, 7);
  assert.equal(summary.pending, 5);
  assert.equal(summary.cancelled, 1);
  assert.equal(summary.completed, 2);
  assert.equal(summary.averageDays, 50 / 24);
});

test("dashboard department filtering and empty data have consistent denominators", () => {
  const snapshot = buildReviewDemo();
  const summary = summarizeReviews(snapshot, 6, "QA · Đảm bảo chất lượng");
  assert.equal(summary.parentCount, 3);
  assert.equal(summary.started, 3);
  assert.equal(summary.pending, 3);
  assert.equal(summary.completed, 0);
  const empty = summarizeReviews({ ...snapshot, reviews: [] });
  assert.equal(empty.completionRate, null);
  assert.equal(empty.averageDays, null);
  assert.equal(empty.reviewsPerParent, null);
  assert.equal(empty.pending, 0);
  assert.equal(empty.monthly.length, 13);
});

test("period status chart is mutually exclusive and excludes older backlog", () => {
  const snapshot = buildReviewDemo();
  snapshot.reviews.push({ ...snapshot.reviews[3], id: "cancelled", stage: "cancelled" });
  snapshot.reviews.push({ ...snapshot.reviews[0], id: "unknown", stage: "unknown", dueAt: "" });
  snapshot.reviews.push({ ...snapshot.reviews[0], id: "older", startedAt: "2024-01-01T00:00:00Z" });
  const summary = summarizeReviews(snapshot);
  assert.equal(summary.statuses.length, 6);
  assert.equal(summary.statuses.reduce((total, item) => total + item.value, 0), summary.started);
  assert.equal(summary.statuses.find((item) => item.stage === "completed").value, 2);
  assert.equal(summary.statuses.find((item) => item.stage === "cancelled").value, 1);
  assert.equal(summary.statuses.find((item) => item.stage === "unknown").value, 1);
  assert.equal(summary.cohortPending, 5);
  assert.equal(summary.pending, 6);
  assert.equal(summary.cohortOverdue, 1);
  assert.equal(summary.overdue, 2);
  const filtered = summarizeReviews(snapshot, 3, "QA · Đảm bảo chất lượng");
  assert.equal(filtered.statuses.reduce((total, item) => total + item.value, 0), filtered.started);
  const empty = summarizeReviews({ ...snapshot, reviews: [] });
  assert.equal(empty.statuses.reduce((total, item) => total + item.value, 0), 0);
});

test("98.5 percent means 2233 completed reviews out of 2267 starts, not completed parent cases", () => {
  const snapshot = buildReviewDemo();
  const completed = snapshot.reviews[3];
  const pending = snapshot.reviews[0];
  snapshot.reviews = [
    ...Array.from({ length: 2233 }, (_, index) => ({ ...completed, id: `completed-${index}` })),
    ...Array.from({ length: 24 }, (_, index) => ({ ...pending, id: `pending-${index}` })),
    ...Array.from({ length: 10 }, (_, index) => ({ ...completed, id: `cancelled-${index}`, stage: "cancelled" })),
  ];
  const summary = summarizeReviews(snapshot);
  assert.equal(summary.started, 2267);
  assert.equal(summary.completed, 2233);
  assert.equal(summary.cohortPending, 24);
  assert.equal(summary.cancelled, 10);
  assert.equal(Math.round(summary.completionRate * 10) / 10, 98.5);
  assert.equal(summary.completed + summary.cohortPending + summary.cancelled, summary.started);
});

test("rolling periods clamp month end and include their exact boundary", () => {
  assert.equal(reviewPeriodStart("2026-05-31T12:00:00.000Z", 3), "2026-02-28T12:00:00.000Z");
  const snapshot = buildReviewDemo();
  snapshot.reviews = [
    { ...snapshot.reviews[0], startedAt: "2025-11-05T08:00:00.000Z" },
    { ...snapshot.reviews[1], startedAt: "2025-11-05T07:59:59.999Z" },
    { ...snapshot.reviews[2], startedAt: "2026-11-06T08:00:00.000Z" },
  ];
  const summary = summarizeReviews(snapshot);
  assert.equal(summary.started, 1);
  assert.equal(summary.pending, 2);
});

test("department sorting supports every header in both directions without mutating priority order", () => {
  const rows = [
    { name: "Unit 10", started: 100, completed: 90, pending: 10, overdue: 2, parents: 3 },
    { name: "Unit 2", started: 20, completed: 18, pending: 2, overdue: 1, parents: 2 },
    { name: "Unit 1", started: 3, completed: 3, pending: 0, overdue: 0, parents: 1 },
  ];
  const original = JSON.stringify(rows);
  for (const key of ["name", "started", "completed", "pending", "overdue"]) {
    for (const direction of ["asc", "desc"]) {
      const sorted = sortReviewDepartments(rows, { key, direction });
      assert.equal(sorted[0].name, direction === "asc" ? "Unit 1" : "Unit 10");
      assert.equal(sorted[2].name, direction === "asc" ? "Unit 10" : "Unit 1");
    }
  }
  assert.equal(JSON.stringify(rows), original);
  assert.equal(JSON.stringify(sortReviewDepartments(rows, null)), original);
});

test("department sorting includes all rows before the visible top ten and resolves ties consistently", () => {
  const rows = Array.from({ length: 12 }, (_, index) => ({ name: `Unit ${index + 1}`, started: index, completed: 0, pending: 0, overdue: 0, parents: 1 }));
  const visible = sortReviewDepartments(rows, { key: "started", direction: "desc" }).slice(0, 10);
  assert.equal(visible[0].name, "Unit 12");
  assert.equal(visible[9].name, "Unit 3");
  const tied = sortReviewDepartments(rows, { key: "overdue", direction: "desc" });
  assert.equal(tied[0].name, "Unit 1");
  assert.equal(tied[1].name, "Unit 2");
  assert.equal(sortReviewDepartments([], { key: "name", direction: "asc" }).length, 0);
});

test("Working Standard English labels cover every Vietnamese message", () => {
  const compare = (vi, en, label = "messages") => {
    assert.equal(typeof en, typeof vi, label);
    if (typeof vi === "string") {
      assert.ok(en.trim(), label);
      assert.equal(/[À-ỹĐđ]/u.test(en), false, `${label} still contains Vietnamese label text`);
    } else if (typeof vi === "object") {
      assert.equal(Object.keys(en).sort().join("|"), Object.keys(vi).sort().join("|"), label);
      for (const key of Object.keys(vi)) compare(vi[key], en[key], `${label}.${key}`);
    }
  };
  compare(workingStandardMessages.vi, workingStandardMessages.en);
});

test("English dynamic labels preserve counts, sort directions, and case content", () => {
  const { en } = workingStandardMessages;
  assert.equal(en.queue.page("2", "114"), "Page 2 / 114");
  assert.equal(en.dashboard.recentMonths(12), "Last 12 months");
  assert.equal(en.dashboard.sortAction("Department", true), "Department: sort ascending");
  assert.equal(en.dashboard.sortAction("Department", false), "Department: sort descending");
  const fileName = "Tiêu chuẩn thao tác.pdf";
  assert.equal(en.queue.openDocument(fileName), `Open document ${fileName}`);
  assert.equal(en.queue.notice.approve, "Department review completed.");
});

test("review validation errors are translated without changing Vietnamese messages", () => {
  const message = "Vui lòng nhập ý kiến xử lý.";
  assert.equal(reviewErrorText(message, "vi"), message);
  assert.equal(reviewErrorText(message, "en"), "Please enter your review comments.");
  assert.equal(reviewErrorText("Unknown server detail", "en"), "Could not process the review.");
});