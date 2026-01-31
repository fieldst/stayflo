"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/Button";
import * as Property from "@/lib/property";

type UpgradeRow = {
  id: string;
  scope_type: string; // "city" | "property"
  scope_key: string; // "san-antonio-tx" | "lamar" | "gabriel" | ...
  upgrade_key: string;
  title: string;
  subtitle: string | null;
  emoji: string | null;
  enabled: boolean;
  is_active: boolean;
  price_text: string | null;
  lead_time_hours: number | null;
  sort_order: number | null;
  fields: any;
  created_at: string;
  updated_at: string;
};

type Draft = Partial<UpgradeRow>;

async function fetchJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { cache: "no-store", ...init });
  const text = await res.text();
  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }
  if (!res.ok) throw new Error(data?.error || data?.message || data?.raw || `Request failed (${res.status})`);
  return data as T;
}

const CARD = "rounded-3xl border border-white/10 bg-black/40 backdrop-blur-sm p-6 text-white";
const SOFT = "rounded-3xl border border-white/10 bg-white/5 p-6 text-white";
const MODAL_BACKDROP = "fixed inset-0 z-50 bg-black/70 backdrop-blur-sm overflow-y-auto";
const MODAL = "mx-auto my-10 w-[92vw] max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl border border-white/10 bg-black/70 p-6 text-white shadow-2xl";

function fmtLead(hours: number | null | undefined) {
  const h = Number(hours ?? 0);
  if (!h) return "No lead time";
  if (h === 1) return "Lead time: 1 hour";
  return `Lead time: ${h} hours`;
}

function fmtPrice(p: string | null | undefined) {
  const t = (p || "").trim();
  return t ? t : "Price: —";
}

function slugifyKey(input: string) {
  const s = (input || "")
    .trim()
    .toLowerCase()
    .replace(/['"]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return s || "upgrade";
}

export default function UpgradesClient() {
  const sp = useSearchParams();
  const activeProperty = String(sp.get("property") || "lamar");

  const [upgrades, setUpgrades] = useState<UpgradeRow[]>([]);
  const [pageErr, setPageErr] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  // Only one upgrade open at a time (accordion)
  const [openId, setOpenId] = useState<string | null>(null);

  // Inline edits per existing upgrade id
  const [edits, setEdits] = useState<Record<string, Draft>>({});

  // Add modal
  const [addOpen, setAddOpen] = useState(false);
  const [addSaving, setAddSaving] = useState(false);
  const [addErr, setAddErr] = useState<string | null>(null);

  const propertySlugs = useMemo(() => {
    const maybe = (Property as any).PROPERTIES;
    if (maybe && typeof maybe === "object") return Object.keys(maybe);
    return ["lamar", "gabriel"];
  }, []);

  function titleForProperty(slug: string) {
    const cfg = (Property as any).getPropertyConfig?.(slug);
    if (!cfg) return slug;
    return cfg.displayName || cfg.slug || slug;
  }

  // ✅ We only manage property upgrades here. (City-wide rows are ignored.)
  const groupedByProperty = useMemo(() => {
    const byProp: Record<string, UpgradeRow[]> = {};
    for (const slug of propertySlugs) byProp[slug] = [];

    for (const u of upgrades) {
      if (u.scope_type !== "property") continue;
      if (!byProp[u.scope_key]) continue;
      byProp[u.scope_key].push(u);
    }

    const sortFn = (a: UpgradeRow, b: UpgradeRow) => (a.sort_order ?? 0) - (b.sort_order ?? 0);
    for (const slug of propertySlugs) byProp[slug].sort(sortFn);

    return byProp;
  }, [upgrades, propertySlugs]);

  async function loadAll() {
    setPageErr(null);
    try {
      const data = await fetchJSON<{ upgrades: UpgradeRow[] }>("/api/host/upgrades/list?all=1");
      setUpgrades(data.upgrades || []);
    } catch (e: any) {
      setPageErr(e.message || "Failed to load upgrades");
    }
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function ensureEdit(u: UpgradeRow) {
    setEdits((prev) => {
      if (prev[u.id]) return prev;
      return {
        ...prev,
        [u.id]: {
          id: u.id,
          title: u.title,
          subtitle: u.subtitle,
          emoji: u.emoji,
          price_text: u.price_text,
          lead_time_hours: u.lead_time_hours ?? 0,
          enabled: u.enabled,
          is_active: u.is_active,
          sort_order: u.sort_order ?? 0,
          scope_type: u.scope_type,
          scope_key: u.scope_key,
          upgrade_key: u.upgrade_key,
        },
      };
    });
  }

  async function saveDraft(d: Draft) {
    const payload = {
      id: String(d.id || "").trim(),
      scope_type: String(d.scope_type || "").trim(),
      scope_key: String(d.scope_key || "").trim(),
      upgrade_key: String(d.upgrade_key || "").trim(),
      title: String(d.title || "").trim(),
      subtitle: d.subtitle ?? null,
      emoji: d.emoji ?? null,
      enabled: !!d.enabled,
      is_active: !!d.is_active,
      price_text: d.price_text ?? null,
      lead_time_hours: Number(d.lead_time_hours ?? 0),
      sort_order: Number(d.sort_order ?? 0),
      fields: {},
    };

    if (!payload.id) throw new Error("Missing id");
    if (!payload.upgrade_key) throw new Error("Missing upgrade key");
    if (!payload.title) throw new Error("Title is required");

    setSavingId(payload.id);
    setMsg(null);

    try {
      await fetchJSON<{ upgrade: UpgradeRow }>("/api/host/upgrades/upsert", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      setMsg("Saved ✅");
      await loadAll();

      setOpenId(null);
      setEdits((p) => {
        const next = { ...p };
        delete next[payload.id];
        return next;
      });

      setTimeout(() => setMsg(null), 1400);
    } finally {
      setSavingId(null);
    }
  }

  async function deleteUpgrade(id: string) {
    if (!confirm("Delete this upgrade?")) return;
    setSavingId(id);
    setMsg(null);
    try {
      await fetchJSON<{ success: true }>("/api/host/upgrades/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setMsg("Deleted ✅");
      await loadAll();
      if (openId === id) setOpenId(null);
      setTimeout(() => setMsg(null), 1400);
    } finally {
      setSavingId(null);
    }
  }

  // -------------------------
  // Add Upgrade Modal State
  // -------------------------
  const [addAll, setAddAll] = useState(true);
  const [addSelected, setAddSelected] = useState<Record<string, boolean>>({});
  const [addTitle, setAddTitle] = useState("");
  const [addSubtitle, setAddSubtitle] = useState("");
  const [addEmoji, setAddEmoji] = useState("✨");
  const [addPrice, setAddPrice] = useState("");
  const [addLead, setAddLead] = useState<number>(0);
  const [addSort, setAddSort] = useState<number>(0);
  const [addEnabled, setAddEnabled] = useState(true);
  const [addVisible, setAddVisible] = useState(true);
  const [addKey, setAddKey] = useState("");

  function resetAddForm() {
    setAddErr(null);
    setAddAll(true);
    const initSel: Record<string, boolean> = {};
    for (const s of propertySlugs) initSel[s] = s === activeProperty;
    setAddSelected(initSel);
    setAddTitle("");
    setAddSubtitle("");
    setAddEmoji("✨");
    setAddPrice("");
    setAddLead(0);
    setAddSort(0);
    setAddEnabled(true);
    setAddVisible(true);
    setAddKey("");
  }

  useEffect(() => {
    // keep selections sane when properties list changes
    if (!Object.keys(addSelected).length) {
      const initSel: Record<string, boolean> = {};
      for (const s of propertySlugs) initSel[s] = s === activeProperty;
      setAddSelected(initSel);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [propertySlugs]);

  function selectedSlugs(): string[] {
    if (addAll) return [...propertySlugs];
    return propertySlugs.filter((s) => !!addSelected[s]);
  }

  function closeAdd() {
    setAddOpen(false);
    setAddSaving(false);
    setAddErr(null);
  }

  async function createUpgrade() {
    setAddErr(null);

    const slugs = selectedSlugs();
    if (!slugs.length) {
      setAddErr("Select at least one property (or choose All properties).");
      return;
    }

    const title = addTitle.trim();
    if (!title) {
      setAddErr("Title is required.");
      return;
    }

    const upgrade_key = (addKey.trim() ? slugifyKey(addKey) : slugifyKey(title));

    // very small guard: avoid accidental duplicates in the client
    // (DB may also have a unique constraint; this gives a clearer message)
    for (const slug of slugs) {
      const exists = (groupedByProperty[slug] || []).some((u) => u.upgrade_key === upgrade_key);
      if (exists) {
        setAddErr(
          `That internal key already exists on ${titleForProperty(slug)}. Change the “Internal key” or rename the title.`
        );
        return;
      }
    }

    setAddSaving(true);

    try {
      // Create 1 row per property (this replaces “city-wide” behavior)
      for (let i = 0; i < slugs.length; i++) {
        const slug = slugs[i];
        const id = crypto.randomUUID();

        const payload = {
          id,
          scope_type: "property",
          scope_key: slug,
          upgrade_key,
          title,
          subtitle: addSubtitle.trim() ? addSubtitle.trim() : null,
          emoji: addEmoji.trim() ? addEmoji.trim() : null,
          enabled: !!addEnabled,
          is_active: !!addVisible,
          price_text: addPrice.trim() ? addPrice.trim() : null,
          lead_time_hours: Number(addLead || 0),
          sort_order: Number(addSort || 0),
          fields: {},
        };

        await fetchJSON<{ upgrade: UpgradeRow }>("/api/host/upgrades/upsert", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      await loadAll();
      setMsg("Added ✅");
      setTimeout(() => setMsg(null), 1400);

      closeAdd();
      resetAddForm();
    } catch (e: any) {
      setAddErr(e.message || "Failed to add upgrade");
    } finally {
      setAddSaving(false);
    }
  }

  function PropertySection({ slug, rows }: { slug: string; rows: UpgradeRow[] }) {
    const pill =
      "inline-flex items-center rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] text-white/70";

    return (
      <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
        <div className="text-lg font-semibold">{titleForProperty(slug)}</div>

        <div className="mt-4 space-y-3">
          {rows.length ? (
            rows.map((u) => {
              const isOpen = openId === u.id;
              const isSaving = savingId === u.id;
              const d = edits[u.id] || null;

              return (
                <div key={u.id} className="rounded-2xl border border-white/10 bg-black/30">
                  <button
                    type="button"
                    onClick={() => {
                      if (isOpen) {
                        setOpenId(null);
                        return;
                      }
                      ensureEdit(u);
                      setOpenId(u.id);
                    }}
                    className="w-full rounded-2xl px-4 py-4 text-left transition hover:bg-white/5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <div className="text-xl leading-none">{u.emoji || "✨"}</div>
                          <div className="truncate text-base font-semibold">{u.title}</div>
                        </div>

                        {u.subtitle ? <div className="mt-1 line-clamp-2 text-sm text-white/70">{u.subtitle}</div> : null}

                        <div className="mt-2 flex flex-wrap gap-2">
                          <span className={pill}>{fmtPrice(u.price_text)}</span>
                          <span className={pill}>{fmtLead(u.lead_time_hours)}</span>
                          <span className={pill}>{u.enabled ? "Enabled" : "Disabled"}</span>
                          <span className={pill}>{u.is_active ? "Visible" : "Hidden"}</span>
                        </div>
                      </div>

                      <div className="shrink-0">
                        <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/70">
                          {isOpen ? "Close" : "Edit"}
                        </span>
                      </div>
                    </div>
                  </button>

                  {isOpen && d ? (
                    <div className="border-t border-white/10 px-4 pb-4 pt-4">
                      <div className="grid gap-3 md:grid-cols-2">
                        <label className="block">
                          <div className="text-xs text-white/60">Title</div>
                          <input
                            value={String(d.title ?? "")}
                            onChange={(e) => setEdits((p) => ({ ...p, [u.id]: { ...d, title: e.target.value } }))}
                            className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
                          />
                        </label>

                        <label className="block">
                          <div className="text-xs text-white/60">Subtitle</div>
                          <input
                            value={String(d.subtitle ?? "")}
                            onChange={(e) => setEdits((p) => ({ ...p, [u.id]: { ...d, subtitle: e.target.value } }))}
                            className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
                          />
                        </label>

                        <label className="block">
                          <div className="text-xs text-white/60">Emoji</div>
                          <input
                            value={String(d.emoji ?? "")}
                            onChange={(e) => setEdits((p) => ({ ...p, [u.id]: { ...d, emoji: e.target.value } }))}
                            className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
                            placeholder="✨"
                          />
                        </label>

                        <label className="block">
                          <div className="text-xs text-white/60">Price</div>
                          <input
                            value={String(d.price_text ?? "")}
                            onChange={(e) => setEdits((p) => ({ ...p, [u.id]: { ...d, price_text: e.target.value } }))}
                            className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
                            placeholder="$25"
                          />
                        </label>

                        <label className="block">
                          <div className="text-xs text-white/60">Lead time (hours)</div>
                          <input
                            type="number"
                            value={String(d.lead_time_hours ?? 0)}
                            onChange={(e) =>
                              setEdits((p) => ({ ...p, [u.id]: { ...d, lead_time_hours: Number(e.target.value || 0) } }))
                            }
                            className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
                          />
                        </label>

                        <label className="block">
                          <div className="text-xs text-white/60">Sort order</div>
                          <input
                            type="number"
                            value={String(d.sort_order ?? 0)}
                            onChange={(e) =>
                              setEdits((p) => ({ ...p, [u.id]: { ...d, sort_order: Number(e.target.value || 0) } }))
                            }
                            className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
                          />
                        </label>

                        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2">
                          <input
                            type="checkbox"
                            checked={!!d.enabled}
                            onChange={(e) => setEdits((p) => ({ ...p, [u.id]: { ...d, enabled: e.target.checked } }))}
                          />
                          <span className="text-sm">Enabled (available)</span>
                        </label>

                        <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2">
                          <input
                            type="checkbox"
                            checked={!!d.is_active}
                            onChange={(e) => setEdits((p) => ({ ...p, [u.id]: { ...d, is_active: e.target.checked } }))}
                          />
                          <span className="text-sm">Visible (shown to guests)</span>
                        </label>

                        <div className="md:col-span-2 grid gap-2">
                          <Button
                            variant="primary"
                            className="w-full"
                            disabled={isSaving}
                            onClick={async () => {
                              try {
                                await saveDraft(d);
                              } catch (e: any) {
                                alert(e.message || "Save failed");
                              }
                            }}
                          >
                            {isSaving ? "Saving…" : "Save"}
                          </Button>

                          <Button
                            className="w-full"
                            onClick={() => {
                              setOpenId(null);
                              setEdits((p) => {
                                const next = { ...p };
                                delete next[u.id];
                                return next;
                              });
                            }}
                          >
                            Cancel
                          </Button>

                          <Button className="w-full" onClick={() => deleteUpgrade(u.id)}>
                            Delete Upgrade
                          </Button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })
          ) : (
            <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-white/70">
              No upgrades yet.
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#2b124c] via-black to-black px-6 py-10">
      <div className="mx-auto w-full max-w-5xl space-y-6">
        <div className={CARD}>
          <div className="text-xs uppercase tracking-wide text-white/60">Host</div>
          <h1 className="mt-1 text-2xl font-bold">Upgrades</h1>
          <p className="mt-2 text-sm text-white/70">Pick a property, then tap an upgrade to edit it.</p>

            <div className="mt-4 flex flex-wrap gap-2">
                      <Button href="/host">← Host Home</Button>

                      <Button href={`/p/${activeProperty}`} variant="primary">
                        Back to Guest Hub
                      </Button>

                      <Button href="/host/guides" className="whitespace-nowrap">
                        Guides
                      </Button>

                      <Button href="/host/wifi" className="whitespace-nowrap">
                        Wi-Fi & Tech
                      </Button>

                      <Button
                        variant="primary"
                        className="whitespace-nowrap"
                        onClick={() => {
                          resetAddForm();
                          setAddOpen(true);
                        }}
                      >
                        + Add Upgrade
                      </Button>
                    </div>

          {pageErr ? <div className="mt-3 text-sm text-red-200">{pageErr}</div> : null}
          {msg ? <div className="mt-3 text-sm text-emerald-200">{msg}</div> : null}
        </div>

        <div className={SOFT}>
          <div className="grid gap-4 md:grid-cols-2">
            {propertySlugs.map((slug) => (
              <PropertySection key={slug} slug={slug} rows={groupedByProperty[slug] || []} />
            ))}
          </div>
        </div>
      </div>

      {/* Add Upgrade Modal */}
      {addOpen ? (
        <div
          className={MODAL_BACKDROP}
          onClick={() => {
            if (!addSaving) closeAdd();
          }}
        >
          <div
            className={MODAL}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs uppercase tracking-wide text-white/60">Host</div>
                <div className="mt-1 text-xl font-semibold">Add Upgrade</div>
                <div className="mt-1 text-sm text-white/70">
                  Add to one property or all properties. “All properties” creates one row per property.
                </div>
              </div>

              <button
                type="button"
                disabled={addSaving}
                onClick={closeAdd}
                className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs text-white/70 transition hover:bg-white/5 disabled:opacity-50"
              >
                Close
              </button>
            </div>

            {addErr ? <div className="mt-4 rounded-2xl border border-red-400/20 bg-red-500/10 p-3 text-sm text-red-100">{addErr}</div> : null}

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              {/* Targeting */}
              <div className="md:col-span-2 rounded-2xl border border-white/10 bg-black/30 p-4">
                <div className="text-sm font-semibold">Apply to</div>
                <div className="mt-3 flex flex-wrap gap-3">
                  <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2">
                    <input
                      type="checkbox"
                      checked={addAll}
                      onChange={(e) => setAddAll(e.target.checked)}
                    />
                    <span className="text-sm">All properties</span>
                  </label>

                  <div className="flex flex-wrap gap-2">
                    {propertySlugs.map((slug) => (
                      <label
                        key={slug}
                        className={`flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 ${
                          addAll ? "opacity-50" : ""
                        }`}
                      >
                        <input
                          type="checkbox"
                          disabled={addAll}
                          checked={!!addSelected[slug]}
                          onChange={(e) => setAddSelected((p) => ({ ...p, [slug]: e.target.checked }))}
                        />
                        <span className="text-sm">{titleForProperty(slug)}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              <label className="block md:col-span-2">
                <div className="text-xs text-white/60">Title</div>
                <input
                  value={addTitle}
                  onChange={(e) => {
                    setAddTitle(e.target.value);
                    if (!addKey.trim()) {
                      // live-generate key if user hasn't started editing it
                      setAddKey(slugifyKey(e.target.value));
                    }
                  }}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
                  placeholder="Late Check-Out"
                />
              </label>

              <label className="block md:col-span-2">
                <div className="text-xs text-white/60">Subtitle</div>
                <input
                  value={addSubtitle}
                  onChange={(e) => setAddSubtitle(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
                  placeholder="Request availability for extra time"
                />
              </label>

              <label className="block">
                <div className="text-xs text-white/60">Emoji</div>
                <input
                  value={addEmoji}
                  onChange={(e) => setAddEmoji(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
                  placeholder="✨"
                />
              </label>

              <label className="block">
                <div className="text-xs text-white/60">Price</div>
                <input
                  value={addPrice}
                  onChange={(e) => setAddPrice(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
                  placeholder="$50 or varies"
                />
              </label>

              <label className="block">
                <div className="text-xs text-white/60">Lead time (hours)</div>
                <input
                  type="number"
                  value={String(addLead)}
                  onChange={(e) => setAddLead(Number(e.target.value || 0))}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
                />
              </label>

              <label className="block">
                <div className="text-xs text-white/60">Sort order</div>
                <input
                  type="number"
                  value={String(addSort)}
                  onChange={(e) => setAddSort(Number(e.target.value || 0))}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
                />
              </label>

              <label className="block md:col-span-2">
                <div className="text-xs text-white/60">Internal key</div>
                <input
                  value={addKey}
                  onChange={(e) => setAddKey(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm text-white outline-none"
                  placeholder="late_checkout"
                />
                <div className="mt-1 text-xs text-white/50">
                  Used internally. Keep it stable. Example: <span className="text-white/70">late_checkout</span>
                </div>
              </label>

              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 md:col-span-1">
                <input
                  type="checkbox"
                  checked={addEnabled}
                  onChange={(e) => setAddEnabled(e.target.checked)}
                />
                <span className="text-sm">Enabled (available)</span>
              </label>

              <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-black/40 px-3 py-2 md:col-span-1">
                <input
                  type="checkbox"
                  checked={addVisible}
                  onChange={(e) => setAddVisible(e.target.checked)}
                />
                <span className="text-sm">Visible (shown to guests)</span>
              </label>

              <div className="md:col-span-2 grid gap-2 pt-2">
                <Button
                  variant="primary"
                  className="w-full"
                  disabled={addSaving}
                  onClick={createUpgrade}
                >
                  {addSaving ? "Adding…" : "Add Upgrade"}
                </Button>

                <Button
                  className="w-full"
                  disabled={addSaving}
                  onClick={closeAdd}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}