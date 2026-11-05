"use client";

import { Check, CircleDot, X } from "lucide-react";
import { Badge } from "@/components/ui";
import { stepById, type FourMStepId } from "@/lib/fourm";
import { caseState, dueStatus, hoursBetween, stateTone, type DueStatus, type FourMCase, type SearchHit } from "@/lib/fourm-case";
import { common, fmtHours, stepNames, useLocale, type Locale } from "@/lib/i18n";
import { hitFieldName, phaseNames } from "@/lib/i18n-4m";
import { initials, personName } from "@/lib/people";

export function CaseLoading() {
  const locale = useLocale();
  return <p className="text-sm text-slate-500">{locale === "vi" ? "Đang tải hồ sơ…" : "Loading case…"}</p>;
}

export function CaseStateBadge({ c }: { c: FourMCase }) {
  const locale = useLocale();
  const s = caseState(c);
  return <Badge tone={stateTone[s]}>{common[locale].state[s]}</Badge>;
}

const dueTone: Record<DueStatus, "red" | "amber" | "green"> = { overdue: "red", dueSoon: "amber", normal: "green" };
const leftText: Record<Locale, (h: string) => string> = { vi: (h) => `Còn ${h}`, en: (h) => `${h} left` };

export function DueBadge({ due, now, showLeft = true }: { due: string; now: string; showLeft?: boolean }) {
  const locale = useLocale();
  const names = common[locale].due;
  const st = dueStatus(due, now);
  const left = fmtHours(hoursBetween(now, due), locale);
  const text = st === "overdue" ? `${names.overdue} ${left}` : st === "dueSoon" ? leftText[locale](left) : names.normal;
  return <Badge tone={dueTone[st]}>{showLeft ? text : names[st]}</Badge>;
}

const versionHint: Record<Locale, (v: number) => string> = {
  vi: (v) => `Phiên bản định nghĩa quy trình v${v} – vẫn gộp chung theo tên quy trình`,
  en: (v) => `Process definition version v${v} – still grouped under the process name`,
};

export function VersionTag({ v }: { v: number }) {
  const locale = useLocale();
  return (
    <span className="rounded border border-slate-200 px-1 text-[10px] text-slate-500" title={versionHint[locale](v)}>
      v{v}
    </span>
  );
}

export function Avatar({ id, size = "sm" }: { id: string; size?: "sm" | "md" }) {
  const name = personName(id);
  return (
    <span
      title={name}
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-slate-200 font-semibold text-slate-700 ${size === "sm" ? "h-6 w-6 text-[10px]" : "h-8 w-8 text-xs"}`}
    >
      {initials(name)}
    </span>
  );
}

export function Highlight({ hit }: { hit: SearchHit }) {
  const locale = useLocale();
  return (
    <span className="block truncate text-xs text-slate-500">
      <span className="font-medium text-slate-600">{hitFieldName(hit.field, locale)}: </span>
      {hit.parts.map((p, i) =>
        p.hit ? (
          <mark key={i} className="rounded bg-yellow-200 px-0.5 text-slate-900">
            {p.text}
          </mark>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </span>
  );
}

const order: FourMStepId[] = ["create", "mgr", "gm", "relsec", "gd", "result", "rmgr", "rgm", "rrelsec", "rgd", "review"];

type StepState = "done" | "current" | "upcoming" | "stopped";

export function stepStates(c: FourMCase): { id: FourMStepId; state: StepState }[] {
  const visible = order.filter((id) => (id !== "gd" && id !== "rgd") || c.sim.visited.includes(id) || c.sim.step === id);
  const cur = c.sim.step;
  if (cur) {
    const pos = order.indexOf(cur);
    return visible.map((id) => ({ id, state: id === cur ? "current" : order.indexOf(id) < pos ? "done" : "upcoming" }));
  }
  const lastStep = [...c.events].reverse().find((e) => e.step && e.kind !== "comment" && e.kind !== "share")?.step;
  const end = caseState(c);
  const pos = lastStep ? order.indexOf(lastStep) : order.length - 1;
  return visible.map((id) => {
    const i = order.indexOf(id);
    if (end === "completed") return { id, state: "done" };
    if (id === lastStep) return { id, state: "stopped" };
    return { id, state: i < pos && c.sim.visited.includes(id) ? "done" : "upcoming" };
  });
}

export function Stepper({ c, compact = false }: { c: FourMCase; compact?: boolean }) {
  const locale = useLocale();
  const names = stepNames[locale];
  const states = stepStates(c);
  if (compact) {
    return (
      <span className="flex items-center gap-0.5" aria-label={locale === "vi" ? "Tiến độ" : "Progress"}>
        {states.map(({ id, state }) => (
          <span
            key={id}
            title={names[id]}
            className={`h-1.5 w-3 rounded-full ${
              state === "done" ? "bg-emerald-500" : state === "current" ? "bg-blue-600" : state === "stopped" ? "bg-red-500" : "bg-slate-200"
            } ${stepById(id).phase === "after" && id === "result" ? "ml-1" : ""}`}
          />
        ))}
      </span>
    );
  }
  const phases = [
    { title: phaseNames[locale].before, items: states.filter((s) => stepById(s.id).phase === "before") },
    { title: phaseNames[locale].after, items: states.filter((s) => stepById(s.id).phase === "after") },
  ];
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {phases.map((p) => (
        <div key={p.title}>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{p.title}</p>
          <ol className="flex items-start">
            {p.items.map(({ id, state }, i) => (
              <li key={id} className="flex min-w-0 flex-1 flex-col items-center text-center">
                <div className="flex w-full items-center">
                  <span className={`h-0.5 flex-1 ${i === 0 ? "bg-transparent" : state === "upcoming" ? "bg-slate-200" : "bg-emerald-400"}`} />
                  <span
                    className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-2 ${
                      state === "done"
                        ? "border-emerald-500 bg-emerald-500 text-white"
                        : state === "current"
                          ? "border-blue-600 bg-white text-blue-600 ring-4 ring-blue-100"
                          : state === "stopped"
                            ? "border-red-500 bg-red-500 text-white"
                            : "border-slate-300 bg-white text-slate-300"
                    }`}
                  >
                    {state === "done" ? <Check className="h-4 w-4" /> : state === "stopped" ? <X className="h-4 w-4" /> : <CircleDot className="h-3.5 w-3.5" />}
                  </span>
                  <span className={`h-0.5 flex-1 ${i === p.items.length - 1 ? "bg-transparent" : p.items[i + 1].state === "upcoming" ? "bg-slate-200" : "bg-emerald-400"}`} />
                </div>
                <span className={`mt-1.5 px-1 text-[11px] leading-tight ${state === "current" ? "font-semibold text-blue-700" : state === "upcoming" ? "text-slate-400" : "text-slate-600"}`}>{names[id]}</span>
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
