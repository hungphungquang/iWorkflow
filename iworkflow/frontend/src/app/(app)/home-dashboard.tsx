"use client";

import Link from "next/link";
import { Donut } from "@/components/charts";
import { Avatar, Stepper, VersionTag } from "@/components/fourm-ui";
import { Badge, Card, LinkButton, PageHeader, StatCard, WireNote } from "@/components/ui";
import { caseState, dueStatus, hoursBetween, openTasks, participants, PROCESS_KEY, PROCESS_NAME, sharedWith, type DueStatus, type FourMCase } from "@/lib/fourm-case";
import { common, fmtDayMonth, fmtLongDate, fmtNum, intlTag, useLocale, useMessages, type Locale } from "@/lib/i18n";
import { processByKey, tasks as legacyTasks } from "@/lib/mock";
import { personName } from "@/lib/people";
import { useDb, useMe } from "@/lib/store";
import { CardLink, caseStepLabel, DueTag, dueColor, dueOrder, dueRank, Empty, StateTag, taskStepLabel } from "./dashboards/dash-ui";

const vi = {
  hello: (name: string) => `Xin chào, ${name}`,
  summary: (open: string, overdue: string) => `Bạn có ${open} việc cần xử lý, ${overdue} việc đã quá hạn`,
  new4m: "+ Tạo yêu cầu 4M",
  myWork: "Việc của tôi",
  kpiOpen: "Việc đang chờ tôi",
  kpiOpenHint: (n4m: string, other: string) => `${n4m} việc 4M · ${other} việc quy trình khác`,
  kpiOverdue: "Quá hạn",
  kpiOverdueHint: (soon: string) => `${soon} việc sắp đến hạn (< 24 giờ)`,
  kpiRunning: "Hồ sơ tôi tạo đang chạy",
  kpiRunningHint: (total: string) => `trên tổng ${total} hồ sơ tôi tạo`,
  kpiEnded: "Kết thúc 30 ngày qua",
  kpiEndedHint: "hồ sơ tôi tham gia",
  todo: "Việc cần xử lý",
  todoEmpty: "Không có việc nào đang chờ bạn.",
  inGroup: (n: string) => `${n} việc`,
  dueOn: (d: string) => `Hạn ${d}`,
  myCases: "Hồ sơ tôi tạo",
  myCasesEmpty: "Bạn chưa tạo hồ sơ 4M nào.",
  shared: "Được chia sẻ / đang theo dõi",
  sharedEmpty: "Chưa có hồ sơ nào được chia sẻ với bạn.",
  sharedTag: "Được chia sẻ",
  watchTag: "Đang theo dõi",
  byDue: "Việc 4M của tôi theo hạn",
  requester: "Người đề nghị",
};

const M = {
  vi,
  en: {
    hello: (name) => `Hello, ${name}`,
    summary: (open, overdue) => `You have ${open} tasks to handle, ${overdue} overdue`,
    new4m: "+ New 4M request",
    myWork: "My tasks",
    kpiOpen: "Tasks waiting for me",
    kpiOpenHint: (n4m, other) => `${n4m} 4M tasks · ${other} other-process tasks`,
    kpiOverdue: "Overdue",
    kpiOverdueHint: (soon) => `${soon} due soon (< 24 h)`,
    kpiRunning: "My running requests",
    kpiRunningHint: (total) => `of ${total} requests I created`,
    kpiEnded: "Ended in last 30 days",
    kpiEndedHint: "cases I took part in",
    todo: "To do",
    todoEmpty: "Nothing is waiting for you.",
    inGroup: (n) => (n === "1" ? "1 task" : `${n} tasks`),
    dueOn: (d) => `Due ${d}`,
    myCases: "My requests",
    myCasesEmpty: "You have not created any 4M request.",
    shared: "Shared with me / following",
    sharedEmpty: "No cases shared with you yet.",
    sharedTag: "Shared",
    watchTag: "Following",
    byDue: "My 4M tasks by due status",
    requester: "Requester",
  },
} satisfies Record<Locale, typeof vi>;

type Row = { key: string; processKey: string; processName: string; code: string; title: string; step: string; version?: number; due: string; status: DueStatus; href: string };

// Legacy mock tasks only carry a date; treat it as due at the start of that day (Vietnam time).
const legacyDue = (d: string) => new Date(`${d}T00:00:00+07:00`).toISOString();

const byRunningThenRecent = (a: FourMCase, b: FourMCase) =>
  Number(caseState(b) === "running") - Number(caseState(a) === "running") || b.updatedAt.localeCompare(a.updatedAt);

export function HomeDashboard() {
  const db = useDb();
  const me = useMe();
  const locale = useLocale();
  const t = useMessages(M);
  const c = common[locale];
  const now = db.now;
  const n = (x: number) => fmtNum(x, locale);

  const caseByCode = new Map(db.cases.map((x) => [x.code, x]));
  const my4m = db.cases.flatMap(openTasks).filter((x) => x.assignee === db.me);
  // Legacy inbox items in mock.ts belong to Nguyễn An; 4M now comes from the live store.
  const myLegacy = db.me === "an" ? legacyTasks.filter((x) => x.assignee === "Bạn" && x.processKey !== PROCESS_KEY) : [];

  const rows: Row[] = [
    ...my4m.map((x) => {
      const k = caseByCode.get(x.code)!;
      return {
        key: x.id,
        processKey: PROCESS_KEY,
        processName: PROCESS_NAME,
        code: x.code,
        title: k.title,
        step: taskStepLabel(x, locale),
        version: k.version,
        due: x.due,
        status: dueStatus(x.due, now),
        href: `/4m/cases/${x.code}`,
      };
    }),
    ...myLegacy.map((x) => {
      const due = legacyDue(x.due);
      const p = processByKey(x.processKey);
      return {
        key: x.id,
        processKey: x.processKey,
        processName: p?.name ?? x.processKey,
        code: x.code,
        title: x.title,
        step: x.step,
        version: p?.version,
        due,
        status: dueStatus(due, now),
        href: `/tasks/${x.id}`,
      };
    }),
  ].sort((a, b) => dueRank[a.status] - dueRank[b.status] || a.due.localeCompare(b.due));

  // Group by process key (not key+version) so a new deployment never splits a user's inbox.
  const groups = [...rows.reduce((m, r) => m.set(r.processKey, [...(m.get(r.processKey) ?? []), r]), new Map<string, Row[]>()).values()].sort(
    (a, b) => dueRank[a[0].status] - dueRank[b[0].status] || b.length - a.length,
  );

  const overdue = rows.filter((r) => r.status === "overdue").length;
  const dueSoon = rows.filter((r) => r.status === "dueSoon").length;
  const mine = db.cases.filter((x) => x.requester === db.me).sort(byRunningThenRecent);
  const myRunning = mine.filter((x) => caseState(x) === "running").length;
  const ended30 = db.cases.filter((x) => x.endedAt && hoursBetween(x.endedAt, now) <= 30 * 24 && participants(x).includes(db.me)).length;
  const shared = db.cases.filter((x) => x.requester !== db.me && (sharedWith(x, db.me) || x.watchers.includes(db.me))).sort(byRunningThenRecent);

  const dueSegments = dueOrder.map((s) => ({
    label: c.due[s],
    value: my4m.filter((x) => dueStatus(x.due, now) === s).length,
    color: dueColor[s],
    href: `/4m/cases?view=mine&due=${s}`,
  }));

  return (
    <>
      <PageHeader
        title={t.hello(me.name)}
        description={`${fmtLongDate(now, locale)} · ${t.summary(n(rows.length), n(overdue))}`}
        actions={
          <>
            <LinkButton href="/4m/new" variant="primary">
              {t.new4m}
            </LinkButton>
            <LinkButton href="/4m/cases?view=mine">{t.myWork}</LinkButton>
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t.kpiOpen} value={n(rows.length)} hint={t.kpiOpenHint(n(my4m.length), n(myLegacy.length))} />
        <StatCard label={t.kpiOverdue} value={n(overdue)} hint={t.kpiOverdueHint(n(dueSoon))} tone="red" />
        <StatCard label={t.kpiRunning} value={n(myRunning)} hint={t.kpiRunningHint(n(mine.length))} tone="amber" />
        <StatCard label={t.kpiEnded} value={n(ended30)} hint={t.kpiEndedHint} tone="green" />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card title={t.todo} className="xl:col-span-2" actions={<CardLink href="/4m/cases?view=mine">{c.viewAll}</CardLink>}>
          {groups.length === 0 ? (
            <Empty>{t.todoEmpty}</Empty>
          ) : (
            <div className="space-y-4">
              {groups.map((g) => (
                <div key={g[0].processKey}>
                  <p className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {g[0].processName}
                    <Badge>{t.inGroup(n(g.length))}</Badge>
                  </p>
                  <ul className="divide-y divide-slate-100">
                    {g.map((r) => (
                      <li key={r.key}>
                        <Link href={r.href} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded px-1 py-2.5 hover:bg-slate-50">
                          <span className="w-28 shrink-0 font-mono text-xs text-slate-500">{r.code}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-slate-800">{r.title}</span>
                            <span className="flex items-center gap-1.5 truncate text-xs text-slate-500">
                              {r.version !== undefined && <VersionTag v={r.version} />}
                              <span className="truncate">{r.step}</span>
                            </span>
                          </span>
                          <DueTag due={r.due} now={now} />
                          <span className="w-20 text-right text-xs text-slate-500">{t.dueOn(fmtDayMonth(r.due, locale))}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card title={t.byDue}>
          <Donut segments={dueSegments} centerLabel={c.tasks} locale={intlTag(locale)} />
        </Card>

        <Card title={t.myCases} className="xl:col-span-2" actions={<CardLink href="/4m/cases?view=running">{c.viewAll}</CardLink>}>
          {mine.length === 0 ? (
            <Empty>{t.myCasesEmpty}</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {mine.map((x) => (
                <li key={x.code}>
                  <Link href={`/4m/cases/${x.code}`} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded px-1 py-2.5 hover:bg-slate-50">
                    <span className="w-28 shrink-0 font-mono text-xs text-slate-500">{x.code}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-slate-800">{x.title}</span>
                      <span className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        <Stepper c={x} compact />
                        <span className="truncate">{caseStepLabel(x, locale)}</span>
                      </span>
                    </span>
                    <StateTag state={caseState(x)} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title={t.shared} actions={<CardLink href="/4m/cases?view=shared">{c.viewAll}</CardLink>}>
          {shared.length === 0 ? (
            <Empty>{t.sharedEmpty}</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {shared.map((x) => (
                <li key={x.code}>
                  <Link href={`/4m/cases/${x.code}`} className="block rounded px-1 py-2.5 hover:bg-slate-50">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-xs text-slate-500">{x.code}</span>
                      <Badge tone={sharedWith(x, db.me) ? "violet" : "gray"}>{sharedWith(x, db.me) ? t.sharedTag : t.watchTag}</Badge>
                      <span className="ml-auto">
                        <StateTag state={caseState(x)} />
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-sm font-medium text-slate-800">{x.title}</span>
                    <span className="mt-1 flex items-center gap-1.5 text-xs text-slate-500">
                      <Avatar id={x.requester} />
                      <span className="truncate" title={t.requester}>
                        {personName(x.requester)}
                      </span>
                      <span className="text-slate-300">·</span>
                      <span className="truncate">{caseStepLabel(x, locale)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      <div className="mt-6">
        <WireNote>
          Giai đoạn A: bố cục dashboard cố định cho mọi người dùng; tùy biến widget (thêm/bớt/sắp xếp) làm ở giai đoạn C. “Việc cần xử lý” gộp nhóm theo <b>process key</b> (tên quy trình), không theo phiên bản – deploy phiên bản mới không tách hộp việc; phiên bản chỉ hiển thị bằng nhãn nhỏ v12/v11 trên từng dòng. Việc của các quy trình khác (dữ liệu mẫu) chỉ hiện khi đóng vai Nguyễn An.
        </WireNote>
      </div>
    </>
  );
}
