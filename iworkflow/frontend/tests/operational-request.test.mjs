import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { test } from "node:test";
import ts from "typescript";

function load(file) {
  const source = fs.readFileSync(new URL(`../src/lib/${file}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const sandbox = { exports: {} };
  vm.runInNewContext(compiled, sandbox);
  return sandbox.exports;
}

const {
  ORF_ERRORS, ORF_OPEN_STAGES, ORF_PIC_3312, ORF_YUSEN_WH, applyOrfAction, buildOrfDemo, createOrfRequest, isOrfOverdue, isOrfStale,
  orfDecision, orfExpectedAssignee, orfInputFrom, orfReachedIndex, orfStatus, orfTaskStatus, sortOrfDepartments, splitBarcodes, summarizeOrf,
} = load("operational-request.ts");
const { operationalRequestMessages, orfErrorText } = load("i18n-operational-request.ts");
const now = "2026-11-05T09:00:00.000Z";
const plain = (value) => JSON.parse(JSON.stringify(value));
const byStage = (snapshot, stage) => snapshot.requests.find((request) => request.stage === stage);
const input = (overrides = {}) => ({
  department: "fi", title: " Tái kiểm ", productCode: "Y4S", quantity: "12", barcodes: "A1\tbelt\n\n  B2  \r\nC3", reason: "Kiểm tra",
  lotFrom: { shift: "A", date: "2026-11-01" }, lotTo: { shift: "C", date: "2026-11-02" }, desiredFrom: { shift: "", date: "" }, desiredTo: { shift: "", date: "" },
  plannedDate: "2026-11-06", plannedHandling: "", approver: "orf-approver-fi", ...overrides,
});
const result = (overrides = {}) => ({ total: "12", ok: "10", ng: "2", reason: "Lệch belt", ngHandling: "", ngDate: "", okRelease: true, returnedAt: "", changePlace: "", ...overrides });

test("task status treats Activiti 'completed' delete reason as normal completion", () => {
  assert.equal(orfTaskStatus(true, "completed"), "completed");
  assert.equal(orfTaskStatus(true, null), "completed");
  assert.equal(orfTaskStatus(true, "Hủy do trùng yêu cầu"), "stopped");
  assert.equal(orfTaskStatus(false, "completed"), "pending");
});

test("legacy eForm buttons map to decisions per step", () => {
  assert.equal(orfDecision("P4M_Button_PD", "approval"), "approve");
  assert.equal(orfDecision("P4M_Button_TC", "approval"), "reject");
  assert.equal(orfDecision("P4M_Button_YCCS", "resultApproval"), "revise");
  assert.equal(orfDecision(null, "approval"), "approve");
  assert.equal(orfDecision("btnComplete", "approval"), "");
  assert.equal(orfDecision("btnComplete", "request"), "submit");
  assert.equal(orfDecision("btnComplete", "warehouse"), "receive");
  assert.equal(orfDecision("btnComplete", "confirmWH"), "confirm");
  assert.equal(orfDecision(null, "unknown"), "");
});

test("barcode lists split by line and collapse inner whitespace", () => {
  assert.deepEqual(plain(splitBarcodes("5GH0HPL\tRMC 6 kéo\r\n\n  DFY875G  \nV9601KZ")), ["5GH0HPL RMC 6 kéo", "DFY875G", "V9601KZ"]);
  assert.deepEqual(plain(splitBarcodes("")), []);
});

test("demo snapshot covers every open stage plus completed, rejected and a revised request", () => {
  const demo = buildOrfDemo();
  const stages = new Set(demo.requests.map((request) => request.stage));
  for (const stage of [...ORF_OPEN_STAGES.filter((stage) => stage !== "confirmWH"), "completed", "rejected"]) assert.ok(stages.has(stage), stage);
  for (const request of demo.requests) {
    const open = orfStatus(request) === "open";
    assert.equal(request.history.filter((event) => event.status === "pending").length, open ? 1 : 0, request.code);
    if (open) assert.equal(request.assignee, orfExpectedAssignee(request, request.stage), request.code);
  }
  const rejected = byStage(demo, "rejected");
  assert.deepEqual(plain(rejected.history.map((event) => [event.stage, event.decision])), [["request", "submit"], ["approval", "reject"]]);
  const revised = byStage(demo, "request");
  assert.deepEqual(plain(revised.history.map((event) => [event.stage, event.decision, event.status])), [["request", "submit", "completed"], ["approval", "revise", "completed"], ["request", "", "pending"]]);
  assert.equal(orfReachedIndex(byStage(demo, "completed")), ORF_OPEN_STAGES.length);
  assert.equal(orfReachedIndex(rejected), 1);
});

test("happy path walks all eight BPMN steps to completion", () => {
  const demo = buildOrfDemo();
  let request = createOrfRequest(input(), "orf-pic-fi", now, demo);
  assert.equal(request.stage, "approval");
  assert.equal(request.assignee, "orf-approver-fi");
  request = applyOrfAction(request, { type: "approve", comment: "" }, "orf-approver-fi", now, demo.people);
  assert.equal(request.assignee, ORF_PIC_3312);
  request = applyOrfAction(request, { type: "receive", comment: "" }, ORF_PIC_3312, now, demo.people);
  assert.equal(request.stage, "warehouse");
  assert.equal(request.assignee, ORF_YUSEN_WH);
  assert.throws(() => applyOrfAction(request, { type: "receive", comment: "" }, ORF_YUSEN_WH, now, demo.people), { message: ORF_ERRORS.warehouse });
  request = applyOrfAction(request, { type: "receive", comment: "", warehouseConfirm: " Đã trace " }, ORF_YUSEN_WH, now, demo.people);
  assert.equal(request.stage, "result");
  assert.equal(request.warehouseConfirm, "Đã trace");
  assert.equal(request.assignee, "orf-pic-fi");
  request = applyOrfAction(request, { type: "result", result: result() }, "orf-pic-fi", now, demo.people);
  assert.equal(request.stage, "resultApproval");
  request = applyOrfAction(request, { type: "approve", comment: "" }, "orf-approver-fi", now, demo.people);
  assert.equal(request.stage, "confirm3312");
  request = applyOrfAction(request, { type: "confirm", comment: "" }, ORF_PIC_3312, now, demo.people);
  assert.equal(request.stage, "confirmWH");
  request = applyOrfAction(request, { type: "confirm", comment: "OK" }, ORF_YUSEN_WH, "2026-11-06T09:00:00.000Z", demo.people);
  assert.equal(request.stage, "completed");
  assert.equal(request.assignee, "");
  assert.equal(request.dueAt, "");
  assert.equal(request.endedAt, "2026-11-06T09:00:00.000Z");
  assert.equal(request.history.length, 8);
  assert.ok(request.history.every((event) => event.status === "completed"));
  assert.deepEqual(plain(request.history.map((event) => event.stage)), plain(ORF_OPEN_STAGES));
});

test("approvers can revise back to the right step or reject, with a mandatory comment", () => {
  const demo = buildOrfDemo();
  const approval = byStage(demo, "approval");
  assert.throws(() => applyOrfAction(approval, { type: "revise", comment: " " }, "orf-approver-fi", now, demo.people), { message: ORF_ERRORS.comment });
  const revised = applyOrfAction(approval, { type: "revise", comment: "Bổ sung barcode" }, "orf-approver-fi", now, demo.people);
  assert.equal(revised.stage, "request");
  assert.equal(revised.assignee, approval.requester);
  const rejected = applyOrfAction(approval, { type: "reject", comment: "Trùng" }, "orf-approver-fi", now, demo.people);
  assert.equal(rejected.stage, "rejected");
  assert.equal(orfStatus(rejected), "rejected");
  assert.equal(rejected.endedAt, now);

  const resultApproval = byStage(demo, "resultApproval");
  const back = applyOrfAction(resultApproval, { type: "revise", comment: "Sai số NG" }, resultApproval.approver, now, demo.people);
  assert.equal(back.stage, "result");
  assert.equal(back.assignee, resultApproval.requester);
});

test("resubmitting a revised request updates the sheet and goes back to approval", () => {
  const demo = buildOrfDemo();
  const revised = byStage(demo, "request");
  const next = applyOrfAction(revised, { type: "submit", input: { ...orfInputFrom(revised), barcodes: "M8T0590\nM8T058W\nM8T0600" } }, revised.requester, now, demo.people);
  assert.equal(next.stage, "approval");
  assert.equal(next.barcodeCount, 3);
  assert.equal(next.code, revised.code);
});

test("actions are guarded by assignee, step and closed state", () => {
  const demo = buildOrfDemo();
  const approval = byStage(demo, "approval");
  assert.throws(() => applyOrfAction(approval, { type: "approve", comment: "" }, "orf-approver-qa", now, demo.people), { message: ORF_ERRORS.actor });
  assert.throws(() => applyOrfAction(approval, { type: "confirm", comment: "" }, "orf-approver-fi", now, demo.people), { message: ORF_ERRORS.action });
  assert.throws(() => applyOrfAction(byStage(demo, "completed"), { type: "confirm", comment: "" }, ORF_YUSEN_WH, now, demo.people), { message: ORF_ERRORS.ended });
});

test("result sheet requires totals and an NG handling date when NG handling is chosen", () => {
  const demo = buildOrfDemo();
  const pending = byStage(demo, "result");
  assert.throws(() => applyOrfAction(pending, { type: "result", result: result({ ng: " " }) }, pending.requester, now, demo.people), { message: ORF_ERRORS.result });
  assert.throws(() => applyOrfAction(pending, { type: "result", result: result({ ngHandling: "return" }) }, pending.requester, now, demo.people), { message: ORF_ERRORS.ngDate });
  const next = applyOrfAction(pending, { type: "result", result: result({ ngHandling: "return", ngDate: "2026-11-07" }) }, pending.requester, now, demo.people);
  assert.equal(next.result.ngDate, "2026-11-07");
});

test("new requests get validated and sequential department codes", () => {
  const demo = buildOrfDemo();
  assert.throws(() => createOrfRequest(input({ title: " " }), "orf-pic-fi", now, demo), { message: ORF_ERRORS.required });
  assert.throws(() => createOrfRequest(input({ approver: "orf-pic-qa" }), "orf-pic-fi", now, demo), { message: ORF_ERRORS.approver });
  assert.throws(() => createOrfRequest(input({ approver: "orf-approver-fi" }), "orf-approver-fi", now, demo), { message: ORF_ERRORS.approver });
  assert.throws(() => createOrfRequest(input({ lotTo: { shift: "", date: "2026-10-01" } }), "orf-pic-fi", now, demo), { message: ORF_ERRORS.range });

  const first = createOrfRequest(input(), "orf-pic-fi", now, demo);
  assert.equal(first.department, "FI");
  assert.equal(first.title, "Tái kiểm");
  assert.deepEqual(plain(first.barcodes), ["A1 belt", "B2", "C3"]);
  const highest = Math.max(...demo.requests.filter((request) => request.code.startsWith("FI-2026-")).map((request) => Number(request.code.slice(8))));
  assert.equal(first.code, `FI-2026-${String(highest + 1).padStart(3, "0")}`);
  assert.equal(first.id, `orf-demo-${demo.requests.length + 1}`);
  const second = createOrfRequest(input(), "orf-pic-fi", now, { ...demo, requests: [first, ...demo.requests] });
  assert.equal(second.code, `FI-2026-${String(highest + 2).padStart(3, "0")}`);
  const qa = createOrfRequest(input({ department: "QA", approver: "orf-approver-qa" }), "orf-pic-qa", "2027-01-02T00:00:00.000Z", demo);
  assert.equal(qa.code, "QA-2027-001");
});

test("overdue and stale use the snapshot time and only apply to open requests", () => {
  const demo = buildOrfDemo();
  const old = demo.requests.find((request) => request.startedAt.startsWith("2025"));
  assert.ok(isOrfStale(old, demo.loadedAt));
  assert.ok(isOrfOverdue(old, demo.loadedAt));
  assert.ok(!isOrfStale({ ...old, lastActivityAt: "2026-10-01T00:00:00.000Z" }, demo.loadedAt));
  const completed = byStage(demo, "completed");
  assert.ok(!isOrfOverdue({ ...completed, dueAt: "2020-01-01T00:00:00.000Z" }, demo.loadedAt));
  assert.ok(!isOrfStale({ ...completed, lastActivityAt: "2020-01-01T00:00:00.000Z" }, demo.loadedAt));
});

test("dashboard summary separates the period cohort from the all-time backlog", () => {
  const demo = buildOrfDemo();
  const summary = summarizeOrf(demo, 12);
  assert.equal(summary.started, demo.requests.length - 1);
  assert.equal(summary.statuses.reduce((total, item) => total + item.value, 0), summary.started);
  assert.equal(summary.completed, 1);
  assert.equal(summary.rejected, 1);
  assert.equal(summary.completionRate, 100 / 9);
  assert.equal(summary.backlog, 8);
  assert.equal(summary.backlogStale, 1);
  assert.equal(summary.aging.reduce((total, item) => total + item.value, 0), summary.backlog);
  assert.equal(summary.aging[4].value, 1);
  assert.equal(summary.backlogStages.reduce((total, item) => total + item.value, 0), summary.backlog);
  assert.equal(summary.backlogStages.find((item) => item.stage === "result").value, 2);
  assert.equal(summary.monthly.reduce((total, month) => total + month.value, 0), summary.started);
  assert.ok(summary.attention.every((request) => isOrfOverdue(request, demo.loadedAt)));
  assert.equal(summary.onTime + summary.overdue, summary.pending);
  assert.equal(summary.breakdown.reduce((total, item) => total + item.value, 0), summary.started);
  assert.deepEqual(plain(summary.breakdown.map((item) => item.key)), ["completed", "onTime", "overdue", "rejected", "cancelled"]);
  for (const unit of summary.departments) assert.equal(unit.completed + unit.onTime + unit.overdue + unit.closed, unit.started, unit.name);

  const qa = summarizeOrf(demo, 12, "QA");
  assert.deepEqual(plain(qa.departments.map((unit) => unit.name)), ["QA"]);
  assert.equal(qa.departments[0].backlog, 3);
  assert.equal(qa.departments[0].started, 3);
  const fiApprover = summary.approvers.find((approver) => approver.id === "orf-approver-fi");
  assert.equal(fiApprover.pending, 1);
});

test("department table sort keeps a stable name tie-break", () => {
  const rows = [
    { name: "QA", started: 3, completed: 0, pending: 3, overdue: 1, backlog: 3 },
    { name: "FI", started: 6, completed: 1, pending: 4, overdue: 1, backlog: 5 },
    { name: "TS", started: 3, completed: 0, pending: 0, overdue: 0, backlog: 0 },
  ];
  assert.deepEqual(plain(sortOrfDepartments(rows, null).map((row) => row.name)), ["QA", "FI", "TS"]);
  assert.deepEqual(plain(sortOrfDepartments(rows, { key: "started", direction: "asc" }).map((row) => row.name)), ["QA", "TS", "FI"]);
  assert.deepEqual(plain(sortOrfDepartments(rows, { key: "name", direction: "desc" }).map((row) => row.name)), ["TS", "QA", "FI"]);
});

test("every domain error has an English translation and Vietnamese passes through", () => {
  for (const message of Object.values(ORF_ERRORS)) {
    assert.equal(orfErrorText(message, "vi"), message);
    assert.notEqual(orfErrorText(message, "en"), message);
  }
  for (const locale of ["vi", "en"]) {
    const t = operationalRequestMessages[locale];
    for (const stage of [...ORF_OPEN_STAGES, "completed", "rejected", "cancelled", "unknown"]) assert.ok(t.stages[stage], `${locale} ${stage}`);
    assert.equal(t.aging.length, 5);
  }
});
