// Client-side demo store for the 4M wireframe. Replaced by the REST API later; the action names map
// 1:1 to the planned endpoints (POST /cases, POST /tasks/{id}/complete, POST /cases/{id}/shares, ...).

import { useSyncExternalStore } from "react";
import { addHours, applyCase, buildSeed, createCase, nextCode, NOW0, type CaseAction, type FourMCase, type NewNote, type Note, type RequestData } from "./fourm-case";
import { personById } from "./people";

export function createPersistentStore<T>(key: string, init: () => T) {
  const initial = init();
  let state: T | null = null;
  const listeners = new Set<() => void>();
  const get = (): T => {
    if (state === null) {
      try {
        const raw = window.localStorage.getItem(key);
        state = raw ? (JSON.parse(raw) as T) : initial;
      } catch {
        state = initial;
      }
    }
    return state;
  };
  const set = (next: T | ((s: T) => T)) => {
    state = typeof next === "function" ? (next as (s: T) => T)(get()) : next;
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* storage full or disabled – keep in memory */
    }
    listeners.forEach((l) => l());
  };
  const subscribe = (l: () => void) => {
    listeners.add(l);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) {
        state = null;
        l();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(l);
      window.removeEventListener("storage", onStorage);
    };
  };
  const use = () => useSyncExternalStore(subscribe, get, () => initial);
  return { get, set, use, initial };
}

export type SavedView = { id: string; name: string; query: string; owner: string };
export type Db = { now: string; me: string; cases: FourMCase[]; notes: Note[]; views: SavedView[] };

function seedDb(): Db {
  const { cases, notes } = buildSeed();
  const all = toNotes([], notes).map((n) => ({ ...n, read: n.at < addHours(NOW0, -48) }));
  return {
    now: NOW0,
    me: "son",
    cases,
    notes: all,
    views: [
      { id: "v1", name: "Quá hạn phòng tôi", query: "view=all&due=overdue&rsec=8311", owner: "son" },
      { id: "v2", name: "4M Safety đang chạy", query: "view=all&state=running&cls=S", owner: "son" },
    ],
  };
}

function toNotes(existing: Note[], fresh: NewNote[]): Note[] {
  const base = existing.length;
  return [...fresh.map((n, i) => ({ ...n, id: `n${base + i + 1}`, read: false })), ...existing].sort((a, b) => b.at.localeCompare(a.at));
}

const store = createPersistentStore<Db>("iw.4m.v1", seedDb);

export const useDb = store.use;
export const useMe = () => personById(store.use().me)!;

const tick = (now: string) => addHours(now, 0.25);

export function act(code: string, action: CaseAction) {
  store.set((s) => {
    const c = s.cases.find((x) => x.code === code);
    if (!c) return s;
    const now = tick(s.now);
    const { next, notes } = applyCase(c, action, s.me, now);
    return { ...s, now, cases: s.cases.map((x) => (x.code === code ? next : x)), notes: toNotes(s.notes, notes) };
  });
}

export function submitNew(data: RequestData, attachments: string[]): string {
  let code = "";
  store.set((s) => {
    const me = personById(s.me)!;
    const now = tick(s.now);
    code = nextCode(s.cases, me.section, now);
    const { next, notes } = createCase({ data, requester: me.id, section: me.section, attachments }, code, now);
    return { ...s, now, cases: [next, ...s.cases], notes: toNotes(s.notes, notes) };
  });
  return code;
}

export const switchUser = (id: string) => store.set((s) => ({ ...s, me: id }));
export const advanceClock = (hours: number) => store.set((s) => ({ ...s, now: addHours(s.now, hours) }));
export const markRead = (ids: string[]) => store.set((s) => ({ ...s, notes: s.notes.map((n) => (ids.includes(n.id) ? { ...n, read: true } : n)) }));
export const resetDemo = () => store.set(seedDb());
export const saveView = (name: string, query: string) =>
  store.set((s) => ({ ...s, views: [...s.views, { id: `v${Date.now()}`, name, query, owner: s.me }] }));
export const deleteView = (id: string) => store.set((s) => ({ ...s, views: s.views.filter((v) => v.id !== id) }));
