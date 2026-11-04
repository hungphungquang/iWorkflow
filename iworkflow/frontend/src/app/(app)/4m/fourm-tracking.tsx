"use client";

import Link from "next/link";
import { Donut, HBarChart } from "@/components/charts";
import { Card, LinkButton, PageHeader, StatCard, WireNote } from "@/components/ui";
import { classOptions, sections, stats, type FourMStepId, type SectionRunStatus } from "@/lib/fourm";
import { caseState, dueStatus, hoursBetween, openTasks, sectionShort, type FourMCase, type OpenTask } from "@/lib/fourm-case";
import { common, fmtNum, intlTag, stepNames, useLocale, useMessages, type Locale } from "@/lib/i18n";
import { personName } from "@/lib/people";
import { useDb } from "@/lib/store";
import { CardLink, DueTag, Empty, median, stateColor, stateOrder, taskStepLabel } from "../dashboards/dash-ui";

const vi = {
  title: "Theo dõi 4M",
  description: "Toàn cảnh quy trình Before 4M Change: hồ sơ đang chạy, điểm nghẽn theo bước và phòng ban, việc quá hạn.",
  newReq: "Tạo yêu cầu 4M",
  list: "Danh sách hồ sơ",
  kpiRunning: "Hồ sơ đang chạy",
  kpiRunningHint: (b: number, a: number) => `${b} trước thay đổi · ${a} sau thay đổi`,
  kpiTasks: "Việc đang mở",
  kpiTasksHint: (n: number) => `${n} người đang giữ việc`,
  kpiOverdue: "Việc quá hạn",
  kpiOverdueHint: (n: number) => `trên ${n} hồ sơ`,
  kpiCycle: "Thời gian hoàn tất (trung vị)",
  kpiCycleHint: (n: number) => `${n} hồ sơ đã hoàn tất`,
  days: (d: string) => `${d} ngày`,
  kpiProblem: "Kết quả có vấn đề",
  kpiProblemHint: "Have a problem = Y",
  funnel: "Hồ sơ đang chạy theo bước",
  noRunning: "Không có hồ sơ đang chạy.",
  states: "Hồ sơ theo trạng thái",
  heat: "Phòng ban liên quan × tình trạng (vòng hiện tại)",
  heatSection: "Phòng ban",
  heatCols: { pending: "Chờ TP", staff: "Cán bộ KT", recheck: "TP duyệt lại", approved: "Đã duyệt", overdue: "Quá hạn", total: "Hồ sơ liên quan" },
  heatHint: "Bấm ô để mở danh sách hồ sơ của phòng đó.",
  overdueBy: "Việc quá hạn theo phòng ban đang giữ",
  noOverdue: "Không có việc quá hạn.",
  classes: "Phân loại 4M (hồ sơ trên hệ mới)",
  worst: "Việc quá hạn lâu nhất",
  colCase: "Hồ sơ",
  colStep: "Bước",
  colWho: "Người giữ",
  colDue: "Hạn",
  history: "Thời gian xử lý thực tế trên hệ cũ (iw_prod, 2019–2026)",
  colHStep: "Bước",
  colDone: "Số việc",
  colMedian: "Trung vị",
  colP90: "P90",
  colLate: "% trễ",
  historyHint: "Điểm nghẽn lớn nhất là bước Nhập kết quả (trung vị 33 ngày) và phòng liên quan (P90 ~28 ngày) – đây là lý do dashboard ưu tiên hiển thị việc quá hạn theo phòng.",
  topSections: "Phòng ban nhận nhiều việc thẩm định nhất (hệ cũ)",
  wire: "Phản hồi #5 (tùy chỉnh widget) được xếp vào giai đoạn C: giai đoạn A dùng bố cục cố định, mọi ô số liệu đều bấm được để mở danh sách đã lọc. Phản hồi #7: dashboard và menu đã có tiếng Việt / English (nút VI·EN trên thanh trên cùng).",
};

const M: Record<Locale, typeof vi> = {
  vi,
  en: {
    title: "4M tracking",
    description: "Before 4M Change at a glance: running cases, bottlenecks by step and section, overdue work.",
    newReq: "New 4M request",
    list: "Case list",
    kpiRunning: "Running cases",
    kpiRunningHint: (b, a) => `${b} before change · ${a} after change`,
    kpiTasks: "Open tasks",
    kpiTasksHint: (n) => `held by ${n} people`,
    kpiOverdue: "Overdue tasks",
    kpiOverdueHint: (n) => `across ${n} cases`,
    kpiCycle: "Time to complete (median)",
    kpiCycleHint: (n) => `${n} completed cases`,
    days: (d) => `${d} days`,
    kpiProblem: "Results with problems",
    kpiProblemHint: "Have a problem = Y",
    funnel: "Running cases by step",
    noRunning: "No running cases.",
    states: "Cases by state",
    heat: "Related sections × status (current round)",
    heatSection: "Section",
    heatCols: { pending: "Manager", staff: "Staff check", recheck: "Re-check", approved: "Approved", overdue: "Overdue", total: "Cases involved" },
    heatHint: "Click a cell to open that section's cases.",
    overdueBy: "Overdue tasks by holding section",
    noOverdue: "No overdue tasks.",
    classes: "4M classes (cases on the new system)",
    worst: "Longest overdue tasks",
    colCase: "Case",
    colStep: "Step",
    colWho: "Holder",
    colDue: "Due",
    history: "Actual handling time on the legacy system (iw_prod, 2019–2026)",
    colHStep: "Step",
    colDone: "Tasks",
    colMedian: "Median",
    colP90: "P90",
    colLate: "% late",
    historyHint: "The biggest bottlenecks are Input result (median 33 days) and related sections (P90 ~28 days) – which is why this dashboard highlights overdue work by section.",
    topSections: "Sections receiving the most review tasks (legacy)",
    wire: "Feedback #5 (customisable widgets) is scheduled for phase C: phase A uses a fixed layout where every figure drills down to a filtered list. Feedback #7: dashboards and navigation now support Tiếng Việt / English (VI·EN switch in the top bar).",
  },
};

const ORDER: FourMStepId[] = ["create", "mgr", "gm", "relsec", "gd", "result", "rmgr", "rgm", "rrelsec", "rgd", "review"];
const HEAT: (SectionRunStatus | "overdue" | "total")[] = ["pending", "staff", "recheck", "approved", "overdue", "total"];
const heatTone = (k: string, n: number) => {
  if (!n) return "bg-white text-slate-300";
  if (k === "overdue") return n > 1 ? "bg-red-500 text-white" : "bg-red-100 text-red-800";
  if (k === "approved") return "bg-emerald-50 text-emerald-800";
  if (k === "total") return "bg-slate-50 text-slate-700";
  return n > 1 ? "bg-blue-200 text-blue-900" : "bg-blue-50 text-blue-800";
};
const hfmt = (h: number, l: Locale) => (h < 24 ? `${fmtNum(h, l, 0)} h` : `${fmtNum(h / 24, l, 1)} ${l === "vi" ? "ngày" : "d"}`);

export function FourMTracking() {
  const locale = useLocale();
  const t = useMessages(M);
  const c0 = common[locale];
  const { cases, now } = useDb();
  const tag = intlTag(locale);

  const running = cases.filter((c) => caseState(c) === "running");
  const tasks: (OpenTask & { c: FourMCase })[] = running.flatMap((c) => openTasks(c).map((x) => ({ ...x, c })));
  const overdue = tasks.filter((x) => dueStatus(x.due, now) === "overdue");
  const completed = cases.filter((c) => caseState(c) === "completed" && c.endedAt);
  const cycle = median(completed.map((c) => hoursBetween(c.createdAt, c.endedAt!) / 24));
  const after = running.filter((c) => c.sim.step && ORDER.indexOf(c.sim.step) >= ORDER.indexOf("result")).length;

  const funnel = ORDER.filter((s) => running.some((c) => c.sim.step === s) || ["mgr", "gm", "relsec", "result", "rrelsec"].includes(s)).map((s) => ({
    label: stepNames[locale][s],
    value: running.filter((c) => c.sim.step === s).length,
    href: `/4m/cases?view=all&state=running&step=${s}`,
    tone: (overdue.some((x) => x.step === s) ? "red" : "blue") as "red" | "blue",
  }));

  const stateSegs = stateOrder.map((s) => ({ label: c0.state[s], value: cases.filter((c) => caseState(c) === s).length, color: stateColor[s], href: `/4m/cases?view=all&state=${s}` }));

  const involved = sections.filter((s) => running.some((c) => c.rows.some((r) => r.code === s.code)));
  const heat = involved.map((s) => {
    const runs = running.flatMap((c) => c.sim.runs.filter((r) => r.code === s.code));
    const row: Record<string, number> = Object.fromEntries(HEAT.map((k) => [k, 0]));
    runs.forEach((r) => (row[r.status] = (row[r.status] ?? 0) + 1));
    row.overdue = overdue.filter((x) => x.section === s.code).length;
    row.total = running.filter((c) => c.rows.some((r) => r.code === s.code)).length;
    return { s, row };
  });

  const bySection = new Map<string, number>();
  overdue.forEach((x) => {
    const sec = x.section ?? x.c.section;
    bySection.set(sec, (bySection.get(sec) ?? 0) + 1);
  });
  const overdueBars = [...bySection.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([sec, n]) => ({ label: `${sec} ${sectionShort(sec)}`, value: n, tone: "red" as const, href: `/4m/cases?view=all&due=overdue&rsec=${sec}` }));

  const classBars = classOptions.map((o) => ({ label: o.label, value: cases.filter((c) => c.classes.includes(o.code)).length, href: `/4m/cases?view=all&cls=${o.code}`, tone: "violet" as const }));
  const worst = [...overdue].sort((a, b) => a.due.localeCompare(b.due)).slice(0, 8);

  return (
    <>
      <PageHeader
        title={t.title}
        description={t.description}
        actions={
          <>
            <LinkButton href="/4m/cases?view=all">{t.list}</LinkButton>
            <LinkButton href="/4m/new" variant="primary">
              {t.newReq}
            </LinkButton>
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <Link href="/4m/cases?view=all&state=running">
          <StatCard label={t.kpiRunning} value={fmtNum(running.length, locale)} hint={t.kpiRunningHint(running.length - after, after)} />
        </Link>
        <Link href="/4m/cases?view=all&state=running">
          <StatCard label={t.kpiTasks} value={fmtNum(tasks.length, locale)} hint={t.kpiTasksHint(new Set(tasks.map((x) => x.assignee)).size)} />
        </Link>
        <Link href="/4m/cases?view=all&due=overdue">
          <StatCard label={t.kpiOverdue} value={fmtNum(overdue.length, locale)} hint={t.kpiOverdueHint(new Set(overdue.map((x) => x.code)).size)} tone={overdue.length ? "red" : "green"} />
        </Link>
        <Link href="/4m/cases?view=all&state=completed">
          <StatCard label={t.kpiCycle} value={t.days(fmtNum(cycle, locale, 1))} hint={t.kpiCycleHint(completed.length)} />
        </Link>
        <StatCard label={t.kpiProblem} value={fmtNum(cases.filter((c) => c.result.haveProb === "Y").length, locale)} hint={t.kpiProblemHint} tone="amber" />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card title={t.funnel} className="xl:col-span-2" actions={<CardLink href="/4m/cases?view=all&state=running">{c0.viewAll}</CardLink>}>
          {running.length ? <HBarChart data={funnel} locale={tag} labelWidth="13rem" /> : <Empty>{t.noRunning}</Empty>}
        </Card>
        <Card title={t.states}>
          <Donut segments={stateSegs} centerLabel={c0.cases} locale={tag} />
        </Card>

        <Card title={t.heat} className="xl:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="text-slate-500">
                <tr>
                  <th className="px-2 py-1.5 text-left font-medium">{t.heatSection}</th>
                  {HEAT.map((k) => (
                    <th key={k} className="px-1 py-1.5 text-center font-medium">
                      {t.heatCols[k as keyof typeof t.heatCols]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {heat.map(({ s, row }) => (
                  <tr key={s.code}>
                    <td className="whitespace-nowrap px-2 py-1 text-slate-700">
                      <span className="font-mono text-slate-400">{s.code}</span> {sectionShort(s.code)}
                    </td>
                    {HEAT.map((k) => (
                      <td key={k} className="p-0.5">
                        <Link
                          href={`/4m/cases?view=${k === "approved" || k === "total" ? "all" : "running"}&rsec=${s.code}${k === "overdue" ? "&due=overdue" : ""}`}
                          className={`block rounded px-2 py-1.5 text-center font-semibold tabular-nums hover:ring-2 hover:ring-blue-300 ${heatTone(k, row[k])}`}
                        >
                          {row[k] || "·"}
                        </Link>
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-slate-400">{t.heatHint}</p>
        </Card>
        <Card title={t.overdueBy}>{overdueBars.length ? <HBarChart data={overdueBars} locale={tag} labelWidth="8rem" /> : <Empty>{t.noOverdue}</Empty>}</Card>

        <Card title={t.worst} className="xl:col-span-2" actions={<CardLink href="/4m/cases?view=all&due=overdue&sort=due">{c0.viewAll}</CardLink>}>
          {worst.length ? (
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-1.5 pr-2 font-medium">{t.colCase}</th>
                  <th className="py-1.5 pr-2 font-medium">{t.colStep}</th>
                  <th className="py-1.5 pr-2 font-medium">{t.colWho}</th>
                  <th className="py-1.5 font-medium">{t.colDue}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {worst.map((x) => (
                  <tr key={x.id}>
                    <td className="max-w-[16rem] py-1.5 pr-2">
                      <Link href={`/4m/cases/${x.code}`} className="block truncate text-slate-800 hover:text-blue-700">
                        <span className="font-mono font-semibold">{x.code}</span> · {x.c.title}
                      </Link>
                    </td>
                    <td className="py-1.5 pr-2 text-slate-600">{taskStepLabel(x, locale)}</td>
                    <td className="py-1.5 pr-2 text-slate-600">{personName(x.assignee)}</td>
                    <td className="py-1.5">
                      <DueTag due={x.due} now={now} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <Empty>{t.noOverdue}</Empty>
          )}
        </Card>
        <Card title={t.classes}>
          <HBarChart data={classBars} locale={tag} labelWidth="8rem" />
        </Card>

        <Card title={t.history} className="xl:col-span-2">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="border-b border-slate-200 text-slate-500">
                <tr>
                  <th className="py-1.5 pr-2 font-medium">{t.colHStep}</th>
                  <th className="py-1.5 pr-2 text-right font-medium">{t.colDone}</th>
                  <th className="py-1.5 pr-2 text-right font-medium">{t.colMedian}</th>
                  <th className="py-1.5 pr-2 text-right font-medium">{t.colP90}</th>
                  <th className="py-1.5 font-medium">{t.colLate}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stats.stepDurations.map((d) => (
                  <tr key={d.step}>
                    <td className="py-1.5 pr-2 text-slate-700">{d.step}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-slate-600">{fmtNum(d.done, locale)}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums text-slate-800">{hfmt(d.medianH, locale)}</td>
                    <td className={`py-1.5 pr-2 text-right tabular-nums ${d.p90H > 24 * 14 ? "font-semibold text-red-600" : "text-slate-600"}`}>{hfmt(d.p90H, locale)}</td>
                    <td className="py-1.5">
                      {d.latePct == null ? (
                        <span className="text-slate-300">—</span>
                      ) : (
                        <span className="flex items-center gap-1.5">
                          <span className="h-1.5 w-20 overflow-hidden rounded-full bg-slate-100">
                            <span className={`block h-full ${d.latePct > 40 ? "bg-red-500" : d.latePct > 25 ? "bg-amber-500" : "bg-emerald-500"}`} style={{ width: `${d.latePct}%` }} />
                          </span>
                          <span className="tabular-nums text-slate-600">{fmtNum(d.latePct, locale, 1)}%</span>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-slate-500">{t.historyHint}</p>
        </Card>
        <Card title={t.topSections}>
          <HBarChart data={stats.topRelatedSections} locale={tag} labelWidth="9rem" />
        </Card>
      </div>

      <div className="mt-4">
        <WireNote>{t.wire}</WireNote>
      </div>
    </>
  );
}
