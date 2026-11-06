"use client";
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import Link from "next/link";
import {
  ArrowUpRightIcon,
  EyeOffIcon,
  HomeIcon,
  InfoIcon,
  PaletteIcon,
  TicketIcon,
  Volume2Icon,
  VolumeXIcon,
  XIcon,
} from "lucide-react";
import { safeHref } from "@/lib/links";
import { cn } from "@/lib/utils";
import type { SheetData } from "@/modules/sheet/shared";
import { drawBlob, type BlobInk, type Expression } from "./blob";
import {
  ANGRY_AFTER_MINUTES,
  demoMask,
  layoutWorld,
  lookOf,
  STATE_LABEL,
  type Unit,
  type World,
} from "./model";
import { AgentWorldScene, type Pointer, type WorldPick } from "./scene";
import { projectColors, TrayScene } from "./tray-scene";
import {
  THEME_IDS,
  THEMES,
  themeOf,
  isThemeId,
  type Theme,
  type ThemeId,
} from "./themes";
const card = "aw-paper";
const hand = {
  fontFamily: 'var(--font-hand), "Chalkboard SE", system-ui, sans-serif',
};
const ROLE_NAME: Record<string, string> = {
  runner: "Runner",
  supervisor: "Supervisor",
  reviewer: "Reviewer",
  writer: "Writer",
  builder: "Builder",
};
const mins = (m: number) =>
  m < 1
    ? "just now"
    : m < 60
      ? `${m} min`
      : `${Math.floor(m / 60)} h ${m % 60} min`;
const TAG_CSS = `
:where(.aw-paper){background:var(--aw-card);color:var(--aw-ink);border:var(--aw-bw) solid var(--aw-line);border-radius:var(--aw-radius);box-shadow:var(--aw-card-shadow)}
button:where(.aw-paper){background:var(--aw-card)}
.aw-tag.aw-card{flex-direction:column;align-items:flex-start;gap:2px;max-width:260px}
.aw-card b{max-width:220px;white-space:normal;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.aw-zone{display:flex;align-items:baseline;gap:7px;white-space:nowrap}.aw-zone-empty{opacity:.5}
.aw-crayon{background:var(--aw-card);border:1.5px solid var(--aw-line);border-radius:var(--aw-radius);padding:2px 10px 3px;font:700 15px/1.2 var(--font-kalam),"Chalkboard SE",system-ui,sans-serif;box-shadow:2px 2px 0 var(--aw-shadow)}
.aw-crayon span{color:var(--aw-muted);font-weight:400}
@media (max-width:760px){.aw-crayon{font-size:12px;padding:1px 6px 2px}}.aw-crayon.aw-zone-red{border-color:var(--aw-red);color:var(--aw-red-fg)}
.aw-tag{position:absolute;left:0;top:0;white-space:nowrap;will-change:transform;color:var(--aw-ink);font:600 12px/1.2 ui-sans-serif,system-ui,-apple-system,sans-serif}
.aw-card{background:var(--aw-card);border:1.5px solid var(--aw-line);border-radius:var(--aw-radius);padding:3px 9px 4px;box-shadow:2px 2px 0 var(--aw-shadow);display:flex;align-items:center;gap:6px;flex-wrap:wrap;max-width:190px;cursor:pointer;transform-origin:50% 100%}
.aw-card:hover{background:var(--aw-card-hi)}
.aw-card b{font:700 16px/1.1 var(--font-hand),"Chalkboard SE",system-ui,sans-serif;overflow:hidden;text-overflow:ellipsis;max-width:170px}
.aw-card i{display:block;flex-basis:100%;height:4px;border-radius:2px;background:linear-gradient(90deg,var(--aw-bar) var(--done),var(--aw-bar-bg) var(--done));outline:1px solid var(--aw-line)}
.aw-asks{background:var(--aw-red-bg);color:var(--aw-red-fg);border:1.5px solid var(--aw-red);border-radius:999px;padding:0 6px;font:700 11px/16px system-ui,sans-serif}
.aw-act{background:var(--aw-card);border:1px solid var(--aw-line);border-radius:999px;padding:1px 8px;font-size:11.5px;box-shadow:1px 1px 0 var(--aw-shadow)}
.aw-alert{width:30px;height:30px;border-radius:50%;background:var(--aw-red-bg2);border:2.5px solid var(--aw-red);color:var(--aw-red);font:900 19px/25px var(--font-hand),system-ui,sans-serif;text-align:center;margin-left:22px;animation:aw-pop 1s ease-in-out infinite}
@keyframes aw-pop{0%,80%,100%{scale:1}10%{scale:1.25}}
.aw-you{font:800 20px/1 var(--font-hand),system-ui,sans-serif;letter-spacing:.06em;background:var(--aw-card);border:2px solid var(--aw-line);border-radius:var(--aw-radius);padding:3px 10px;box-shadow:2px 2px 0 var(--aw-shadow)}
.aw-sign{background:var(--aw-card);border:1px solid var(--aw-line);border-radius:var(--aw-radius);padding:1px 8px;font-size:11.5px}
@keyframes aw-fade{from{opacity:1}to{opacity:0}}
.aw-fade{animation:aw-fade .7s ease-out forwards}
@media (prefers-reduced-motion:reduce){.aw-alert{animation:none}.aw-fade{animation-duration:.01s}}
@media (max-width:760px){.aw-card:not(:has(.aw-asks)){display:none}.aw-act,.aw-sign{display:none}.aw-card{padding:1px 6px 2px;gap:4px}.aw-card b{font-size:12px;max-width:110px}.aw-you{font-size:14px;padding:2px 7px}}
`;
const ThemeCtx = createContext<Theme>(THEMES.donut);
const pickTheme = (): ThemeId => {
  try {
    const q = new URLSearchParams(window.location.search).get("theme");
    if (isThemeId(q)) return q;
    const l = localStorage.getItem("aw-theme");
    if (isThemeId(l)) return l;
  } catch {}
  return "donut";
};
function Face({
  face,
  crayon,
  grey = false,
  size = 44,
  seed = 1,
  ink,
}: {
  face: Expression;
  crayon: string;
  grey?: boolean;
  size?: number;
  seed?: number;
  ink?: BlobInk;
}) {
  const ref = useRef<HTMLCanvasElement>(null),
    th = useContext(ThemeCtx);
  const use = ink ?? th.blob;
  useEffect(() => {
    const c = ref.current?.getContext("2d");
    if (!c) return;
    const s = 2;
    c.setTransform(s, 0, 0, s, 0, 0);
    c.clearRect(0, 0, size, size * 1.15);
    drawBlob(c, size / 2, size * 0.52, size * 0.66, crayon, face, {
      seed,
      grey,
      ink: use,
      preview: true,
    });
  }, [face, crayon, grey, size, seed, use]);
  return (
    <canvas
      ref={ref}
      width={size * 2}
      height={size * 2.3}
      style={{ width: size, height: size * 1.15 }}
      className="shrink-0"
      aria-hidden
    />
  );
}
export function AgentWorld({ handFont = "" }: { handFont?: string }) {
  const host = useRef<HTMLDivElement>(null),
    scene = useRef<AgentWorldScene | TrayScene | null>(null);
  const [data, setData] = useState<SheetData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pick, setPick] = useState<WorldPick>(null);
  const [panel, setPanel] = useState<"legend" | "tickets" | "themes" | null>(
    null,
  );
  const [themeId, setThemeId] = useState<ThemeId>("donut");
  const th = themeOf(themeId),
    themeRef = useRef(th);
  themeRef.current = th;
  const [fade, setFade] = useState<{
    color: string;
    n: number;
  } | null>(null);
  const [demo, setDemo] = useState(false);
  const [keep, setKeep] = useState<Set<string>>(new Set());
  const [fontReady, setFontReady] = useState(false);
  const [fastUntil, setFastUntil] = useState(0);
  const [hoverCard, setHoverCard] = useState<string | null>(null);
  const [hoverKey, setHoverKey] = useState<string | null>(null);
  const [hoverAt, setHoverAt] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [sound, setSound] = useState(false);
  const [hint, setHint] = useState(false);
  const heard = useRef<Set<string> | null>(null);
  const alertsBox = useRef<HTMLDivElement>(null);
  const [pointers, setPointers] = useState<Pointer[]>([]);
  const [now, setNow] = useState(() => Date.now());
  const loadedAt = useRef(Date.now());
  useEffect(() => {
    setThemeId(pickTheme());
  }, []);
  const isTray = !!th.tray;
  useEffect(() => {
    if (scene.current && scene.current instanceof TrayScene === isTray)
      scene.current.setTheme(th);
  }, [th, isTray]);
  const chooseTheme = (id: ThemeId) => {
    if (id === themeId) return;
    setFade({ color: th.ground.paper, n: Date.now() });
    setThemeId(id);
    try {
      localStorage.setItem("aw-theme", id);
    } catch {}
    const u = new URL(window.location.href);
    if (u.searchParams.has("theme")) {
      u.searchParams.set("theme", id);
      window.history.replaceState(null, "", u);
    }
  };
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    setDemo(q.get("demo") === "1");
    setKeep(
      new Set(
        (q.get("show") ?? "")
          .split(",")
          .map((x) => x.trim())
          .filter(Boolean),
      ),
    );
  }, []);
  useEffect(() => {
    const family = handFont.split(",")[0]?.trim();
    const ready = family
      ? document.fonts.load(`700 48px ${family}`).catch(() => null)
      : Promise.resolve();
    void ready.then(() => setFontReady(true));
    const t = setTimeout(() => setFontReady(true), 2500);
    return () => clearTimeout(t);
  }, [handFont]);
  useEffect(() => {
    let live = true;
    let pending = false;
    let controller: AbortController | null = null;
    const load = async () => {
      if (pending) return;
      pending = true;
      controller = new AbortController();
      const request = controller;
      const timeout = setTimeout(() => request.abort(), 15000);
      try {
        const r = await fetch("/api/worlds", {
          cache: "no-store",
          signal: request.signal,
        });
        if (!r.ok) throw new Error(await r.text());
        const snapshot = (await r.json()) as SheetData;
        if (live) {
          setData(snapshot);
          setError(null);
          loadedAt.current = Date.now();
        }
      } catch (error) {
        if (live)
          setError(
            error instanceof Error
              ? error.message
              : "The agent reports did not load.",
          );
      } finally {
        clearTimeout(timeout);
        pending = false;
      }
    };
    void load();
    const id = setInterval(load, fastUntil > Date.now() ? 5000 : 20000);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const stop =
      fastUntil > Date.now()
        ? setTimeout(() => setFastUntil(0), fastUntil - Date.now())
        : null;
    return () => {
      live = false;
      controller?.abort();
      clearInterval(id);
      clearInterval(tick);
      if (stop) clearTimeout(stop);
    };
  }, [fastUntil]);
  const world = useMemo(() => {
    if (!data?.agents) return null;
    return layoutWorld(demo ? demoMask(data.agents, keep) : data.agents);
  }, [data, demo, keep]);
  const answerHref = safeHref;
  useEffect(() => {
    if (!host.current) return;
    const s = themeRef.current.tray
      ? new TrayScene(host.current, setPick, setHoverKey, themeRef.current)
      : new AgentWorldScene(
          host.current,
          setPick,
          setHoverKey,
          themeRef.current,
        );
    scene.current = s;
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.target as HTMLElement)?.closest("input,textarea,[contenteditable]")
      )
        return;
      if (e.key === "Escape") {
        s.select(null);
        s.home();
        setPick(null);
        setPanel(null);
      } else if (e.key === "h" || e.key === "H") s.home();
      else if (e.key === "?")
        setPanel((p) => (p === "legend" ? null : "legend"));
      else if (e.key === "n" || e.key === "N")
        window.dispatchEvent(new CustomEvent("aw-next"));
      else if (e.key === "t" || e.key === "T")
        window.dispatchEvent(new CustomEvent("aw-theme"));
    };
    window.addEventListener("keydown", onKey);
    const id = setInterval(() => setPointers(s.askerPointers()), 250);
    return () => {
      clearInterval(id);
      window.removeEventListener("keydown", onKey);
      s.dispose();
      scene.current = null;
    };
  }, [isTray]);
  useEffect(() => {
    if (!world || !fontReady) return;
    scene.current?.setInset(
      world.alerts.length > 0 && (host.current?.clientWidth ?? 0) > 900
        ? 352
        : 0,
    );
    scene.current?.setWorld(world);
    setPick((current) => {
      if (!current) return null;
      if (current.kind === "unit") {
        const unit = world.units.find(
          (u) => u.agent.key === current.unit.agent.key,
        );
        return unit ? { kind: "unit", unit } : null;
      }
      const base = world.bases.find((b) => b.name === current.base.name);
      return base ? { kind: "base", base } : null;
    });
  }, [world, fontReady, isTray]);
  const choose = (u: Unit) => {
    scene.current?.select(u.agent.key);
    setPick({ kind: "unit", unit: u });
  };
  useEffect(() => {
    const next = () => {
      const list = world?.alerts ?? [];
      if (!list.length) return;
      const cur =
        pick?.kind === "unit"
          ? list.findIndex((u) => u.agent.key === pick.unit.agent.key)
          : -1;
      choose(list[(cur + 1) % list.length]);
    };
    window.addEventListener("aw-next", next);
    return () => window.removeEventListener("aw-next", next);
  });
  useEffect(() => {
    const next = () =>
      chooseTheme(
        THEME_IDS[(THEME_IDS.indexOf(themeId) + 1) % THEME_IDS.length],
      );
    window.addEventListener("aw-theme", next);
    return () => window.removeEventListener("aw-theme", next);
  });
  useEffect(() => {
    if (!hoverKey) {
      setHoverAt(null);
      return;
    }
    const tick = () => setHoverAt(scene.current?.screenOf(hoverKey) ?? null);
    tick();
    const id = setInterval(tick, 120);
    return () => clearInterval(id);
  }, [hoverKey]);
  useEffect(() => {
    try {
      setSound(localStorage.getItem("aw-sound") === "1");
      setHint(localStorage.getItem("aw-hint") !== "seen");
    } catch {}
  }, []);
  useEffect(() => {
    if (!hint) return;
    const t = setTimeout(() => setHint(false), 9000);
    return () => clearTimeout(t);
  }, [hint]);
  useEffect(() => {
    const keys = new Set((world?.alerts ?? []).map((u) => u.agent.key));
    if (heard.current && sound && [...keys].some((k) => !heard.current!.has(k)))
      chime();
    heard.current = keys;
  }, [world, sound]);
  useEffect(() => {
    const sync = () => {
      const box = alertsBox.current,
        hostEl = host.current;
      if (!scene.current || !hostEl) return;
      scene.current.bottomInset =
        box && hostEl.clientWidth < 760
          ? hostEl.getBoundingClientRect().bottom -
            box.getBoundingClientRect().top
          : 0;
    };
    sync();
    const id = setInterval(sync, 1000);
    return () => clearInterval(id);
  }, [world]);
  const t = world?.totals,
    alerts = world?.alerts ?? [];
  const myTickets = demo
    ? []
    : (data?.tickets ?? []).filter((x) => x.state === "yours");
  const ago = Math.round((now - loadedAt.current) / 1000);
  return (
    <ThemeCtx.Provider value={th}>
      <div
        className="relative h-[calc(100dvh-7.5rem)] min-h-[600px] w-full overflow-hidden rounded-xl border border-[var(--aw-line)] bg-[var(--aw-bg)] text-[var(--aw-ink)] transition-colors duration-500"
        data-theme={th.id}
        style={{ ...th.hud, "--font-hand": th.font } as React.CSSProperties}
      >
        <style>{TAG_CSS}</style>
        <div ref={host} className="absolute inset-0" />

        <div
          className={cn(
            card,
            "absolute left-3 top-3 flex max-w-[calc(100%-1.5rem)] flex-wrap items-stretch gap-x-5 gap-y-2 px-4 py-2.5 tabular-nums max-md:left-2 max-md:right-2 max-md:gap-x-3 max-md:px-2.5 max-md:py-1.5",
          )}
        >
          {data?.sample && (
            <span className="text-xs font-bold">Sample data</span>
          )}
          <Stat
            big={`${t?.agents ?? "–"} agents`}
            small={`for 1 human · ${t?.computers ?? "–"} computers`}
          />
          <Stat
            big={`${(t?.active ?? 0) + (t?.helpers ?? 0)}`}
            small={`at work now${t?.helpers ? ` (${t.helpers} helpers)` : ""}`}
          />
          {t && t.tasksDone > 0 && (
            <Stat big={`${t.tasksDone}`} small="tasks done today" />
          )}
          <div
            className={cn(
              "flex items-center gap-2 rounded-md px-2.5",
              alerts.length
                ? "bg-[var(--aw-red-bg)] text-[var(--aw-red-fg)]"
                : "bg-[var(--aw-ok-bg)] text-[var(--aw-ok-fg)]",
            )}
          >
            {alerts.length ? (
              <Face face="excited" crayon={th.crayons.waiting} size={30} />
            ) : (
              <Face face="smile" crayon={th.crayons.recent} size={30} />
            )}
            <div className="leading-tight">
              <p className="aw-num text-2xl font-bold">
                {alerts.length
                  ? `${alerts.length} need${alerts.length === 1 ? "s" : ""} you`
                  : "All quiet"}
              </p>
              <p className="text-xs font-medium">
                {alerts.length && t?.oldestWait != null
                  ? `oldest waits ${mins(t.oldestWait)}`
                  : "nobody waits for you"}
              </p>
            </div>
          </div>
        </div>

        <div className="absolute right-3 top-3 flex flex-col items-end gap-2 max-lg:hidden">
          {world &&
            world.machines.map((m, i) => (
              <div
                key={m.id}
                className={cn(
                  card,
                  "flex w-[19.5rem] items-center gap-2 px-3 py-1.5 text-sm",
                )}
                style={{ transform: `rotate(${i % 2 ? 0.6 : -0.5}deg)` }}
              >
                <span className={cn("relative flex size-2.5", !m.stale)}>
                  <span
                    className={cn(
                      "relative size-2.5 rounded-full",
                      m.stale ? "bg-[var(--aw-red)]" : "bg-[var(--aw-live)]",
                    )}
                  />
                </span>
                <span className="flex-1 truncate font-medium">{m.name}</span>
                {(() => {
                  const busy = world.units.filter(
                    (u) =>
                      u.agent.machineId === m.id &&
                      (u.agent.state === "running" ||
                        u.agent.state === "waiting"),
                  ).length;
                  return m.stale ? (
                    <span className="rounded-full bg-[var(--aw-red-bg)] px-2 text-xs font-semibold text-[var(--aw-red-fg)]">
                      silent
                    </span>
                  ) : (
                    <span
                      className="rounded-full px-2 text-xs font-semibold"
                      style={
                        busy
                          ? { background: th.crayons.running, color: "#2f2a26" }
                          : {
                              background: "var(--aw-hover)",
                              color: "var(--aw-muted)",
                            }
                      }
                    >
                      {busy ? `busy · ${busy}` : "idle"}
                    </span>
                  );
                })()}
                <span className="w-12 text-right text-xs tabular-nums text-[var(--aw-muted)]">
                  {m.stale ? "" : ago < 3 ? m.seen : `${ago}s ago`}
                </span>
              </div>
            ))}
        </div>

        {alerts.length > 0 && (
          <div
            ref={alertsBox}
            className="absolute left-3 top-24 flex w-[20.5rem] max-w-[calc(100%-1.5rem)] flex-col gap-2 max-md:bottom-16 max-md:left-2 max-md:right-2 max-md:top-auto max-md:w-auto"
          >
            {alerts.slice(0, 4).map((u, i) => (
              <div
                key={u.agent.key}
                data-card={u.agent.key}
                className={cn(
                  card,
                  i > 0,
                  "border-2 border-l-[6px] border-[var(--aw-red)] p-3",
                )}
                style={{ transform: `rotate(${i % 2 ? 0.4 : -0.4}deg)` }}
                onMouseEnter={() => setHoverCard(u.agent.key)}
                onMouseLeave={() => setHoverCard(null)}
              >
                <button
                  className="flex w-full gap-3 text-left"
                  onClick={() => choose(u)}
                >
                  <Face
                    face={lookOf(u.agent, th.crayons).face}
                    crayon={th.crayons.waiting}
                    size={48}
                    seed={i + 2}
                  />
                  <span className="min-w-0">
                    <span className="block truncate whitespace-nowrap text-xs text-[var(--aw-muted)]">
                      <b className="aw-hand text-[var(--aw-ink)]" style={hand}>
                        {u.base}
                      </b>{" "}
                      · waits {mins(u.agent.minutes)} · {u.agent.machine}
                    </span>
                    <span className="mt-0.5 line-clamp-3 block text-[15px] font-medium leading-snug">
                      {u.agent.say}
                    </span>
                  </span>
                </button>
                <div className="mt-2 flex gap-2">
                  {answerHref(u.agent.href) ? (
                    <Link
                      href={answerHref(u.agent.href)}
                      target="_blank"
                      onClick={() => setFastUntil(Date.now() + 60000)}
                      className="aw-cta inline-flex items-center gap-1 rounded-md bg-[var(--aw-ink)] px-3 py-1.5 text-sm font-semibold text-[var(--aw-card)] hover:opacity-90"
                    >
                      Answer <ArrowUpRightIcon className="size-3.5" />
                    </Link>
                  ) : (
                    <span
                      className="inline-flex items-center rounded-md border border-dashed border-[var(--aw-line)] px-3 py-1.5 text-sm text-[var(--aw-muted)]"
                      title={
                        demo ? "Hidden in demo mode" : "This agent has no link"
                      }
                    >
                      {demo ? "Private" : "No link"}
                    </span>
                  )}
                  <button
                    className="rounded-md border border-[var(--aw-line)] px-3 py-1.5 text-sm hover:bg-[var(--aw-hover)]"
                    onClick={() => choose(u)}
                  >
                    Show me
                  </button>
                </div>
              </div>
            ))}
            {alerts.length > 4 && (
              <p className={cn(card, "px-3 py-1.5 text-sm max-md:hidden")}>
                +{alerts.length - 4} more wait at your post
              </p>
            )}
            {alerts.length > 1 && (
              <button
                className={cn(
                  card,
                  "aw-btn px-3 py-1.5 text-sm font-semibold md:hidden",
                )}
                onClick={() => window.dispatchEvent(new CustomEvent("aw-next"))}
              >
                1 of {alerts.length} · next one waiting →
              </button>
            )}
          </div>
        )}

        {hoverCard &&
          (() => {
            const p = pointers.find((q) => q.key === hoverCard),
              el = host.current?.querySelector(
                `[data-card="${CSS.escape(hoverCard)}"]`,
              ) as HTMLElement | null,
              hr = host.current?.getBoundingClientRect();
            if (!p || !el || !hr || !p.onScreen) return null;
            const r = el.getBoundingClientRect(),
              x1 = r.right - hr.left,
              y1 = r.top - hr.top + r.height / 2;
            return (
              <svg
                className="pointer-events-none absolute inset-0 h-full w-full"
                aria-hidden
              >
                <path
                  d={`M${x1} ${y1} C ${x1 + 80} ${y1}, ${p.x - 80} ${p.y - 40}, ${p.x} ${p.y - 30}`}
                  fill="none"
                  style={{ stroke: "var(--aw-red)" }}
                  strokeWidth="2.5"
                  strokeDasharray="7 6"
                  strokeLinecap="round"
                />
                <circle
                  cx={p.x}
                  cy={p.y - 30}
                  r="5"
                  style={{ fill: "var(--aw-red)" }}
                />
              </svg>
            );
          })()}

        {pointers
          .filter((p) => !p.onScreen)
          .map((p) => {
            const W = host.current?.clientWidth ?? 1,
              H = host.current?.clientHeight ?? 1,
              x = Math.min(W - 28, Math.max(28, p.x)),
              y = Math.min(H - 28, Math.max(96, p.y)),
              a = Math.atan2(p.y - H / 2, p.x - W / 2);
            const u = alerts.find((q) => q.agent.key === p.key);
            return (
              <button
                key={p.key}
                className="absolute flex size-10 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-[var(--aw-red)] bg-[var(--aw-red-bg2)] text-lg font-black text-[var(--aw-red)] shadow"
                style={{ left: x, top: y }}
                onClick={() => u && choose(u)}
                aria-label="An agent needs you over there"
              >
                <span style={{ transform: `rotate(${a}rad)` }}>➜</span>
              </button>
            );
          })}

        {hoverKey &&
          hoverAt &&
          (() => {
            const u = world?.units.find((x) => x.agent.key === hoverKey);
            if (
              !u ||
              (pick?.kind === "unit" && pick.unit.agent.key === hoverKey)
            )
              return null;
            const l = lookOf(u.agent, th.crayons);
            return (
              <div
                className={cn(
                  card,
                  "pointer-events-none absolute z-10 w-64 p-2.5 text-xs",
                )}
                style={{
                  left: Math.min(
                    hoverAt.x + 18,
                    (host.current?.clientWidth ?? 800) - 270,
                  ),
                  top: Math.max(8, hoverAt.y - 20),
                }}
              >
                <p className="flex items-center gap-2">
                  <span
                    className="size-2.5 shrink-0 rounded-full border border-[var(--aw-line)]"
                    style={{ background: l.grey ? th.blob.ghost : l.crayon }}
                  />
                  <b className="truncate text-[13px]" style={hand}>
                    {u.agent.title}
                  </b>
                </p>
                <p className="mt-0.5 text-[var(--aw-muted)]">
                  {u.base} · {u.agent.machine} · {STATE_LABEL[u.agent.state]} ·{" "}
                  {u.agent.age}
                </p>
                <p className="mt-1 line-clamp-3 leading-snug">{u.agent.say}</p>
                <p className="mt-1 text-[var(--aw-faint)]">
                  Click for the card
                </p>
              </div>
            );
          })()}

        {hint && data && !demo && panel !== "themes" && (
          <div
            className={cn(
              card,
              "absolute bottom-3 left-3 flex max-w-[calc(100%-1.5rem)] items-center gap-3 px-3 py-2 text-[13px] md:max-w-[36rem] max-md:bottom-auto max-md:top-[9.25rem] max-md:text-xs",
            )}
          >
            <span>
              <b style={hand}>Faces are agents.</b> Colour = what it does ·
              island = project · press{" "}
              <kbd className="rounded border px-1">N</kbd> for who needs you,{" "}
              <kbd className="rounded border px-1">?</kbd> for who is who.
            </span>
            <button
              className="shrink-0 rounded-md bg-[var(--aw-ink)] px-2.5 py-1 text-xs font-semibold text-[var(--aw-card)]"
              onClick={() => {
                setHint(false);
                try {
                  localStorage.setItem("aw-hint", "seen");
                } catch {}
              }}
            >
              OK
            </button>
          </div>
        )}

        {pick && (
          <div
            className={cn(
              card,
              "absolute bottom-16 right-3 w-[22rem] max-w-[calc(100%-1.5rem)] p-4 text-sm",
            )}
            style={{ transform: "rotate(0.4deg)" }}
          >
            <button
              className="absolute right-2 top-2 rounded p-1 text-[var(--aw-muted)] hover:bg-[var(--aw-hover)]"
              onClick={() => {
                scene.current?.select(null);
                setPick(null);
              }}
              aria-label="Close"
            >
              <XIcon className="size-4" />
            </button>
            {pick.kind === "unit" ? (
              <UnitCard u={pick.unit} href={answerHref(pick.unit.agent.href)} />
            ) : (
              <div className="space-y-2">
                <p className="pr-6 text-xl font-bold" style={hand}>
                  {pick.base.name}
                </p>
                <p className="text-xs text-[var(--aw-muted)]">
                  {pick.base.health
                    .map((h) => `${h.n} ${STATE_LABEL[h.state]}`)
                    .join(" · ")}{" "}
                  · {pick.base.machines.join(", ")}
                </p>
                <ul className="max-h-64 space-y-1 overflow-y-auto">
                  {world?.units
                    .filter((u) => u.base === pick.base.name)
                    .map((u, i) => {
                      const l = lookOf(u.agent, th.crayons);
                      return (
                        <li key={u.agent.key}>
                          <button
                            className="flex w-full items-center gap-2 rounded-md px-1.5 py-1 text-left hover:bg-[var(--aw-hover)]"
                            onClick={() => choose(u)}
                          >
                            <Face
                              face={l.face}
                              crayon={l.crayon}
                              grey={l.grey}
                              size={28}
                              seed={i + 1}
                            />
                            <span className="min-w-0">
                              <span className="block truncate font-medium">
                                {u.agent.title}
                              </span>
                              <span className="block truncate text-xs text-[var(--aw-muted)]">
                                {STATE_LABEL[u.agent.state]} · {u.agent.action}{" "}
                                · {u.agent.machine}
                              </span>
                            </span>
                          </button>
                        </li>
                      );
                    })}
                </ul>
              </div>
            )}
          </div>
        )}

        {panel === "legend" && <Legend world={world} />}
        {panel === "tickets" && (
          <div
            className={cn(
              card,
              "absolute bottom-16 right-3 w-80 max-w-[calc(100%-1.5rem)] p-3 text-sm",
            )}
          >
            <p className="pb-1 text-xs font-semibold uppercase tracking-wide text-[var(--aw-muted)]">
              Personal tickets on your desk
            </p>
            {myTickets.length === 0 ? (
              <p className="text-[var(--aw-muted)]">
                {demo ? "Hidden in demo mode." : "Nothing waits on you."}
              </p>
            ) : (
              <ul className="max-h-64 space-y-1 overflow-y-auto">
                {myTickets.map((x) => (
                  <li key={x.href}>
                    <Link
                      className="block rounded-md px-2 py-1 hover:bg-[var(--aw-hover)]"
                      href={x.href}
                    >
                      <span className="block">{x.title}</span>
                      <span className="text-xs text-[var(--aw-muted)]">
                        {x.note}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="absolute bottom-3 right-3 z-10 flex flex-wrap justify-end gap-2 max-md:left-2 max-md:right-2 max-md:justify-between max-md:gap-1">
          <Btn onClick={() => scene.current?.home()} icon={HomeIcon}>
            Home
          </Btn>
          <Btn
            onClick={() => setPanel(panel === "themes" ? null : "themes")}
            icon={PaletteIcon}
            on={panel === "themes"}
          >
            {th.name}
          </Btn>
          <Btn
            onClick={() => setPanel(panel === "legend" ? null : "legend")}
            icon={InfoIcon}
            on={panel === "legend"}
          >
            Who is who
          </Btn>
          <Btn
            onClick={() => setPanel(panel === "tickets" ? null : "tickets")}
            icon={TicketIcon}
            on={panel === "tickets"}
          >
            My tickets{myTickets.length ? ` · ${myTickets.length}` : ""}
          </Btn>
          <Btn
            onClick={() => {
              const on = !sound;
              setSound(on);
              try {
                localStorage.setItem("aw-sound", on ? "1" : "0");
              } catch {}
              if (on) chime();
            }}
            icon={sound ? Volume2Icon : VolumeXIcon}
            on={sound}
          >
            {sound ? "Sound on" : "Sound"}
          </Btn>
          <Btn
            onClick={() => {
              const d = !demo;
              setDemo(d);
              setPick(null);
              const u = new URL(window.location.href);
              if (d) u.searchParams.set("demo", "1");
              else u.searchParams.delete("demo");
              window.history.replaceState(null, "", u);
            }}
            icon={EyeOffIcon}
            on={demo}
          >
            {demo ? "Names hidden" : "Hide names"}
          </Btn>
        </div>

        {panel === "themes" && (
          <>
            <button
              aria-label="Close the themes"
              className="absolute inset-0 z-[5]"
              style={{ background: "rgba(0,0,0,.28)" }}
              onClick={() => setPanel(null)}
            />
            <ThemePicker current={th.id} onPick={chooseTheme} />
          </>
        )}

        {fade && (
          <div
            key={fade.n}
            className="aw-fade pointer-events-none absolute inset-0 z-20"
            style={{ background: fade.color }}
            onAnimationEnd={() => setFade(null)}
          />
        )}

        {(error || !data) && (
          <p
            className={cn(
              card,
              "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-3 text-sm",
            )}
          >
            {error ?? "Reading the agent reports…"}
          </p>
        )}
        {world && world.units.length === 0 && (
          <p
            className={cn(
              card,
              "absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 px-4 py-3 text-sm",
            )}
          >
            No agent was active today. Check that the reporter runs on each
            computer.
          </p>
        )}
      </div>
    </ThemeCtx.Provider>
  );
}
function chime() {
  try {
    const A = new (
      window.AudioContext ||
      (
        window as unknown as {
          webkitAudioContext: typeof AudioContext;
        }
      ).webkitAudioContext
    )();
    [659.25, 987.77].forEach((f, i) => {
      const o = A.createOscillator(),
        g = A.createGain(),
        t = A.currentTime + i * 0.16;
      o.type = "sine";
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      o.connect(g).connect(A.destination);
      o.start(t);
      o.stop(t + 1);
    });
    setTimeout(() => void A.close(), 1600);
  } catch {}
}
function Stat({ big, small }: { big: string; small: string }) {
  return (
    <div className="leading-tight">
      <p className="aw-num text-2xl font-bold">{big}</p>
      <p className="text-xs text-[var(--aw-muted)]">{small}</p>
    </div>
  );
}
function Btn({
  children,
  onClick,
  icon: I,
  on = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  icon: React.ComponentType<{
    className?: string;
  }>;
  on?: boolean;
}) {
  return (
    <button
      className={cn(
        card,
        "aw-btn flex items-center gap-1.5 px-3 py-2 text-sm font-medium hover:bg-[var(--aw-hover)] max-md:px-2.5",
        on,
      )}
      onClick={onClick}
      aria-pressed={on}
      title={typeof children === "string" ? children : undefined}
    >
      <I className="size-4" />
      <span className="max-md:hidden">{children}</span>
    </button>
  );
}
function UnitCard({ u, href }: { u: Unit; href: string }) {
  const th = useContext(ThemeCtx),
    a = u.agent,
    l = lookOf(a, th.crayons),
    ask = a.state === "waiting";
  return (
    <div className="space-y-2.5">
      <div className="flex gap-3 pr-6">
        <Face
          face={l.face}
          crayon={l.crayon}
          grey={l.grey}
          size={56}
          seed={3}
        />
        <div className="min-w-0">
          <p className="text-[15px] font-semibold leading-snug">{a.title}</p>
          <p className="text-xs text-[var(--aw-muted)]">
            <span style={hand}>{u.base}</span> · {a.machine}
          </p>
          <p className="mt-1">
            <span
              className={cn(
                "rounded-full border px-2 py-0.5 text-xs font-semibold",
                ask
                  ? "border-[var(--aw-red)] bg-[var(--aw-red-bg)] text-[var(--aw-red-fg)]"
                  : "border-[var(--aw-line)]",
              )}
              style={
                ask
                  ? undefined
                  : { background: l.grey ? th.blob.ghost : l.crayon }
              }
            >
              {ask
                ? `needs you · ${mins(a.minutes)}`
                : `${STATE_LABEL[a.state]} · ${a.action}`}
            </span>
          </p>
        </div>
      </div>
      <p className={cn("text-[15px] leading-snug", ask)}>{a.say}</p>
      <dl className="grid grid-cols-[6.5rem_1fr] gap-x-2 gap-y-0.5 text-xs text-[var(--aw-text2)]">
        <dt className="text-[var(--aw-faint)]">Role</dt>
        <dd>{ROLE_NAME[a.role] ?? a.role}</dd>
        <dt className="text-[var(--aw-faint)]">Tool</dt>
        <dd>{a.source === "codex" ? "Codex" : "Claude Code"}</dd>
        <dt className="text-[var(--aw-faint)]">Last active</dt>
        <dd>{a.age}</dd>
        {a.tasks && (
          <>
            <dt className="text-[var(--aw-faint)]">Tasks</dt>
            <dd>{a.tasks}</dd>
          </>
        )}
        {a.helpers > 0 && (
          <>
            <dt className="text-[var(--aw-faint)]">Helpers</dt>
            <dd>{a.helpers} at work</dd>
          </>
        )}
      </dl>
      {href && (
        <Link
          className="aw-cta inline-flex items-center gap-1 rounded-md bg-[var(--aw-ink)] px-3 py-1.5 text-sm font-semibold text-[var(--aw-card)] hover:opacity-90"
          href={href}
          target="_blank"
        >
          {ask ? "Answer" : "Open"} in your system{" "}
          <ArrowUpRightIcon className="size-3.5" />
        </Link>
      )}
    </div>
  );
}
function Legend({ world }: { world: World | null }) {
  const th = useContext(ThemeCtx);
  if (th.tray) return <TrayLegend world={world} />;
  const cast: {
    face: Expression;
    crayon: string;
    label: string;
    note: string;
  }[] = [
    {
      face: "excited",
      crayon: th.crayons.waiting,
      label: "Needs you",
      note: `waves; cross after ${ANGRY_AFTER_MINUTES} min`,
    },
    {
      face: "smile",
      crayon: th.crayons.running,
      label: "Working",
      note: "laptop, hops",
    },
    {
      face: "calm",
      crayon: th.crayons.scheduled,
      label: "Looping",
      note: "runs again by itself",
    },
    {
      face: "smile",
      crayon: th.crayons.recent,
      label: "Just done",
      note: "in the last hour",
    },
    {
      face: "sleep",
      crayon: th.crayons.resting,
      label: "Resting",
      note: "idle over an hour",
    },
  ];
  return (
    <div
      className={cn(
        card,
        "absolute bottom-16 right-3 w-[24rem] max-w-[calc(100%-1.5rem)] p-4 text-xs",
      )}
    >
      <p className="pb-2 text-lg font-bold" style={hand}>
        Who is who
      </p>
      <ul className="grid grid-cols-3 gap-x-2 gap-y-3">
        {cast.map((c, i) => (
          <li key={c.label} className="flex flex-col items-center text-center">
            <Face face={c.face} crayon={c.crayon} size={46} seed={i + 5} />
            <b className="mt-0.5 text-[13px]">{c.label}</b>
            <span className="text-[var(--aw-muted)]">{c.note}</span>
          </li>
        ))}
      </ul>
      <p className="mt-3 border-t border-dashed border-[var(--aw-line)]/40 pt-2">
        Ring on the ground: the computer (
        {(world?.machines ?? []).map((m, i) => (
          <span key={m.id} className="mx-0.5 inline-flex items-center gap-1">
            <svg width="14" height="10">
              <circle
                cx="7"
                cy="5"
                r="4"
                fill="none"
                style={{ stroke: "var(--aw-line)" }}
                strokeWidth="1.6"
                strokeDasharray={i === 0 ? undefined : i === 1 ? "2 2" : "1 2"}
              />
            </svg>
            {m.name}
          </span>
        ))}
        ). Pencil only: its computer is silent.
      </p>
    </div>
  );
}
function TrayLegend({ world }: { world: World | null }) {
  const th = useContext(ThemeCtx),
    crayon = th.tray === "crayon",
    colors = projectColors(world, crayon);
  const kinds: {
    label: string;
    note: string;
    fill: React.ReactNode;
  }[] = [
    {
      label: "Swirl",
      note: "runs jobs",
      fill: (
        <path
          d="M5 15c3-8 6 4 14-6"
          stroke="#2f6fe0"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
        />
      ),
    },
    {
      label: "Cat's eye",
      note: "builds",
      fill: (
        <path
          d="M5 12h14M7 7l10 10M7 17 17 7"
          stroke="#2f6fe0"
          strokeWidth="2"
          strokeLinecap="round"
        />
      ),
    },
    {
      label: "Onyx",
      note: "reviews, writes",
      fill: (
        <>
          <circle cx="12" cy="12" r="9" fill="#2f6fe0" />
          <path
            d="M3.5 13.5c5 2 12 2 17-1"
            stroke="#f5efe4"
            strokeWidth="1.6"
            fill="none"
          />
        </>
      ),
    },
    {
      label: "Steel",
      note: "supervises",
      fill: (
        <>
          <circle cx="12" cy="12" r="9" fill="#cfd1d6" />
          <path d="M3 12h18" stroke="#2f6fe0" strokeWidth="2.4" />
        </>
      ),
    },
  ];
  return (
    <div
      className={cn(
        card,
        "absolute bottom-16 right-3 w-[24rem] max-w-[calc(100%-1.5rem)] p-4 text-xs",
      )}
    >
      <p className="pb-1 text-lg font-bold" style={hand}>
        Who is who
      </p>
      <p className="pb-3 text-[var(--aw-muted)]">
        {crayon ? "Each tile" : "Each bowl"} is a state. When an agent&apos;s
        state changes, its marble rolls to the new {crayon ? "tile" : "bowl"}. A
        bigger marble has done more tasks.
      </p>
      {crayon ? (
        <ul className="grid grid-cols-3 gap-2 pb-3">
          {(
            [
              ["excited", "Needs you"],
              ["smile", "Working"],
              ["calm", "Looping"],
              ["sleep", "Resting"],
              ["frown", "No signal"],
            ] as const
          ).map(([f, l], i) => (
            <li key={l} className="flex flex-col items-center text-center">
              <Face face={f} crayon="#f8d98a" size={40} seed={i + 3} />
              <b className="mt-0.5 text-[13px]">{l}</b>
            </li>
          ))}
        </ul>
      ) : (
        <ul className="grid grid-cols-4 gap-2 pb-3">
          {kinds.map((x) => (
            <li
              key={x.label}
              className="flex flex-col items-center text-center"
            >
              <svg width="30" height="30" viewBox="0 0 24 24">
                <circle
                  cx="12"
                  cy="12"
                  r="10"
                  fill="rgba(255,255,255,.12)"
                  stroke="rgba(255,255,255,.45)"
                />
                {x.fill}
              </svg>
              <b className="mt-1 text-[13px]">{x.label}</b>
              <span className="text-[var(--aw-muted)]">{x.note}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="border-t border-[var(--aw-line)] pt-2 pb-1.5 font-semibold">
        Colour = project
      </p>
      <ul className="flex flex-wrap gap-x-3 gap-y-1">
        {[...colors].map(([name, c]) => (
          <li key={name} className="flex items-center gap-1.5">
            <span
              className="size-2.5 rounded-full border border-black/10"
              style={{ background: c }}
            />
            {name}
          </li>
        ))}
      </ul>
    </div>
  );
}
function ThemePicker({
  current,
  onPick,
}: {
  current: ThemeId;
  onPick: (id: ThemeId) => void;
}) {
  return (
    <div
      className={cn(
        card,
        "absolute bottom-16 right-3 z-10 w-[30rem] max-w-[calc(100%-1.5rem)] p-3 text-xs shadow-[0_12px_32px_rgba(0,0,0,.3)]",
      )}
    >
      <p className="pb-2 text-lg font-bold" style={hand}>
        Theme{" "}
        <span className="text-xs font-normal text-[var(--aw-muted)]">
          · press T to change
        </span>
      </p>
      <div className="max-h-[calc(100dvh-14rem)] space-y-3 overflow-y-auto pr-1">
        {(["Blobs"] as const).map((shelf) => {
          const ids = THEME_IDS.filter((id) => THEMES[id].group === shelf);
          return (
            <div key={shelf}>
              <p className="pb-1.5 text-[10px] font-semibold uppercase tracking-[.18em] text-[var(--aw-muted)]">
                {shelf}
              </p>
              <ul
                className={cn(
                  "grid gap-2",
                  ids.length === 2
                    ? "grid-cols-2"
                    : ids.length === 4
                      ? "grid-cols-4"
                      : "grid-cols-3",
                )}
              >
                {ids.map((id) => {
                  const t = THEMES[id],
                    on = id === current;
                  return (
                    <li key={id}>
                      <button
                        onClick={() => onPick(id)}
                        aria-pressed={on}
                        className={cn(
                          "flex w-full flex-col items-start gap-1 overflow-hidden px-2.5 py-2 text-left outline-offset-2",
                          "relative",
                          on,
                        )}
                        style={{
                          background: `linear-gradient(90deg, ${t.ground.paper} 0 6px, ${t.hud["--aw-card"]} 6px)`,
                          color: t.hud["--aw-ink"],
                          border: `1px solid ${t.hud["--aw-line"]}`,
                          borderRadius: Math.min(
                            12,
                            parseInt(t.hud["--aw-radius"]) || 0,
                          ),
                        }}
                      >
                        <span className="flex shrink-0 -space-x-2">
                          {(["running", "waiting", "resting"] as const).map(
                            (st, i) => (
                              <Face
                                key={st}
                                face={
                                  st === "waiting"
                                    ? "excited"
                                    : st === "resting"
                                      ? "sleep"
                                      : "smile"
                                }
                                crayon={t.crayons[st]}
                                size={24}
                                seed={i + 4}
                                ink={t.blob}
                              />
                            ),
                          )}
                        </span>
                        {on && (
                          <span
                            className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-[var(--aw-ink)] text-[10px] font-black text-[var(--aw-card)]"
                            aria-hidden
                          >
                            ✓
                          </span>
                        )}
                        <span className="w-full min-w-0">
                          <b
                            className="block text-[14px]"
                            style={{ fontFamily: t.font }}
                          >
                            {t.name}
                          </b>
                          <span className="line-clamp-2 block leading-tight opacity-80">
                            {t.note}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[var(--aw-muted)]">
        Only the look changes: the face and colour still say what each agent
        does.
      </p>
    </div>
  );
}
