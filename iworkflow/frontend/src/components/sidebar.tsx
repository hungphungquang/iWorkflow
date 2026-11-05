"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  Building2,
  FileStack,
  FilePlus2,
  FolderSearch,
  Gauge,
  Home,
  Inbox,
  LayoutTemplate,
  ListChecks,
  PlusCircle,
  Search,
  Settings,
  Users,
  Workflow,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { openTasks } from "@/lib/fourm-case";
import { common, useMessages } from "@/lib/i18n";
import { READ_ONLY, useDb } from "@/lib/store";

type Item = { href: string; label: string; icon: LucideIcon; badge?: number };

function isActive(pathname: string, href: string) {
  if (href === "/" || href === "/cases" || href === "/4m") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Sidebar() {
  const pathname = usePathname();
  const t = useMessages(common).nav;
  const db = useDb();
  const myTasks = db.cases.flatMap(openTasks).filter((x) => x.assignee === db.me).length;

  const sections: { title: string; items: Item[] }[] = [
    {
      title: t.groupDash,
      items: [
        { href: "/", label: t.home, icon: Home },
        { href: "/dashboards/unit", label: t.unit, icon: Users },
        { href: "/dashboards/company", label: t.company, icon: Building2 },
        { href: "/4m", label: t.track4m, icon: Gauge },
      ],
    },
    {
      title: t.group4m,
      items: [
        { href: "/4m/cases", label: t.cases4m, icon: ListChecks, badge: myTasks },
        { href: "/4m/new", label: t.new4m, icon: FilePlus2 },
        { href: "/search", label: t.search, icon: Search },
      ],
    },
    {
      title: t.groupWork,
      items: [
        { href: "/tasks", label: t.tasks, icon: Inbox },
        { href: "/cases/new", label: t.newCase, icon: PlusCircle },
        { href: "/cases", label: t.cases, icon: FolderSearch },
        { href: "/reports", label: t.reports, icon: BarChart3 },
      ],
    },
    {
      title: t.groupDesign,
      items: [
        { href: "/processes", label: t.processes, icon: Workflow },
        { href: "/forms", label: t.forms, icon: LayoutTemplate },
      ],
    },
    {
      title: t.groupSystem,
      items: [
        { href: "/admin", label: t.admin, icon: Settings },
        { href: "/migration", label: t.migration, icon: FileStack },
      ],
    },
  ];

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
      <div className="flex h-14 items-center gap-2 border-b border-slate-200 px-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-blue-600 text-sm font-bold text-white">iW</span>
        <div className="leading-tight">
          <p className="text-sm font-semibold text-slate-900">iWorkflow</p>
          <p className="text-[11px] text-slate-500">BTMV · 2.0</p>
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-3">
        {sections.map((section) => (
          <div key={section.title} className="mb-4">
            <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{section.title}</p>
            <ul className="space-y-0.5">
              {section.items.map(({ href, label, icon: Icon, badge }) => {
                const active = isActive(pathname, href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={`flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm ${
                        active ? "bg-blue-50 font-medium text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                      }`}
                    >
                      <Icon className="h-4 w-4" aria-hidden />
                      <span className="flex-1">{label}</span>
                      {!!badge && <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">{badge}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
      <p className="border-t border-slate-200 px-4 py-3 text-[11px] text-slate-400">{READ_ONLY ? "Xem trước · dữ liệu iw_prod (chỉ đọc)" : t.footer}</p>
    </aside>
  );
}
