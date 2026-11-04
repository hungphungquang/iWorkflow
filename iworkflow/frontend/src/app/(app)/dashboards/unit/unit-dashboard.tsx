"use client";

import Link from "next/link";
import { useState } from "react";
import { Donut, HBarChart } from "@/components/charts";
import { Avatar } from "@/components/fourm-ui";
import { Badge, Card, inputClass, PageHeader, StatCard, WireNote } from "@/components/ui";
import { sections, type FourMStepId, type SectionRunStatus } from "@/lib/fourm";
import { caseState, dueStatus, hoursBetween, openTasks, sectionLabel, type OpenTask } from "@/lib/fourm-case";
import { common, fmtHours, fmtNum, intlTag, stepNames, useLocale, useMessages, type Locale } from "@/lib/i18n";
import { managedSections, people, personName } from "@/lib/people";
import { useDb } from "@/lib/store";
import { CardLink, caseStepLabel, DueTag, Empty, median, stateColor, stateOrder, taskStepLabel } from "../dash-ui";

type RunLabel = SectionRunStatus | "notYet";

const vi = {
  title: "Đơn vị của tôi",
  description: "Việc đang mở, quá hạn và hồ sơ 4M của đơn vị – số liệu trực tiếp theo đồng hồ demo.",
  unit: "Đơn vị",
  kpiOpen: "Việc đang mở của đơn vị",
  kpiOpenHint: (people: string) => `${people} người đang giữ việc`,
  kpiOverdue: "Quá hạn",
  kpiOverdueHint: (soon: string) => `${soon} việc sắp đến hạn`,
  kpiRunning: "Hồ sơ đơn vị đề nghị đang chạy",
  kpiRunningHint: (total: string) => `trên tổng ${total} hồ sơ của đơn vị`,
  kpiAge: "Tuổi việc (trung vị)",
  kpiAgeHint: (avg: string) => `trung bình ${avg}`,
  byPerson: "Việc đang mở theo người",
  byStep: "Việc theo bước",
  overdueTable: "Việc quá hạn của đơn vị",
  colAssignee: "Người xử lý",
  colCase: "Hồ sơ",
  colStep: "Bước",
  colLate: "Quá hạn",
  noOverdue: "Đơn vị không có việc quá hạn.",
  noTasks: "Đơn vị không có việc đang mở.",
  byState: "Hồ sơ đơn vị đề nghị theo trạng thái",
  related: "Phòng tôi là phòng liên quan",
  relatedEmpty: "Không có hồ sơ đang chạy nào cần đơn vị thẩm định.",
  run: {
    pending: "Chờ TP thẩm định",
    staff: "Cán bộ đang kiểm tra",
    recheck: "TP duyệt lại",
    approved: "Đã thông qua",
    update: "Yêu cầu chỉnh sửa",
    reject: "Từ chối",
    cancelled: "Vòng thẩm định bị hủy",
    notYet: "Chưa đến lượt",
  } as Record<RunLabel, string>,
};

const M = {
  vi,
  en: {
    title: "My unit",
    description: "Open and overdue work plus 4M cases of the unit – live figures against the demo clock.",
    unit: "Unit",
    kpiOpen: "Open tasks in unit",
    kpiOpenHint: (people) => `held by ${people} people`,
    kpiOverdue: "Overdue",
    kpiOverdueHint: (soon) => `${soon} due soon`,
    kpiRunning: "Running requests from unit",
    kpiRunningHint: (total) => `of ${total} unit requests`,
    kpiAge: "Task age (median)",
    kpiAgeHint: (avg) => `average ${avg}`,
    byPerson: "Open tasks by person",
    byStep: "Tasks by step",
    overdueTable: "Overdue tasks in unit",
    colAssignee: "Assignee",
    colCase: "Case",
    colStep: "Step",
    colLate: "Overdue by",
    noOverdue: "No overdue tasks in this unit.",
    noTasks: "No open tasks in this unit.",
    byState: "Unit requests by state",
    related: "Cases where my unit is a related section",
    relatedEmpty: "No running case needs this unit's review.",
    run: {
      pending: "Awaiting manager review",
      staff: "Staff checking",
      recheck: "Manager re-check",
      approved: "Approved",
      update: "Changes requested",
      reject: "Rejected",
      cancelled: "Review round cancelled",
      notYet: "Not reached yet",
    },
  },
} satisfies Record<Locale, typeof vi>;

const runTone: Record<RunLabel, "amber" | "blue" | "green" | "red" | "gray" | "violet"> = {
  pending: "amber",
  staff: "blue",
  recheck: "violet",
  approved: "green",
  update: "amber",
  reject: "red",
  cancelled: "gray",
  notYet: "gray",
};

const stepOrder: FourMStepId[] = ["create", "mgr", "gm", "relsec", "gd", "result", "rmgr", "rgm", "rrelsec", "rgd", "review"];

export function UnitDashboard() {
  const db = useDb();
  const locale = useLocale();
  const t = useMessages(M);
  const c = common[locale];
  const now = db.now;
  const n = (x: number) => fmtNum(x, locale);

  const meSection = people.find((p) => p.id === db.me)?.section ?? sections[0].code;
  const defaultUnit = managedSections(db.me)[0] ?? (sections.some((s) => s.code === meSection) ? meSection : sections[0].code);
  const [picked, setPicked] = useState<string | null>(null);
  const unit = picked ?? defaultUnit;

  const members = new Set(people.filter((p) => p.section === unit).map((p) => p.id));
  const caseByCode = new Map(db.cases.map((x) => [x.code, x]));
  const unitTasks = db.cases
    .flatMap(openTasks)
    .filter((x) => members.has(x.assignee) || ((x.kind === "section" || x.kind === "recheck") && x.section === unit));
  const overdue = unitTasks.filter((x) => dueStatus(x.due, now) === "overdue").sort((a, b) => a.due.localeCompare(b.due));
  const dueSoon = unitTasks.filter((x) => dueStatus(x.due, now) === "dueSoon").length;
  const ages = unitTasks.map((x) => hoursBetween(x.since, now));
  const avgAge = ages.length ? ages.reduce((s, x) => s + x, 0) / ages.length : 0;

  const unitCases = db.cases.filter((x) => x.section === unit);
  const running = unitCases.filter((x) => caseState(x) === "running").length;

  const byPerson = [...unitTasks.reduce((m, x) => m.set(x.assignee, [...(m.get(x.assignee) ?? []), x]), new Map<string, OpenTask[]>())]
    .map(([id, list]) => ({
      label: personName(id),
      value: list.length,
      href: `/4m/cases?view=all&assignee=${id}`,
      tone: list.some((x) => dueStatus(x.due, now) === "overdue") ? ("red" as const) : ("blue" as const),
    }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label));

  const byStep = stepOrder
    .map((step) => {
      const list = unitTasks.filter((x) => x.step === step);
      const scope = step === "relsec" || step === "rrelsec" ? `rsec=${unit}` : `sec=${unit}`;
      return {
        label: stepNames[locale][step],
        value: list.length,
        href: `/4m/cases?view=all&step=${step}&${scope}`,
        tone: list.some((x) => dueStatus(x.due, now) === "overdue") ? ("red" as const) : ("blue" as const),
      };
    })
    .filter((x) => x.value > 0);

  const stateSegments = stateOrder.map((s) => ({
    label: c.state[s],
    value: unitCases.filter((x) => caseState(x) === s).length,
    color: stateColor[s],
    href: `/4m/cases?view=all&sec=${unit}&state=${s}`,
  }));

  const related = db.cases
    .filter((x) => caseState(x) === "running" && x.rows.some((r) => r.code === unit))
    .map((x) => ({
      c: x,
      status: (x.sim.runs.find((r) => r.code === unit)?.status ?? "notYet") as RunLabel,
      task: unitTasks.filter((k) => k.code === x.code && k.section === unit).sort((a, b) => a.due.localeCompare(b.due))[0],
    }))
    .sort((a, b) => Number(!a.task) - Number(!b.task) || (a.task && b.task ? a.task.due.localeCompare(b.task.due) : 0) || b.c.updatedAt.localeCompare(a.c.updatedAt));

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <span className="text-xs font-medium">{t.unit}</span>
            <select className={`${inputClass} w-64`} value={unit} onChange={(e) => setPicked(e.target.value)}>
              {sections.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.code} · {s.name}
                </option>
              ))}
            </select>
          </label>
        }
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label={t.kpiOpen} value={n(unitTasks.length)} hint={t.kpiOpenHint(n(byPerson.length))} />
        <StatCard label={t.kpiOverdue} value={n(overdue.length)} hint={t.kpiOverdueHint(n(dueSoon))} tone="red" />
        <StatCard label={t.kpiRunning} value={n(running)} hint={t.kpiRunningHint(n(unitCases.length))} tone="amber" />
        <StatCard label={t.kpiAge} value={ages.length ? fmtHours(median(ages), locale) : "–"} hint={ages.length ? t.kpiAgeHint(fmtHours(avgAge, locale)) : undefined} tone="green" />
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-3">
        <Card title={t.byPerson} actions={<CardLink href={`/4m/cases?view=all&rsec=${unit}`}>{c.viewAll}</CardLink>}>
          {byPerson.length ? <HBarChart data={byPerson} locale={intlTag(locale)} labelWidth="9rem" /> : <Empty>{t.noTasks}</Empty>}
        </Card>

        <Card title={t.byStep}>{byStep.length ? <HBarChart data={byStep} locale={intlTag(locale)} labelWidth="11rem" /> : <Empty>{t.noTasks}</Empty>}</Card>

        <Card title={t.byState}>
          <Donut segments={stateSegments} centerLabel={c.cases} locale={intlTag(locale)} />
        </Card>

        <Card title={t.overdueTable} className="xl:col-span-2" actions={<CardLink href={`/4m/cases?view=all&due=overdue&rsec=${unit}`}>{c.viewAll}</CardLink>}>
          {overdue.length === 0 ? (
            <Empty>{t.noOverdue}</Empty>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 text-left text-xs text-slate-500">
                    <th className="py-2 pr-3 font-medium">{t.colAssignee}</th>
                    <th className="py-2 pr-3 font-medium">{t.colCase}</th>
                    <th className="py-2 pr-3 font-medium">{t.colStep}</th>
                    <th className="py-2 text-right font-medium">{t.colLate}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {overdue.map((x) => (
                    <tr key={x.id} className="align-top">
                      <td className="py-2 pr-3">
                        <span className="flex items-center gap-2 whitespace-nowrap">
                          <Avatar id={x.assignee} />
                          {personName(x.assignee)}
                        </span>
                      </td>
                      <td className="max-w-xs py-2 pr-3">
                        <Link href={`/4m/cases/${x.code}`} className="block hover:underline">
                          <span className="font-mono text-xs text-blue-700">{x.code}</span>
                          <span className="block truncate text-slate-700">{caseByCode.get(x.code)?.title}</span>
                        </Link>
                      </td>
                      <td className="py-2 pr-3 text-xs text-slate-600">{taskStepLabel(x, locale)}</td>
                      <td className="whitespace-nowrap py-2 text-right font-medium text-red-600">{fmtHours(hoursBetween(x.due, now), locale)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title={t.related} actions={<CardLink href={`/4m/cases?view=all&state=running&rsec=${unit}`}>{c.viewAll}</CardLink>}>
          {related.length === 0 ? (
            <Empty>{t.relatedEmpty}</Empty>
          ) : (
            <ul className="divide-y divide-slate-100">
              {related.map(({ c: x, status, task }) => (
                <li key={x.code}>
                  <Link href={`/4m/cases/${x.code}`} className="block rounded px-1 py-2.5 hover:bg-slate-50">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-slate-500">{x.code}</span>
                      <Badge tone={runTone[status]}>{t.run[status]}</Badge>
                      {task && (
                        <span className="ml-auto">
                          <DueTag due={task.due} now={now} />
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-sm font-medium text-slate-800">{x.title}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {sectionLabel(x.section)} · {caseStepLabel(x, locale)}
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
          Đơn vị mặc định = đơn vị bạn là người đại diện (TP/GM), nếu không có thì đơn vị của bạn. Việc của đơn vị = việc giao cho thành viên đơn vị + việc thẩm định phòng liên quan của đơn vị. Bấm vào cột/nhóm để mở danh sách hồ sơ 4M đã lọc sẵn. Trạng thái “phòng liên quan” lấy từ vòng thẩm định hiện tại của hồ sơ.
        </WireNote>
      </div>
    </>
  );
}
