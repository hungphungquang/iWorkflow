"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, Check, ChevronDown, Clock, RotateCcw, Search } from "lucide-react";
import { openTasks } from "@/lib/fourm-case";
import { common, fmtDateTime, locales, setLocale, useLocale, useMessages } from "@/lib/i18n";
import { initials, people, personById } from "@/lib/people";
import { advanceClock, markRead, resetDemo, switchUser, useDb } from "@/lib/store";

export function Topbar() {
  const router = useRouter();
  const locale = useLocale();
  const t = useMessages(common).top;
  const db = useDb();
  const me = personById(db.me)!;
  const [q, setQ] = useState("");
  const [menu, setMenu] = useState<"notes" | "user" | null>(null);
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        input.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const myNotes = db.notes.filter((n) => n.to === db.me);
  const unread = myNotes.filter((n) => !n.read);
  const taskCount = (id: string) => db.cases.flatMap(openTasks).filter((x) => x.assignee === id).length;

  return (
    <header className="relative z-20 flex h-14 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 md:px-6">
      <form
        className="relative max-w-lg flex-1"
        role="search"
        onSubmit={(e) => {
          e.preventDefault();
          router.push(`/search?q=${encodeURIComponent(q.trim())}`);
        }}
      >
        <Search className="pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-slate-400" aria-hidden />
        <input
          ref={input}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="w-full rounded-md border border-slate-200 bg-slate-50 py-1.5 pl-8 pr-3 text-sm placeholder:text-slate-400 focus:border-blue-500 focus:bg-white focus:outline-none"
          placeholder={t.search}
          aria-label={t.search}
        />
      </form>

      <div className="ml-auto flex items-center gap-2">
        <div className="flex rounded-md border border-slate-200 p-0.5 text-xs" role="group" aria-label={t.language}>
          {locales.map((l) => (
            <button
              key={l.id}
              type="button"
              title={l.label}
              aria-pressed={locale === l.id}
              onClick={() => setLocale(l.id)}
              className={`rounded px-2 py-0.5 font-medium ${locale === l.id ? "bg-blue-600 text-white" : "text-slate-500 hover:bg-slate-100"}`}
            >
              {l.short}
            </button>
          ))}
        </div>

        <div className="relative">
          <button className="relative rounded-md p-2 text-slate-500 hover:bg-slate-100" aria-label={t.notifications} aria-expanded={menu === "notes"} onClick={() => setMenu(menu === "notes" ? null : "notes")}>
            <Bell className="h-5 w-5" />
            {unread.length > 0 && <span className="absolute right-0.5 top-0.5 min-w-4 rounded-full bg-red-500 px-1 text-[10px] font-semibold leading-4 text-white">{unread.length}</span>}
          </button>
          {menu === "notes" && (
            <Popover onClose={() => setMenu(null)} className="w-96">
              <div className="flex items-center justify-between border-b border-slate-100 px-3 py-2">
                <p className="text-sm font-semibold text-slate-800">{t.notifications}</p>
                <button className="text-xs text-blue-600 hover:underline" onClick={() => markRead(unread.map((n) => n.id))}>
                  {t.markAll}
                </button>
              </div>
              <ul className="max-h-96 divide-y divide-slate-100 overflow-y-auto">
                {myNotes.length === 0 && <li className="px-3 py-6 text-center text-xs text-slate-500">{t.noNotes}</li>}
                {myNotes.slice(0, 30).map((n) => (
                  <li key={n.id}>
                    <Link
                      href={`/4m/cases/${n.code}`}
                      onClick={() => {
                        markRead([n.id]);
                        setMenu(null);
                      }}
                      className={`block px-3 py-2 text-xs hover:bg-slate-50 ${n.read ? "text-slate-500" : "bg-blue-50/50 text-slate-800"}`}
                    >
                      <span className="flex items-center gap-2">
                        {!n.read && <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-600" />}
                        <span className="font-mono text-[11px] text-slate-500">{n.code}</span>
                        <span className="ml-auto text-[10px] text-slate-400">{fmtDateTime(n.at, locale)}</span>
                      </span>
                      <span className="mt-0.5 block">{n.text}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Popover>
          )}
        </div>

        <div className="relative">
          <button className="flex items-center gap-2 rounded-md px-1.5 py-1 hover:bg-slate-100" aria-expanded={menu === "user"} onClick={() => setMenu(menu === "user" ? null : "user")}>
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-semibold text-blue-800">{initials(me.name)}</span>
            <span className="hidden text-left leading-tight sm:block">
              <span className="block text-sm font-medium text-slate-800">{me.name}</span>
              <span className="block text-[11px] text-slate-500">
                {me.title} · {me.section}
              </span>
            </span>
            <ChevronDown className="h-4 w-4 text-slate-400" />
          </button>
          {menu === "user" && (
            <Popover onClose={() => setMenu(null)} className="w-80">
              <p className="border-b border-slate-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{t.actAs}</p>
              <ul className="max-h-80 overflow-y-auto py-1">
                {people.map((p) => {
                  const n = taskCount(p.id);
                  return (
                    <li key={p.id}>
                      <button
                        className={`flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-slate-50 ${p.id === db.me ? "bg-blue-50" : ""}`}
                        onClick={() => {
                          switchUser(p.id);
                          setMenu(null);
                        }}
                      >
                        <span className="w-4">{p.id === db.me && <Check className="h-3.5 w-3.5 text-blue-600" />}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium text-slate-800">{p.name}</span>
                          <span className="block truncate text-[11px] text-slate-500">
                            {p.title} · {p.section}
                          </span>
                        </span>
                        {n > 0 && <span className="rounded-full bg-red-500 px-1.5 text-[10px] font-semibold text-white">{n}</span>}
                      </button>
                    </li>
                  );
                })}
              </ul>
              <div className="flex items-center gap-2 border-t border-slate-100 px-3 py-2 text-xs text-slate-600">
                <Clock className="h-3.5 w-3.5" />
                <span className="flex-1">
                  {t.clock}: <b>{fmtDateTime(db.now, locale)}</b>
                </span>
                <button className="rounded border border-slate-300 px-1.5 py-0.5 hover:bg-slate-50" onClick={() => advanceClock(24)}>
                  {t.plus1d}
                </button>
              </div>
              <button className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-xs text-red-600 hover:bg-red-50" onClick={() => resetDemo()}>
                <RotateCcw className="h-3.5 w-3.5" /> {t.reset}
              </button>
            </Popover>
          )}
        </div>
      </div>
    </header>
  );
}

function Popover({ children, onClose, className = "" }: { children: React.ReactNode; onClose: () => void; className?: string }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} aria-hidden />
      <div className={`absolute right-0 top-full z-40 mt-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg ${className}`}>{children}</div>
    </>
  );
}
