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
  UNIFORM_ERRORS, UNIFORM_GA_GROUP, UNIFORM_GA_MANAGER, UNIFORM_ITEMS, UNIFORM_LEGACY_STAGES, UNIFORM_OPEN_STAGES, UNIFORM_TASKS, applyUniformAction, buildUniformDemo,
  createUniformRequest, isUniformOverdue, isUniformStale, sortUniformDepartments, summarizeUniform, uniformCanAct, uniformDecision, uniformExpectedAssignee,
  uniformInputFrom, uniformItemRows, uniformItemsFrom, uniformPath, uniformQty, uniformReachedIndex, uniformStatus, uniformTaskStatus,
} = load("uniform-request.ts");
const { uniformErrorText, uniformRequestMessages } = load("i18n-uniform-request.ts");
const now = "2026-11-05T09:00:00.000Z";
const plain = (value) => JSON.parse(JSON.stringify(value));
const byStage = (snapshot, stage, section) => snapshot.requests.find((request) => request.stage === stage && (!section || request.section === section));
const rows = (entries) => uniformItemRows(entries.map(([key, returned, issued]) => ({ key, returned: { size: returned[0], qty: returned[1] }, issued: { size: issued[0], qty: issued[1] } })));
const input = (overrides = {}) => ({
  type: "oldForNew", title: " Đổi quần ", section: "3211", supervisor: "", requestDate: "2026-11-05", reason: " Rách gối ",
  items: rows([["pants", ["L", "1"], [" L ", " 2 "]]]), ...overrides,
});

test("task status treats Activiti 'completed' delete reason as normal completion", () => {
  assert.equal(uniformTaskStatus(true, "completed"), "completed");
  assert.equal(uniformTaskStatus(true, null), "completed");
  assert.equal(uniformTaskStatus(true, "Hủy do nghỉ việc"), "stopped");
  assert.equal(uniformTaskStatus(false, "completed"), "pending");
});

test("legacy buttons map to decisions and missing buttons are inferred from the next step", () => {
  assert.equal(uniformDecision("Uni_Direct_ConfirmOK", "supervisor"), "approve");
  assert.equal(uniformDecision("Uni_Direct_Reject", "supervisor"), "reject");
  assert.equal(uniformDecision("P4M_Button_PD", "manager", "gaStaff"), "approve");
  assert.equal(uniformDecision("P4M_Button_TC", "gaManager", "rejected"), "reject");
  assert.equal(uniformDecision(null, "manager", "request"), "revise");
  assert.equal(uniformDecision(null, "gaStaff", "rejected"), "reject");
  assert.equal(uniformDecision(null, "gaStaff", "gaManager"), "approve");
  assert.equal(uniformDecision(null, "gm"), "approve");
  assert.equal(uniformDecision("btnComplete", "manager", "gaStaff"), "");
  assert.equal(uniformDecision(null, "request", "manager"), "submit");
  assert.equal(uniformDecision(null, "confirm"), "confirm");
  assert.equal(uniformDecision(null, "unknown"), "");
});

test("every known task key maps to a current or legacy step", () => {
  const stages = new Set([...UNIFORM_OPEN_STAGES, ...UNIFORM_LEGACY_STAGES]);
  for (const [key, stage] of Object.entries(UNIFORM_TASKS)) assert.ok(stages.has(stage), key);
  for (const stage of UNIFORM_OPEN_STAGES) assert.ok(Object.values(UNIFORM_TASKS).includes(stage), stage);
});

test("eForm garment variables become sparse item rows and free-text quantities count", () => {
  const items = uniformItemsFrom({ New_TShirt_Short_Siz: "M", New_TShirt_Short_Qty: "02", Re_Joger_Size: "41", Re_Jogger_Qty: "1 đôi", New_Pants_Size: " " });
  assert.deepEqual(plain(items), [
    { key: "tshirtShort", returned: { size: "", qty: "" }, issued: { size: "M", qty: "02" } },
    { key: "jogger", returned: { size: "41", qty: "1 đôi" }, issued: { size: "", qty: "" } },
  ]);
  assert.equal(uniformQty("02"), 2);
  assert.equal(uniformQty("1 đôi"), 1);
  assert.equal(uniformQty("không"), 0);
  assert.equal(uniformItemRows(items).length, UNIFORM_ITEMS.length);
  assert.equal(uniformItemRows(items)[3].issued.size, "M");
});

test("supervisor step only applies to the gateway sections", () => {
  assert.deepEqual(plain(uniformPath({ section: "3212h", history: [] })), plain(UNIFORM_OPEN_STAGES));
  assert.deepEqual(plain(uniformPath({ section: "3211", history: [] })), ["request", "manager", "gaStaff", "gaManager", "confirm"]);
  assert.equal(uniformPath({ section: "3211", history: [{ stage: "supervisor" }] }).length, UNIFORM_OPEN_STAGES.length);
});

test("demo snapshot covers every open stage plus completed, rejected and a revised request", () => {
  const demo = buildUniformDemo();
  const stages = new Set(demo.requests.map((request) => request.stage));
  for (const stage of [...UNIFORM_OPEN_STAGES, "completed", "rejected"]) assert.ok(stages.has(stage), stage);
  for (const request of demo.requests) {
    const open = uniformStatus(request) === "open";
    assert.equal(request.history.filter((event) => event.status === "pending").length, open ? 1 : 0, request.code);
    if (open) assert.equal(request.assignee, uniformExpectedAssignee(request, request.stage), request.code);
    assert.ok(request.items.length > 0, request.code);
  }
  assert.equal(byStage(demo, "gaStaff").assignee, UNIFORM_GA_GROUP);
  assert.equal(byStage(demo, "gaManager").assignee, UNIFORM_GA_MANAGER);
  const rejected = byStage(demo, "rejected");
  assert.deepEqual(plain(rejected.history.map((event) => [event.stage, event.decision])), [["request", "submit"], ["supervisor", "approve"], ["manager", "approve"], ["gaStaff", "reject"]]);
  const revised = byStage(demo, "request");
  assert.deepEqual(plain(revised.history.map((event) => [event.stage, event.decision, event.status])), [["request", "submit", "completed"], ["manager", "revise", "completed"], ["request", "", "pending"]]);
  const completed = byStage(demo, "completed");
  assert.equal(uniformReachedIndex(completed), uniformPath(completed).length);
  assert.ok(completed.receiver && completed.receivedDate && completed.gaConfirm);
  assert.equal(uniformReachedIndex(rejected), 3);
});

test("happy path through the supervisor gateway walks all six steps", () => {
  const demo = buildUniformDemo();
  let request = createUniformRequest(input({ section: "3212H", supervisor: "uni-sup-fi" }), "uni-op-fi", now, demo);
  assert.equal(request.stage, "supervisor");
  assert.equal(request.assignee, "uni-sup-fi");
  assert.equal(request.manager, "uni-mgr-fi");
  request = applyUniformAction(request, { type: "approve", comment: "" }, "uni-sup-fi", now, demo.people);
  assert.equal(request.stage, "manager");
  request = applyUniformAction(request, { type: "approve", comment: "" }, "uni-mgr-fi", now, demo.people);
  assert.equal(request.stage, "gaStaff");
  assert.equal(request.assignee, UNIFORM_GA_GROUP);
  assert.throws(() => applyUniformAction(request, { type: "approve", comment: "" }, "uni-ga-2", now, demo.people), { message: UNIFORM_ERRORS.gaConfirm });
  request = applyUniformAction(request, { type: "approve", comment: "", gaConfirm: " Đủ điều kiện " }, "uni-ga-2", now, demo.people);
  assert.equal(request.stage, "gaManager");
  assert.equal(request.gaConfirm, "Đủ điều kiện");
  assert.equal(request.history.at(-2).actor, "uni-ga-2");
  request = applyUniformAction(request, { type: "approve", comment: "" }, UNIFORM_GA_MANAGER, now, demo.people);
  assert.equal(request.stage, "confirm");
  assert.equal(request.assignee, "uni-op-fi");
  assert.throws(() => applyUniformAction(request, { type: "confirm", receiver: " ", receivedDate: "2026-11-06" }, "uni-op-fi", now, demo.people), { message: UNIFORM_ERRORS.receipt });
  request = applyUniformAction(request, { type: "confirm", receiver: " Nguyễn Văn An ", receivedDate: "2026-11-06" }, "uni-op-fi", "2026-11-06T09:00:00.000Z", demo.people);
  assert.equal(request.stage, "completed");
  assert.equal(request.receiver, "Nguyễn Văn An");
  assert.equal(request.assignee, "");
  assert.equal(request.dueAt, "");
  assert.equal(request.endedAt, "2026-11-06T09:00:00.000Z");
  assert.deepEqual(plain(request.history.map((event) => event.stage)), plain(UNIFORM_OPEN_STAGES));
  assert.ok(request.history.every((event) => event.status === "completed"));
});

test("sections without the gateway go straight to the section manager", () => {
  const demo = buildUniformDemo();
  const request = createUniformRequest(input({ supervisor: "uni-sup-fi" }), "uni-op-qa", now, demo);
  assert.equal(request.stage, "manager");
  assert.equal(request.assignee, "uni-mgr-qa");
  assert.equal(request.supervisor, "");
});

test("approvers can revise back to the requester or reject, with a mandatory comment", () => {
  const demo = buildUniformDemo();
  const manager = byStage(demo, "manager", "3211");
  assert.throws(() => applyUniformAction(manager, { type: "revise", comment: " " }, "uni-mgr-qa", now, demo.people), { message: UNIFORM_ERRORS.comment });
  const revised = applyUniformAction(manager, { type: "revise", comment: "Bổ sung ảnh" }, "uni-mgr-qa", now, demo.people);
  assert.equal(revised.stage, "request");
  assert.equal(revised.assignee, manager.requester);
  const rejected = applyUniformAction(manager, { type: "reject", comment: "Chưa đến hạn đổi" }, "uni-mgr-qa", now, demo.people);
  assert.equal(uniformStatus(rejected), "rejected");
  assert.equal(rejected.endedAt, now);
  const gaManager = byStage(demo, "gaManager");
  assert.equal(applyUniformAction(gaManager, { type: "reject", comment: "Hết hàng" }, UNIFORM_GA_MANAGER, now, demo.people).stage, "rejected");
});

test("resubmitting a revised request updates the form and keeps the code", () => {
  const demo = buildUniformDemo();
  const revised = byStage(demo, "request");
  const next = applyUniformAction(revised, { type: "submit", input: { ...uniformInputFrom(revised), reason: "Áo bạc màu, đã chụp ảnh" } }, revised.requester, now, demo.people);
  assert.equal(next.stage, "manager");
  assert.equal(next.reason, "Áo bạc màu, đã chụp ảnh");
  assert.equal(next.code, revised.code);
  assert.equal(next.items.length, revised.items.length);
});

test("actions are guarded by assignee, GA group membership, step and closed state", () => {
  const demo = buildUniformDemo();
  const manager = byStage(demo, "manager", "3212H");
  assert.throws(() => applyUniformAction(manager, { type: "approve", comment: "" }, "uni-mgr-qa", now, demo.people), { message: UNIFORM_ERRORS.actor });
  assert.throws(() => applyUniformAction(manager, { type: "confirm", receiver: "x", receivedDate: "2026-11-05" }, "uni-mgr-fi", now, demo.people), { message: UNIFORM_ERRORS.action });
  assert.throws(() => applyUniformAction(byStage(demo, "completed"), { type: "confirm", receiver: "x", receivedDate: "2026-11-05" }, "uni-op-qa", now, demo.people), { message: UNIFORM_ERRORS.ended });
  const ga = byStage(demo, "gaStaff");
  assert.ok(uniformCanAct(ga, "uni-ga-1", demo.people));
  assert.ok(uniformCanAct(ga, "uni-ga-2", demo.people));
  assert.ok(!uniformCanAct(ga, "uni-mgr-fi", demo.people));
  assert.ok(!uniformCanAct(byStage(demo, "completed"), "uni-op-qa", demo.people));
});

test("new requests are validated and get sequential department codes", () => {
  const demo = buildUniformDemo();
  assert.throws(() => createUniformRequest(input({ type: "" }), "uni-op-qa", now, demo), { message: UNIFORM_ERRORS.required });
  assert.throws(() => createUniformRequest(input({ section: "9999" }), "uni-op-qa", now, demo), { message: UNIFORM_ERRORS.section });
  assert.throws(() => createUniformRequest(input(), "uni-mgr-qa", now, demo), { message: UNIFORM_ERRORS.section });
  assert.throws(() => createUniformRequest(input({ section: "3212H" }), "uni-op-fi", now, demo), { message: UNIFORM_ERRORS.supervisor });
  assert.throws(() => createUniformRequest(input({ section: "3212H", supervisor: "uni-mgr-fi" }), "uni-op-fi", now, demo), { message: UNIFORM_ERRORS.supervisor });
  assert.throws(() => createUniformRequest(input({ items: rows([["pants", ["", ""], ["L", "0"]]]) }), "uni-op-qa", now, demo), { message: UNIFORM_ERRORS.quantity });
  assert.throws(() => createUniformRequest(input({ items: rows([["pants", ["L", "1"], ["", "2"]]]) }), "uni-op-qa", now, demo), { message: UNIFORM_ERRORS.quantity });
  assert.throws(() => createUniformRequest(input({ items: rows([["pants", ["L", "1"], ["", ""]]]) }), "uni-op-qa", now, demo), { message: UNIFORM_ERRORS.items });
  assert.throws(() => createUniformRequest(input({ items: rows([["pants", ["", ""], ["L", "2"]]]) }), "uni-op-qa", now, demo), { message: UNIFORM_ERRORS.returned });
  assert.equal(createUniformRequest(input({ type: "new", items: rows([["pants", ["", ""], ["L", "2"]]]) }), "uni-op-qa", now, demo).stage, "manager");

  const first = createUniformRequest(input(), "uni-op-qa", now, demo);
  assert.equal(first.department, "QA");
  assert.equal(first.title, "Đổi quần");
  assert.equal(first.reason, "Rách gối");
  assert.deepEqual(plain(first.items), [{ key: "pants", returned: { size: "L", qty: "1" }, issued: { size: "L", qty: "2" } }]);
  const highest = Math.max(...demo.requests.filter((request) => request.code.startsWith("QA-2026-")).map((request) => Number(request.code.slice(8))));
  assert.equal(first.code, `QA-2026-${String(highest + 1).padStart(3, "0")}`);
  assert.equal(first.id, `uni-demo-${demo.requests.length + 1}`);
  const second = createUniformRequest(input(), "uni-op-qa", now, { ...demo, requests: [first, ...demo.requests] });
  assert.equal(second.code, `QA-2026-${String(highest + 2).padStart(3, "0")}`);
  assert.equal(createUniformRequest(input(), "uni-op-qa", "2027-01-02T00:00:00.000Z", demo).code, "QA-2027-001");
});

test("overdue and stale use the snapshot time and only apply to open requests", () => {
  const demo = buildUniformDemo();
  const old = demo.requests.find((request) => request.startedAt.startsWith("2025"));
  assert.ok(isUniformStale(old, demo.loadedAt));
  assert.ok(isUniformOverdue(old, demo.loadedAt));
  assert.ok(!isUniformStale({ ...old, lastActivityAt: "2026-10-01T00:00:00.000Z" }, demo.loadedAt));
  const completed = byStage(demo, "completed");
  assert.ok(!isUniformOverdue({ ...completed, dueAt: "2020-01-01T00:00:00.000Z" }, demo.loadedAt));
  assert.ok(!isUniformStale({ ...completed, lastActivityAt: "2020-01-01T00:00:00.000Z" }, demo.loadedAt));
});

test("dashboard summary separates the period cohort from the all-time backlog", () => {
  const demo = buildUniformDemo();
  const summary = summarizeUniform(demo, 12);
  assert.equal(summary.started, demo.requests.length - 1);
  assert.equal(summary.statuses.reduce((total, item) => total + item.value, 0), summary.started);
  assert.equal(summary.completed, 1);
  assert.equal(summary.rejected, 1);
  assert.equal(summary.overdue, 4);
  assert.equal(summary.completionRate, 100 / 9);
  assert.equal(summary.backlog, 8);
  assert.equal(summary.backlogOverdue, 5);
  assert.equal(summary.backlogStale, 1);
  assert.equal(summary.aging.reduce((total, item) => total + item.value, 0), summary.backlog);
  assert.equal(summary.aging[4].value, 1);
  assert.equal(summary.backlogStages.reduce((total, item) => total + item.value, 0), summary.backlog);
  assert.equal(summary.backlogStages.find((item) => item.stage === "confirm").value, 2);
  assert.equal(summary.monthly.reduce((total, month) => total + month.value, 0), summary.started);
  assert.ok(summary.attention.every((request) => isUniformOverdue(request, demo.loadedAt)));
  assert.equal(summary.types.reduce((total, item) => total + item.value, 0), summary.started);
  assert.equal(summary.types.find((item) => item.type === "oldForNew").value, 7);
  const pants = summary.items.find((item) => item.key === "pants");
  assert.deepEqual(plain(pants), { key: "pants", requests: 3, issued: 5, returned: 3 });
  const cap = summary.items.find((item) => item.key === "cap");
  assert.deepEqual(plain(cap), { key: "cap", requests: 1, issued: 1, returned: 0 }, "rejected requests do not count as demand");
  assert.equal(summary.approvers.length, 5);
  assert.ok(summary.approvers.some((approver) => approver.id === UNIFORM_GA_GROUP));

  const qa = summarizeUniform(demo, 12, "QA");
  assert.deepEqual(plain(qa.departments.map((unit) => unit.name)), ["QA"]);
  assert.equal(qa.departments[0].started, 4);
  assert.equal(qa.departments[0].backlog, 4);
});

test("department table sort keeps a stable name tie-break", () => {
  const departments = [
    { name: "QA", started: 3, completed: 0, pending: 3, overdue: 1, backlog: 3 },
    { name: "FI", started: 6, completed: 1, pending: 4, overdue: 1, backlog: 5 },
    { name: "TS", started: 3, completed: 0, pending: 0, overdue: 0, backlog: 0 },
  ];
  assert.deepEqual(plain(sortUniformDepartments(departments, null).map((row) => row.name)), ["QA", "FI", "TS"]);
  assert.deepEqual(plain(sortUniformDepartments(departments, { key: "started", direction: "asc" }).map((row) => row.name)), ["QA", "TS", "FI"]);
  assert.deepEqual(plain(sortUniformDepartments(departments, { key: "name", direction: "desc" }).map((row) => row.name)), ["TS", "QA", "FI"]);
});

test("every domain error has an English translation and labels cover every step, item and type", () => {
  for (const message of Object.values(UNIFORM_ERRORS)) {
    assert.equal(uniformErrorText(message, "vi"), message);
    assert.notEqual(uniformErrorText(message, "en"), message);
  }
  for (const locale of ["vi", "en"]) {
    const t = uniformRequestMessages[locale];
    for (const stage of [...UNIFORM_OPEN_STAGES, ...UNIFORM_LEGACY_STAGES, "completed", "rejected", "cancelled", "unknown"]) assert.ok(t.stages[stage], `${locale} ${stage}`);
    for (const stage of [...UNIFORM_OPEN_STAGES, ...UNIFORM_LEGACY_STAGES, "unknown"]) assert.ok(t.steps[stage], `${locale} step ${stage}`);
    for (const { key } of UNIFORM_ITEMS) assert.ok(t.items[key], `${locale} ${key}`);
    for (const type of ["new", "oldForNew", "newForNew", ""]) assert.ok(t.types[type], `${locale} type ${type}`);
    assert.equal(t.aging.length, 5);
  }
});
