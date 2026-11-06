"use client";
import { CopyScope, useSiteContent } from "@/components/content-provider";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { ContentTools } from "./content-tools";
import {
  House,
  LayoutGrid,
  Lightbulb,
  CheckCheck,
  FolderKanban,
  Wallet,
  Heart,
  CalendarDays,
  Wrench,
  Files,
  Search,
  Plus,
  ArrowUpRight,
  ArrowRight,
  ChevronRight,
  Bell,
  Settings,
  LogOut,
  Leaf,
  Menu,
  X,
  Check,
  Users,
  Download,
  MoreHorizontal,
  Upload,
  Trash2,
  ExternalLink,
  MessageCircle,
  CheckCircle2,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "./ui/button";
import { Dialog } from "./ui/dialog";
import { Editor, labels, statuses } from "./editor";
import {
  entities,
  type Snapshot,
  type Entity,
  type RecordData,
  type Child,
} from "@/lib/types";
import { browserClient } from "@/lib/supabase/client";
import {
  authenticate,
  setupHousehold,
  signout,
  invite,
  saveRecord,
  removeRecord,
  completeMaintenance,
  convertIdea,
  addChild,
  toggleChild,
  uploadFile,
  fileURL,
  settle,
  reverseFinancial,
  linkPurchase,
  deleteDocument,
  realtimeToken,
} from "@/lib/actions";
import { openPrivateFile } from "@/lib/open-file";
import { expensesCSV } from "@/lib/domain/export";
import { euro, balance, cents } from "@/lib/domain/finance";
import { today } from "@/lib/domain/dates";
import { FinanceChart } from "./finance-chart";
import dynamic from "next/dynamic";
const CalendarView = dynamic(() => import("./calendar"), {
  ssr: false,
  loading: () => <div className="skeleton calendar-skeleton" />,
});
type View = "home" | Entity | "activity";
const navigation: {
  key: View;
  label: string;
  icon: LucideIcon;
  section?: string;
}[] = [
  { key: "home", label: "Overzicht", icon: House },
  { key: "rooms", label: "Kamers", icon: LayoutGrid },
  { key: "ideas", label: "Inspiratie", icon: Lightbulb },
  {
    key: "tasks",
    label: "Taken",
    icon: CheckCheck,
    section: "SAMEN AAN DE SLAG",
  },
  { key: "projects", label: "Projecten", icon: FolderKanban },
  { key: "expenses", label: "Financiën", icon: Wallet },
  { key: "wishlist_items", label: "Verlanglijst", icon: Heart },
  {
    key: "calendar_events",
    label: "Planning",
    icon: CalendarDays,
    section: "GOED GEREGELD",
  },
  { key: "maintenance_items", label: "Onderhoud", icon: Wrench },
  { key: "documents", label: "Woningdossier", icon: Files },
];
const titles: Record<View, string> = {
  home: "Hé, wat pakken we aan?",
  rooms: "Jullie kamers",
  ideas: "Inspiratie",
  tasks: "Jullie taken",
  projects: "Projecten",
  expenses: "Financiën",
  wishlist_items: "Verlanglijst",
  calendar_events: "Planning",
  maintenance_items: "Onderhoud",
  documents: "Woningdossier",
  budgets: "Ruimte in jullie budget.",
  savings_goals: "Samen ergens naartoe.",
  activity: "Wat er thuis gebeurt.",
  suppliers: "Fijne mensen voor jullie plannen.",
};
const descriptions: Record<View, string> = {
  home: "Taken, plannen en geldzaken. Samen geregeld.",
  rooms: "Ontdek, organiseer en maak elke kamer een beetje meer van jullie.",
  ideas:
    "Verzamel wat jullie raakt. Droom, bespreek en maak het werkelijkheid.",
  tasks: "Zie wat er moet gebeuren, voor wie en wanneer.",
  projects: "Een overzicht van jullie grotere plannen en de stappen ernaartoe.",
  expenses: "Jullie uitgaven, budgetten en verrekeningen. Eerlijk verdeeld.",
  wishlist_items: "Mooie vondsten voor later. Of voor binnenkort.",
  calendar_events:
    "Klusdagen, leveringen en afspraken, in één gezamenlijke agenda.",
  maintenance_items: "Goed onderhoud begint met een rustig overzicht.",
  documents: "Van de eerste offerte tot dat ene garantiebewijs.",
  budgets: "Geef jullie plannen een financieel kader.",
  savings_goals: "Maak ruimte voor de volgende grote wens.",
  activity: "De laatste stappen die jullie samen hebben gezet.",
  suppliers: "Contactgegevens en afspraken, bij het juiste project.",
};
const dateLabel = (d?: string | null) =>
  d
    ? new Intl.DateTimeFormat("nl-NL", {
        day: "numeric",
        month: "short",
        timeZone: "Europe/Amsterdam",
      }).format(new Date(d))
    : "Geen datum";
const cardImages: Partial<Record<Entity, string>> = {
  rooms: "/room.svg",
  ideas: "/inspiration.svg",
  projects: "/room.svg",
  wishlist_items: "/inspiration.svg",
};
export function App({
  data,
  initialView = "home",
  initialToken = "",
  weekEnd,
}: {
  data: Snapshot;
  initialView?: string;
  initialToken?: string;
  weekEnd: string;
}) {
  const { canEdit: canEditCopy, text: copy } = useSiteContent();

  const router = useRouter();
  const [view, setView] = useState<View>(
    initialView in titles ? (initialView as View) : "home",
  );
  const [search, setSearch] = useState("");
  const [roomFilter, setRoomFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [personFilter, setPersonFilter] = useState("");
  const [taskMode, setTaskMode] = useState("Lijst");
  const [showMenu, setShowMenu] = useState(false);
  const [auth, setAuth] = useState(Boolean(initialToken));
  const [settings, setSettings] = useState(false);
  const [quick, setQuick] = useState(false);
  const [editor, setEditor] = useState<{
    entity: Entity;
    record?: RecordData;
    linkedRoom?: string;
    linkedProject?: string;
    purchase?: RecordData;
  } | null>(null);
  const [detail, setDetail] = useState<{
    entity: Entity;
    record: RecordData;
  } | null>(null);
  const [toast, setToast] = useState("");
  const [pending, startTransition] = useTransition();
  const [invitation] = useState(initialToken);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [globalSearch, setGlobalSearch] = useState(false);
  const [globalQuery, setGlobalQuery] = useState("");
  const [liveStatus, setLiveStatus] = useState("Verbinden");
  const h = data.household?.id;
  const notify = (s: string) => {
    setToast(s);
  };
  const go = (v: View) => {
    setView(v);
    setSearch("");
    setRoomFilter("");
    setStatusFilter("");
    setPersonFilter("");
    setShowMenu(false);
    window.history.pushState(null, "", `/?view=${v}`);
  };
  const mutate = (fn: () => Promise<unknown>, message = "Opgeslagen.") => {
    startTransition(async () => {
      try {
        await fn();
        notify(message);
        router.refresh();
      } catch (e) {
        notify(e instanceof Error ? e.message : "Er ging iets mis.");
      }
    });
  };
  const create = (
    entity: Entity,
    extra?: {
      linkedRoom?: string;
      linkedProject?: string;
      purchase?: RecordData;
    },
  ) => {
    setQuick(false);
    if (!data.user) {
      setAuth(true);
      return;
    }
    if (!h) {
      setAuth(true);
      return;
    }
    setEditor({ entity, ...extra });
  };
  useEffect(() => {
    if ("serviceWorker" in navigator)
      navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  useEffect(() => {
    const restore = () => {
      const v = new URLSearchParams(window.location.search).get("view");
      setView(v && v in titles ? (v as View) : "home");
    };
    window.addEventListener("popstate", restore);
    return () => window.removeEventListener("popstate", restore);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 6000);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    if (!h) return;
    const db = browserClient();
    const channel = db.channel(`home:${h}`);
    let refreshTimer: ReturnType<typeof setTimeout>;
    for (const table of [
      ...entities,
      "activity_log",
      "idea_comments",
      "task_comments",
      "task_subtasks",
      "project_phases",
      "maintenance_history",
      "room_photos",
      "idea_photos",
      "project_photos",
      "task_photos",
      "settlements",
    ]) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `household_id=eq.${h}` },
        () => {
          clearTimeout(refreshTimer);
          refreshTimer = setTimeout(() => router.refresh(), 120);
        },
      );
    }
    const subscribe = () =>
      channel.subscribe((status) => {
        setLiveStatus(
          status === "SUBSCRIBED"
            ? "Live"
            : status === "CHANNEL_ERROR" || status === "TIMED_OUT"
              ? "Offline"
              : "Verbinden",
        );
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT")
          setToast(
            "Live verbinding onderbroken. Vernieuw om wijzigingen op te halen.",
          );
      });
    let cancelled = false;
    const refreshAuth = async () => {
      const token = await realtimeToken(h);
      if (!cancelled) await db.realtime.setAuth(token);
    };
    void refreshAuth()
      .then(() => {
        if (!cancelled) subscribe();
      })
      .catch(() => {
        if (!cancelled) {
          setLiveStatus("Offline");
          setToast("Live sessie kon niet worden geopend. Log opnieuw in.");
        }
      });
    const refreshVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", refreshVisible);
    const snapshotTimer = setInterval(refreshVisible, 45_000);
    const authTimer = setInterval(
      () => {
        void refreshAuth().catch(() => {
          if (!cancelled) setLiveStatus("Offline");
        });
      },
      10 * 60 * 1000,
    );
    return () => {
      cancelled = true;
      clearInterval(authTimer);
      clearInterval(snapshotTimer);
      document.removeEventListener("visibilitychange", refreshVisible);
      clearTimeout(refreshTimer);
      void db.removeChannel(channel);
    };
  }, [h, router]);
  const r = data.records;
  const tasks = r.tasks.filter((t) => t.status !== "Afgerond");
  const expenses = r.expenses.filter((e) => !e.reversed_at);
  const total = expenses.reduce((n, e) => n + (e.amount_cents || 0), 0);
  const householdBudget = r.budgets
    .filter((b) => !b.room_id && !b.project_id)
    .reduce((n, b) => n + (b.amount_cents || 0), 0);
  const name = data.members.find((m) => m.user_id === data.user?.id)?.profiles
    .display_name;
  const activeProjects = r.projects.filter(
    (p) => p.status !== "Afgerond" && p.status !== "Gepauzeerd",
  );
  const visible =
    view !== "home" && view !== "activity"
      ? r[view].filter(
          (item) =>
            (!search ||
              `${item.title} ${item.description || ""} ${(item.tags || []).join(" ")}`
                .toLowerCase()
                .includes(search.toLowerCase())) &&
            (!roomFilter || item.room_id === roomFilter) &&
            (!statusFilter || item.status === statusFilter) &&
            (!personFilter || item.assignee_id === personFilter),
        )
      : [];
  const open = (entity: Entity, record: RecordData) =>
    setDetail({ entity, record });
  const Icon = navigation.find((n) => n.key === view)?.icon || House;
  const progress = (p: RecordData) => {
    const list = r.tasks.filter((t) => t.project_id === p.id);
    const phases = (data.children.project_phases || []).filter(
      (t) => t.project_id === p.id,
    );
    return list.length
      ? Math.round(
          (list.filter((t) => t.status === "Afgerond").length / list.length) *
            100,
        )
      : phases.length
        ? Math.round(
            (phases.filter((t) => t.done).length / phases.length) * 100,
          )
        : p.status === "Afgerond"
          ? 100
          : 0;
  };
  const refreshDetail = detail
    ? {
        ...detail,
        record:
          r[detail.entity].find((x) => x.id === detail.record.id) ||
          detail.record,
      }
    : null;
  const upcoming = [
    ...r.calendar_events.map((e) => ({
      ...e,
      when: e.starts_at || "",
      kind: "calendar_events" as Entity,
    })),
    ...r.maintenance_items.map((e) => ({
      ...e,
      when: e.due_date || "",
      kind: "maintenance_items" as Entity,
    })),
    ...tasks
      .filter((t) => t.due_date)
      .map((e) => ({ ...e, when: e.due_date || "", kind: "tasks" as Entity })),
  ]
    .filter((e) => e.when.slice(0, 10) >= today())
    .sort((a, b) => a.when.localeCompare(b.when));
  const quickOptions: { entity: Entity; icon: LucideIcon; sub: string }[] = [
    { entity: "ideas", icon: Lightbulb, sub: "Bewaar een mooie gedachte" },
    { entity: "tasks", icon: CheckCheck, sub: "Een stapje dichterbij" },
    { entity: "expenses", icon: Wallet, sub: "Houd het eerlijk verdeeld" },
    {
      entity: "wishlist_items",
      icon: Heart,
      sub: "Een vondst voor jullie thuis",
    },
    {
      entity: "projects",
      icon: FolderKanban,
      sub: "Geef een groot plan de ruimte",
    },
    { entity: "calendar_events", icon: CalendarDays, sub: "Maak er tijd voor" },
  ];
  const taskRow = (t: RecordData) => (
    <div className="task-row" key={t.id}>
      <button
        className={`check-button ${t.status === "Afgerond" ? "checked" : ""}`}
        aria-label={`${t.title} ${t.status === "Afgerond" ? "heropenen" : "afronden"}`}
        disabled={pending}
        onClick={() =>
          h &&
          mutate(
            () =>
              saveRecord(
                "tasks",
                h,
                {
                  title: t.title,
                  status: t.status === "Afgerond" ? "Te doen" : "Afgerond",
                },
                t.id,
                t.version,
              ),
            "Taak bijgewerkt.",
          )
        }
      >
        <Check size={14} />
      </button>
      <button className="task-title" onClick={() => open("tasks", t)}>
        <strong>{t.title}</strong>
        <small>
          {r.rooms.find((k) => k.id === t.room_id)?.title || "Hele huis"}
          {t.due_date && ` · ${dateLabel(t.due_date)}`}
        </small>
      </button>
      {t.priority === "Hoog" || t.priority === "Urgent" ? (
        <span className="priority-dot" title={t.priority} />
      ) : null}
      <span
        className="avatar avatar-small"
        title={
          data.members.find((m) => m.user_id === t.assignee_id)?.profiles
            .display_name || "Samen"
        }
      >
        {t.assignee_id ? (
          data.members
            .find((m) => m.user_id === t.assignee_id)
            ?.profiles.display_name.slice(0, 1)
        ) : (
          <Users size={13} />
        )}
      </span>
    </div>
  );
  const empty = (entity: Entity) => (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon size={27} strokeWidth={1.4} />
      </span>
      <h3>
        {search || roomFilter || statusFilter || personFilter
          ? "Geen resultaten gevonden"
          : `Hier is ruimte voor jullie ${entity === "rooms" ? "kamers" : entity === "ideas" ? "ideeën" : "plannen"}`}
      </h3>
      <p>
        {search || roomFilter || statusFilter || personFilter
          ? "Probeer een andere zoekterm of pas je filters aan."
          : "Voeg het eerste onderdeel toe en maak jullie huis een beetje meer thuis."}
      </p>
      {!(search || roomFilter || statusFilter || personFilter) && (
        <Button variant="outline" onClick={() => create(entity)}>
          <Plus size={16} />
          {labels[entity]} toevoegen
        </Button>
      )}
    </div>
  );
  const grid = (entity: Entity, items: RecordData[]) =>
    items.length ? (
      <div
        className={`cards-grid ${entity === "ideas" ? "inspiration-grid" : ""}`}
      >
        {items.map((item, i) => (
          <article className="visual-card" key={item.id}>
            <button
              className={`card-picture picture-${i % 3}`}
              style={{
                backgroundImage: `url("${item.image_url || cardImages[entity]}")`,
              }}
              onClick={() => open(entity, item)}
              aria-label={`${item.title} openen`}
            >
              {entity === "ideas" && item.status && (
                <span className="image-label">{item.status}</span>
              )}
              {entity === "rooms" && (
                <span className="room-open">
                  <ArrowUpRight size={19} />
                </span>
              )}
            </button>
            {entity === "ideas" && (
              <button
                className={`favorite-button ${item.favorite ? "is-favorite" : ""}`}
                aria-label={
                  item.favorite ? "Verwijder favoriet" : "Maak favoriet"
                }
                onClick={() =>
                  h &&
                  mutate(
                    () =>
                      saveRecord(
                        "ideas",
                        h,
                        { title: item.title, favorite: !item.favorite },
                        item.id,
                        item.version,
                      ),
                    "Favoriet bijgewerkt.",
                  )
                }
              >
                <Heart
                  size={18}
                  fill={item.favorite ? "currentColor" : "none"}
                />
              </button>
            )}
            <button className="card-body" onClick={() => open(entity, item)}>
              <div className="card-title">
                <h3>{item.title}</h3>
                {entity === "wishlist_items" && (
                  <span>
                    {euro((item.price_cents || 0) * (item.quantity || 1))}
                  </span>
                )}
              </div>
              <p>
                {entity === "rooms"
                  ? `${r.tasks.filter((t) => t.room_id === item.id && t.status !== "Afgerond").length} open taken · ${r.ideas.filter((t) => t.room_id === item.id).length} ideeën`
                  : item.description ||
                    r.rooms.find((k) => k.id === item.room_id)?.title ||
                    "Een plan voor ons thuis"}
              </p>
              {entity === "projects" && (
                <div className="progress-section">
                  <div>
                    <span>{item.status}</span>
                    <span>{progress(item)}%</span>
                  </div>
                  <div className="progress-track">
                    <span style={{ width: progress(item) + "%" }} />
                  </div>
                </div>
              )}
              {entity === "ideas" && (
                <div className="card-meta">
                  <span>
                    {r.rooms.find((k) => k.id === item.room_id)?.title ||
                      "Hele huis"}
                  </span>
                  <span>
                    {data.members.find((m) => m.user_id === item.created_by)
                      ?.profiles.display_name || "Samen"}
                  </span>
                </div>
              )}
              {entity === "wishlist_items" && (
                <div className="card-meta">
                  <span>{item.store || "Nog geen winkel"}</span>
                  <span>{item.status}</span>
                </div>
              )}
            </button>
          </article>
        ))}
      </div>
    ) : (
      empty(entity)
    );
  return (
    <CopyScope>
      {
        <div className="app-shell">
          <aside className={`sidebar ${showMenu ? "sidebar-open" : ""}`}>
            <button
              className="brand"
              aria-label="Cheese the Rooster — naar overzicht"
              onClick={() => go("home")}
            >
              <Image
                className="brand-logo"
                src="/cheese-the-rooster-logo.webp"
                width={48}
                height={48}
                alt=""
              />
              <span className="brand-wordmark">
                <span>Cheese</span>
                <small>the Rooster</small>
              </span>
            </button>
            <div className="home-switch">
              <span className="house-mark">
                <House size={17} />
              </span>
              <div>
                <strong>{data.household?.name || "Ons fijne thuis"}</strong>
                <small>
                  {data.members.length
                    ? data.members
                        .map((m) => m.profiles.display_name)
                        .join(" & ")
                    : "Dylan & Floor"}
                </small>
              </div>
              <ChevronRight size={15} />
            </div>
            <nav aria-label="Hoofdnavigatie">
              {navigation.map((n) => (
                <div key={n.key}>
                  {n.section && <p className="nav-section">{n.section}</p>}
                  <button
                    className={`nav-item ${view === n.key ? "active" : ""}`}
                    onClick={() => go(n.key)}
                  >
                    <n.icon size={19} strokeWidth={1.7} />
                    <span>{n.label}</span>
                    {n.key === "tasks" && tasks.length > 0 && (
                      <span className="nav-count">{tasks.length}</span>
                    )}
                  </button>
                </div>
              ))}
            </nav>
            <div className="sidebar-bottom">
              <div className="together-note">
                <Leaf size={21} strokeWidth={1.3} />
                <p>
                  Een huis wordt een thuis.
                  <br />
                  <span>Stapje voor stapje, samen.</span>
                </p>
              </div>
              <button
                className="profile"
                onClick={() => {
                  setShowMenu(false);
                  if (data.user) setSettings(true);
                  else setAuth(true);
                }}
              >
                <span className="avatar">{name?.[0] || "D"}</span>
                <span>
                  <strong>{name || "Dylan & Floor"}</strong>
                  <small>{data.user ? "Ons huishouden" : "Welkom thuis"}</small>
                </span>
                <Settings size={17} />
              </button>
            </div>
          </aside>
          {showMenu && (
            <button
              className="mobile-scrim"
              onClick={() => setShowMenu(false)}
              aria-label="Menu sluiten"
            />
          )}
          <div className="main-shell">
            <header className="topbar">
              <div className="breadcrumb">
                <button
                  className="mobile-menu icon-button"
                  onClick={() => setShowMenu(true)}
                  aria-label="Menu openen"
                >
                  <Menu size={22} />
                </button>
                <Image
                  className="breadcrumb-logo"
                  src="/cheese-the-rooster-logo.webp"
                  width={24}
                  height={24}
                  alt=""
                />
                <span>Cheese the Rooster</span>
                <ChevronRight size={12} />
                <strong>
                  {navigation.find((n) => n.key === view)?.label || "Overzicht"}
                </strong>
              </div>
              <div className="topbar-actions">
                <ContentTools />
                {h && (
                  <span
                    className="live-status"
                    aria-label={
                      liveStatus === "Live"
                        ? "Live verbonden"
                        : liveStatus === "Offline"
                          ? "Live verbinding onderbroken"
                          : "Live verbinding maken"
                    }
                  >
                    <i className={liveStatus === "Live" ? "connected" : ""} />
                    <span>{liveStatus}</span>
                  </span>
                )}
                <button
                  className="icon-button"
                  onClick={() => setGlobalSearch(true)}
                  aria-label="Doorzoek ons huis"
                >
                  <Search size={18} />
                </button>
                <span className="today-label">
                  {new Intl.DateTimeFormat("nl-NL", {
                    day: "numeric",
                    month: "long",
                    timeZone: "Europe/Amsterdam",
                  }).format(new Date())}
                </span>
                <button
                  className="icon-button notification-button"
                  onClick={() => setNotificationOpen(true)}
                  aria-label="Herinneringen"
                >
                  <Bell size={19} />
                  {upcoming.length > 0 && <i />}
                </button>
                <div className="couple-avatars">
                  <span className="avatar avatar-small">
                    {data.members[0]?.profiles.display_name[0] || "D"}
                  </span>
                  <span className="avatar avatar-small avatar-clay">
                    {data.members[1]?.profiles.display_name[0] || "F"}
                  </span>
                </div>
              </div>
            </header>
            <main id="main-content">
              <div className="page-heading">
                <div>
                  <p className="eyebrow">
                    {view === "home"
                      ? `WELKOM THUIS${name ? ", " + name.toUpperCase() : ""}`
                      : "CHEESE THE ROOSTER · " +
                        (
                          navigation.find((n) => n.key === view)?.label ||
                          "SAMEN"
                        ).toUpperCase()}
                  </p>
                  <h1>{titles[view]}</h1>
                  <p className="page-description">{descriptions[view]}</p>
                </div>
                <Button
                  className="heading-add"
                  aria-label={
                    view === "home" || view === "activity"
                      ? "Nieuw toevoegen"
                      : `${labels[view]} toevoegen`
                  }
                  onClick={() =>
                    view === "home" || view === "activity"
                      ? setQuick(true)
                      : create(view)
                  }
                >
                  <Plus size={17} />
                  <span className="heading-add-label">
                    {view === "home" || view === "activity"
                      ? "Nieuw toevoegen"
                      : `${labels[view]} toevoegen`}
                  </span>
                </Button>
              </div>
              {!data.configured && (
                <div className="setup-notice">
                  <span>
                    <span className="status-dot" />
                    Een nieuw begin. Koppel Supabase om jullie eigen
                    huisgegevens veilig op te slaan.
                  </span>
                  <button onClick={() => setSettings(true)}>
                    Instellen <ArrowRight size={14} />
                  </button>
                </div>
              )}
              {data.configured && !data.household && (
                <div className="setup-notice">
                  <span>
                    {data.user
                      ? "Maak jullie huishouden aan of accepteer een uitnodiging."
                      : "Welkom! Log in om samen aan jullie huis te werken."}
                  </span>
                  <button onClick={() => setAuth(true)}>
                    {data.user ? "Huishouden instellen" : "Inloggen"}{" "}
                    <ArrowRight size={14} />
                  </button>
                </div>
              )}
              {view === "home" ? (
                <>
                  <div className="dashboard-top">
                    <section className="week-card">
                      <div className="section-heading">
                        <h2>Deze week</h2>
                        <span className="subtle-icon">
                          <CalendarDays size={20} />
                        </span>
                      </div>
                      <p className="muted">
                        Dit staat er voor jullie op de planning.
                      </p>
                      <div className="week-tasks">
                        {tasks
                          .filter(
                            (t) =>
                              t.due_date &&
                              t.due_date >= today() &&
                              t.due_date <= weekEnd,
                          )
                          .slice(0, 3)
                          .map(taskRow)}
                        {!tasks.some(
                          (t) =>
                            t.due_date &&
                            t.due_date >= today() &&
                            t.due_date <= weekEnd,
                        ) && (
                          <div className="calm-empty">
                            <span>
                              <CheckCheck size={26} strokeWidth={1.3} />
                            </span>
                            <h3>Geen taken voor deze week</h3>
                            <p>
                              Voeg een taak met een datum toe.
                              <br />
                              Dan vinden jullie hem hier terug.
                            </p>
                          </div>
                        )}
                      </div>
                      <button
                        className="text-link card-bottom-link"
                        onClick={() => go("tasks")}
                      >
                        Bekijk alle taken <ArrowRight size={16} />
                      </button>
                    </section>
                    <section
                      className="quick-start-card"
                      aria-labelledby="quick-start-heading"
                    >
                      <div className="section-heading">
                        <div>
                          <p className="eyebrow">
                            KLEINE MOEITE, FIJN GEREGELD
                          </p>
                          <h2 id="quick-start-heading">Even snel toevoegen</h2>
                        </div>
                        <Plus size={22} aria-hidden="true" />
                      </div>
                      <p>Een klus, een aankoop of dat ene goede idee.</p>
                      <div className="quick-start-actions">
                        <button onClick={() => create("tasks")}>
                          <CheckCheck size={19} />
                          <span>Taak toevoegen</span>
                          <ArrowUpRight size={16} />
                        </button>
                        <button onClick={() => create("expenses")}>
                          <Wallet size={19} />
                          <span>Uitgave invoeren</span>
                          <ArrowUpRight size={16} />
                        </button>
                        <button onClick={() => create("ideas")}>
                          <Lightbulb size={19} />
                          <span>Idee bewaren</span>
                          <ArrowUpRight size={16} />
                        </button>
                        <button onClick={() => create("calendar_events")}>
                          <CalendarDays size={19} />
                          <span>Afspraak plannen</span>
                          <ArrowUpRight size={16} />
                        </button>
                      </div>
                    </section>
                  </div>
                  <div className="stats-grid">
                    <button className="stat-card" onClick={() => go("tasks")}>
                      <div>
                        <span className="stat-icon sage">
                          <CheckCheck size={20} />
                        </span>
                        <ArrowUpRight size={16} />
                      </div>
                      <strong>{tasks.length}</strong>
                      <span>Openstaande taken</span>
                      <small>
                        {r.tasks.filter((t) => t.status === "Afgerond").length}{" "}
                        afgerond · goed bezig
                      </small>
                    </button>
                    <button
                      className="stat-card"
                      onClick={() => go("projects")}
                    >
                      <div>
                        <span className="stat-icon clay">
                          <FolderKanban size={20} />
                        </span>
                        <ArrowUpRight size={16} />
                      </div>
                      <strong>{activeProjects.length}</strong>
                      <span>Actieve projecten</span>
                      <small>Van plannen naar werkelijkheid</small>
                    </button>
                    <button
                      className="stat-card"
                      onClick={() => go("expenses")}
                    >
                      <div>
                        <span className="stat-icon sand">
                          <Wallet size={20} />
                        </span>
                        <ArrowUpRight size={16} />
                      </div>
                      <strong>{euro(total)}</strong>
                      <span>Samen geïnvesteerd</span>
                      <small>In een plek die van jullie is</small>
                    </button>
                    <button className="stat-card" onClick={() => go("budgets")}>
                      <div>
                        <span className="stat-icon sage">
                          <Leaf size={20} />
                        </span>
                        <ArrowUpRight size={16} />
                      </div>
                      <strong>
                        {householdBudget ? euro(householdBudget - total) : "—"}
                      </strong>
                      <span>Beschikbaar huisbudget</span>
                      <small>
                        {householdBudget
                          ? "Totaalbudget min jullie uitgaven"
                          : "Stel jullie eerste budget in"}
                      </small>
                    </button>
                  </div>
                  {h && (
                    <section className="panel activity-panel">
                      <div className="section-heading">
                        <h2>Recente activiteiten</h2>
                        <button
                          className="text-link"
                          onClick={() => go("activity")}
                        >
                          Alle activiteiten <ArrowUpRight size={16} />
                        </button>
                      </div>
                      <ActivityFeed data={data} limit={5} />
                    </section>
                  )}
                  <section className="dashboard-section">
                    <div className="section-heading">
                      <div>
                        <p className="eyebrow">ALLES PER KAMER</p>
                        <h2>Jullie kamers</h2>
                      </div>
                      <button className="text-link" onClick={() => go("rooms")}>
                        Alle kamers <ArrowRight size={16} />
                      </button>
                    </div>
                    {r.rooms.length ? (
                      grid(
                        "rooms",
                        r.rooms
                          .filter((k) => k.status !== "Gearchiveerd")
                          .sort(
                            (a, b) => (a.sort_order || 0) - (b.sort_order || 0),
                          )
                          .slice(0, 3),
                      )
                    ) : (
                      <button
                        className="start-room-card"
                        onClick={() => create("rooms")}
                      >
                        <span className="empty-room-art">
                          <House size={50} strokeWidth={1} />
                          <Leaf size={24} />
                        </span>
                        <span>
                          <h3>Waar begint jullie verhaal?</h3>
                          <p>
                            De woonkamer, de keuken of een fijne tuin.
                            <br />
                            Geef jullie eerste kamer een plek.
                          </p>
                          <span className="text-link">
                            Kamer toevoegen <Plus size={15} />
                          </span>
                        </span>
                        <span className="room-drawing" />
                      </button>
                    )}
                  </section>
                  <div className="dashboard-bottom">
                    <section className="panel">
                      <div className="section-heading">
                        <h2>Op de planning</h2>
                        <button
                          className="icon-button"
                          onClick={() => go("calendar_events")}
                          aria-label="Alle afspraken"
                        >
                          <ArrowUpRight size={18} />
                        </button>
                      </div>
                      {upcoming.length ? (
                        upcoming.slice(0, 3).map((e) => (
                          <button
                            className="agenda-row"
                            key={e.id}
                            onClick={() => open(e.kind, e)}
                          >
                            <span className="date-block">
                              <strong>{new Date(e.when).getDate()}</strong>
                              <small>
                                {new Intl.DateTimeFormat("nl-NL", {
                                  month: "short",
                                  timeZone: "Europe/Amsterdam",
                                }).format(new Date(e.when))}
                              </small>
                            </span>
                            <span>
                              <strong>{e.title}</strong>
                              <small>
                                {labels[e.kind]} ·{" "}
                                {r.rooms.find((k) => k.id === e.room_id)
                                  ?.title || "Ons huis"}
                              </small>
                            </span>
                            <ChevronRight size={15} />
                          </button>
                        ))
                      ) : (
                        <div className="small-empty">
                          <CalendarDays size={25} />
                          <p>Een lege agenda, vol mogelijkheden.</p>
                          <button
                            className="text-link"
                            onClick={() => create("calendar_events")}
                          >
                            Plan iets samen <Plus size={14} />
                          </button>
                        </div>
                      )}
                    </section>
                  </div>
                  <div className="home-footer">
                    <Leaf size={17} />
                    <p>Het hoeft niet in één dag af. Het is al van jullie.</p>
                    <span>CHEESE THE ROOSTER</span>
                  </div>
                </>
              ) : view === "activity" ? (
                <section className="panel">
                  <ActivityFeed data={data} />
                </section>
              ) : (
                <>
                  {view === "expenses" && (
                    <>
                      <FinanceChart
                        expenses={expenses}
                        members={data.members}
                        payments={data.payments}
                        total={total}
                        budget={householdBudget}
                        rooms={r.rooms}
                        projects={r.projects}
                      />
                      <section className="panel settlement-panel">
                        <div className="section-heading">
                          <div>
                            <h2>Eerlijk verdeeld</h2>
                            <p className="muted">
                              Verrekeningen tellen nooit mee als huisuitgave.
                            </p>
                          </div>
                          <button
                            className="text-link"
                            onClick={() => go("budgets")}
                          >
                            Budgetten & spaardoelen <ArrowRight size={16} />
                          </button>
                        </div>
                        {data.members.length < 2 ? (
                          <p className="muted">
                            Nodig je partner uit om samen te verrekenen.
                          </p>
                        ) : (
                          <div className="balances">
                            {data.members.map((m) => {
                              const valid = new Set(expenses.map((e) => e.id));
                              const b = balance(
                                m.user_id,
                                data.payments.filter((p) =>
                                  valid.has(p.expense_id),
                                ),
                                data.shares.filter((s) =>
                                  valid.has(s.expense_id),
                                ),
                                data.settlements,
                              );
                              return (
                                <div key={m.user_id}>
                                  <span className="avatar">
                                    {m.profiles.display_name[0]}
                                  </span>
                                  <div>
                                    <strong>{m.profiles.display_name}</strong>
                                    <p>
                                      {b > 0
                                        ? `${euro(b)} te ontvangen`
                                        : b < 0
                                          ? `${euro(-b)} te betalen`
                                          : "Alles in balans"}
                                    </p>
                                  </div>
                                  {b < 0 && (
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      disabled={pending}
                                      onClick={() => {
                                        const recipient = data.members.find(
                                          (n) =>
                                            balance(
                                              n.user_id,
                                              data.payments.filter((p) =>
                                                valid.has(p.expense_id),
                                              ),
                                              data.shares.filter((s) =>
                                                valid.has(s.expense_id),
                                              ),
                                              data.settlements,
                                            ) > 0,
                                        );
                                        if (
                                          recipient &&
                                          h &&
                                          window.confirm(
                                            copy(
                                              "Is deze onderlinge betaling daadwerkelijk uitgevoerd?",
                                            ),
                                          )
                                        )
                                          mutate(
                                            () =>
                                              settle(
                                                h,
                                                m.user_id,
                                                recipient.user_id,
                                                Math.min(
                                                  -b,
                                                  balance(
                                                    recipient.user_id,
                                                    data.payments.filter((p) =>
                                                      valid.has(p.expense_id),
                                                    ),
                                                    data.shares.filter((s) =>
                                                      valid.has(s.expense_id),
                                                    ),
                                                    data.settlements,
                                                  ),
                                                ),
                                                crypto.randomUUID(),
                                              ),
                                            "Verrekening opgeslagen.",
                                          );
                                      }}
                                    >
                                      Betaald
                                    </Button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                        {data.settlements.length > 0 && (
                          <details>
                            <summary>
                              Verrekeningshistorie ({data.settlements.length})
                            </summary>
                            {data.settlements.map((s) => (
                              <div className="list-row" key={s.id}>
                                <span>
                                  {dateLabel(s.created_at)} ·{" "}
                                  {
                                    data.members.find(
                                      (m) => m.user_id === s.from_user,
                                    )?.profiles.display_name
                                  }{" "}
                                  →{" "}
                                  {
                                    data.members.find(
                                      (m) => m.user_id === s.to_user,
                                    )?.profiles.display_name
                                  }{" "}
                                  · {euro(s.amount_cents)}{" "}
                                  {s.reversed_at ? "(teruggedraaid)" : ""}
                                </span>
                                {!s.reversed_at && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    disabled={pending}
                                    onClick={() =>
                                      h &&
                                      window.confirm(
                                        copy("Deze verrekening terugdraaien?"),
                                      ) &&
                                      mutate(
                                        () =>
                                          reverseFinancial(
                                            h,
                                            s.id,
                                            "settlements",
                                          ),
                                        "Verrekening teruggedraaid.",
                                      )
                                    }
                                  >
                                    Terugdraaien
                                  </Button>
                                )}
                              </div>
                            ))}
                          </details>
                        )}
                      </section>
                    </>
                  )}
                  {view === "savings_goals" || view === "budgets" ? (
                    <div className="tab-bar">
                      <button
                        className={view === "budgets" ? "selected" : ""}
                        onClick={() => go("budgets")}
                      >
                        Budgetten
                      </button>
                      <button
                        className={view === "savings_goals" ? "selected" : ""}
                        onClick={() => go("savings_goals")}
                      >
                        Spaardoelen
                      </button>
                    </div>
                  ) : null}
                  <div className="filters">
                    <label className="search-box">
                      <Search size={17} />
                      <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={`Zoeken in ${navigation.find((n) => n.key === view)?.label.toLowerCase() || "ons huis"}…`}
                        aria-label="Zoeken"
                      />
                    </label>
                    {view !== "rooms" && (
                      <select
                        aria-label="Filter op kamer"
                        value={roomFilter}
                        onChange={(e) => setRoomFilter(e.target.value)}
                      >
                        <option value="">Alle kamers</option>
                        {r.rooms.map((k) => (
                          <option value={k.id} key={k.id}>
                            {k.title}
                          </option>
                        ))}
                      </select>
                    )}
                    {statuses[view] && (
                      <select
                        aria-label="Filter op status"
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                      >
                        <option value="">Alle statussen</option>
                        {(view === "wishlist_items"
                          ? [...statuses[view]!, "Gekocht"]
                          : statuses[view]!
                        ).map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    )}
                    {view === "tasks" && (
                      <select
                        value={personFilter}
                        onChange={(e) => setPersonFilter(e.target.value)}
                        aria-label="Filter op persoon"
                      >
                        <option value="">Iedereen</option>
                        {data.members.map((m) => (
                          <option key={m.user_id} value={m.user_id}>
                            {m.profiles.display_name}
                          </option>
                        ))}
                      </select>
                    )}
                    <span className="result-count">
                      {visible.length}{" "}
                      {visible.length === 1 ? "onderdeel" : "onderdelen"}
                    </span>
                    {view === "expenses" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          const csv = expensesCSV(visible);
                          const url = URL.createObjectURL(
                            new Blob([csv], { type: "text/csv;charset=utf-8" }),
                          );
                          const a = document.createElement("a");
                          a.href = url;
                          a.download = "cheese-the-rooster-uitgaven.csv";
                          a.click();
                          URL.revokeObjectURL(url);
                        }}
                      >
                        <Download size={15} />
                        CSV
                      </Button>
                    )}
                  </div>
                  {view === "tasks" && (
                    <div className="tab-bar">
                      {[
                        "Lijst",
                        "Kanban",
                        "Per kamer",
                        "Per persoon",
                        "Kalender",
                      ].map((m) => (
                        <button
                          className={taskMode === m ? "selected" : ""}
                          key={m}
                          onClick={() => setTaskMode(m)}
                        >
                          {m}
                        </button>
                      ))}
                    </div>
                  )}
                  {["rooms", "ideas", "projects", "wishlist_items"].includes(
                    view,
                  ) ? (
                    grid(
                      view,
                      visible.sort((a, b) =>
                        view === "rooms"
                          ? (a.sort_order || 0) - (b.sort_order || 0)
                          : 0,
                      ),
                    )
                  ) : view === "calendar_events" ||
                    (view === "tasks" && taskMode === "Kalender") ? (
                    <section className="panel calendar-panel">
                      <CalendarView
                        records={view === "tasks" ? visible : visible}
                        tasks={view === "tasks"}
                        onSelect={(item) => open(view, item)}
                        onAdd={() =>
                          create(view === "tasks" ? "tasks" : "calendar_events")
                        }
                      />
                    </section>
                  ) : view === "tasks" ? (
                    visible.length ? (
                      taskMode === "Lijst" ? (
                        <div className="panel task-list">
                          {visible.map(taskRow)}
                        </div>
                      ) : (
                        <div className="kanban-grid">
                          {(taskMode === "Kanban"
                            ? statuses.tasks!
                            : taskMode === "Per kamer"
                              ? ["", ...r.rooms.map((k) => k.id)]
                              : ["", ...data.members.map((m) => m.user_id)]
                          ).map((group) => (
                            <section className="kanban-column" key={group}>
                              <h3>
                                {taskMode === "Kanban"
                                  ? group
                                  : taskMode === "Per kamer"
                                    ? r.rooms.find((k) => k.id === group)
                                        ?.title || "Hele huis"
                                    : data.members.find(
                                        (m) => m.user_id === group,
                                      )?.profiles.display_name || "Samen"}
                              </h3>
                              {visible
                                .filter((t) =>
                                  taskMode === "Kanban"
                                    ? t.status === group
                                    : taskMode === "Per kamer"
                                      ? (t.room_id || "") === group
                                      : (t.assignee_id || "") === group,
                                )
                                .map((t) => (
                                  <div className="kanban-task" key={t.id}>
                                    {taskRow(t)}
                                    {taskMode === "Kanban" && (
                                      <select
                                        aria-label={`Status ${t.title}`}
                                        value={t.status}
                                        disabled={pending}
                                        onChange={(e) =>
                                          h &&
                                          mutate(() =>
                                            saveRecord(
                                              "tasks",
                                              h,
                                              {
                                                title: t.title,
                                                status: e.target.value,
                                              },
                                              t.id,
                                              t.version,
                                            ),
                                          )
                                        }
                                      >
                                        {statuses.tasks!.map((s) => (
                                          <option key={s}>{s}</option>
                                        ))}
                                      </select>
                                    )}
                                  </div>
                                ))}
                            </section>
                          ))}
                        </div>
                      )
                    ) : (
                      empty(view)
                    )
                  ) : visible.length ? (
                    <div className="panel record-list">
                      {visible.map((item) => (
                        <button
                          className="record-row"
                          key={item.id}
                          onClick={() => open(view, item)}
                        >
                          <span className="record-icon">
                            <Icon size={20} />
                          </span>
                          <span className="record-name">
                            <strong>{item.title}</strong>
                            <small>
                              {item.reversed_at
                                ? "Teruggedraaid"
                                : item.category ||
                                  r.rooms.find((k) => k.id === item.room_id)
                                    ?.title ||
                                  "Ons huis"}
                              {item.due_date &&
                                ` · ${dateLabel(item.due_date)}`}
                            </small>
                          </span>
                          <span className="record-value">
                            {typeof item.amount_cents === "number"
                              ? euro(item.amount_cents)
                              : item.filename || item.status || ""}
                          </span>
                          <ChevronRight size={17} />
                        </button>
                      ))}
                    </div>
                  ) : (
                    empty(view)
                  )}
                </>
              )}
            </main>
          </div>
          <nav className="mobile-nav" aria-label="Mobiele navigatie">
            <button
              className={view === "home" ? "active" : ""}
              onClick={() => go("home")}
            >
              <House size={20} />
              Home
            </button>
            <button
              className={view === "rooms" ? "active" : ""}
              onClick={() => go("rooms")}
            >
              <LayoutGrid size={20} />
              Kamers
            </button>
            <button
              className="mobile-add"
              onClick={() => setQuick(true)}
              aria-label="Nieuw toevoegen"
            >
              <Plus size={25} />
            </button>
            <button
              className={view === "calendar_events" ? "active" : ""}
              onClick={() => go("calendar_events")}
            >
              <CalendarDays size={20} />
              Planning
            </button>
            <button onClick={() => setShowMenu(true)}>
              <MoreHorizontal size={20} />
              Meer
            </button>
          </nav>
          {toast && (
            <div className="toast" role="status">
              <CheckCircle2 size={19} />
              <span>{toast}</span>
              <button onClick={() => setToast("")} aria-label="Melding sluiten">
                <X size={16} />
              </button>
            </div>
          )}
          <Dialog
            open={globalSearch}
            onOpenChange={setGlobalSearch}
            title="Zoek iets voor ons thuis"
            description="Doorzoek jullie kamers, ideeën, taken, projecten en meer."
          >
            <div className="settings-content">
              <label className="search-box">
                <Search size={18} />
                <input
                  value={globalQuery}
                  onChange={(e) => setGlobalQuery(e.target.value)}
                  placeholder="Waar ben je naar op zoek?"
                  aria-label="Globaal zoeken"
                  autoFocus
                />
              </label>
              {globalQuery.trim().length > 1 ? (
                Object.entries(r).flatMap(([entity, items]) =>
                  items
                    .filter((item) =>
                      (item.title + " " + (item.description || ""))
                        .toLowerCase()
                        .includes(globalQuery.toLowerCase()),
                    )
                    .map((item) => (
                      <button
                        key={item.id}
                        className="record-row"
                        onClick={() => {
                          setGlobalSearch(false);
                          open(entity as Entity, item);
                        }}
                      >
                        <span className="record-name">
                          <strong>{item.title}</strong>
                          <small>{labels[entity as Entity]}</small>
                        </span>
                        <ArrowUpRight size={16} />
                      </button>
                    )),
                )
              ) : (
                <p className="small-empty">
                  Typ minimaal twee tekens om te zoeken.
                </p>
              )}
            </div>
          </Dialog>
          <Dialog
            open={quick}
            onOpenChange={setQuick}
            title="Wat voegen we toe?"
            description="Een idee, een plan of een kleine stap vooruit."
          >
            <div className="quick-grid">
              {quickOptions.map((q) => (
                <button key={q.entity} onClick={() => create(q.entity)}>
                  <span>
                    <q.icon size={23} />
                  </span>
                  <strong>{labels[q.entity]}</strong>
                  <small>{q.sub}</small>
                  <ArrowUpRight size={16} />
                </button>
              ))}
            </div>
          </Dialog>
          {editor && (
            <Editor
              {...editor}
              data={data}
              onClose={() => setEditor(null)}
              onSaved={(m) => {
                notify(m);
                router.refresh();
              }}
            />
          )}
          {refreshDetail && (
            <Detail
              {...refreshDetail}
              data={data}
              onClose={() => setDetail(null)}
              onEdit={() => {
                if (
                  refreshDetail.entity === "expenses" ||
                  refreshDetail.entity === "documents"
                )
                  return;
                setEditor(refreshDetail);
                setDetail(null);
              }}
              onAdd={(entity, extra) => {
                setDetail(null);
                create(entity, extra);
              }}
              mutate={mutate}
              pending={pending}
              progress={progress(refreshDetail.record)}
              onOpen={open}
            />
          )}
          <Dialog
            open={auth}
            onOpenChange={setAuth}
            title={
              !data.user
                ? "Welkom thuis"
                : !h
                  ? "Maak het van jullie"
                  : "Ons huishouden"
            }
            description="Een eigen account. Eén gezamenlijk thuis."
          >
            <Auth
              data={data}
              token={invitation}
              done={() => {
                setAuth(false);
                router.refresh();
              }}
              notify={notify}
            />
          </Dialog>
          <Dialog
            open={settings}
            onOpenChange={setSettings}
            title="Een fijne basis"
            description="Jullie huis, jullie instellingen."
          >
            <div className="settings-content">
              {!data.configured ? (
                <>
                  <p>
                    Koppel een Supabase-project om veilig met jullie eigen
                    gegevens te werken. Deze omgeving bevat nog geen
                    huisgegevens.
                  </p>
                  <ol>
                    <li>Maak een Supabase-project aan.</li>
                    <li>
                      Voer de migraties uit de map{" "}
                      <code>supabase/migrations</code> in volgorde uit.
                    </li>
                    <li>
                      Stel <code>NEXT_PUBLIC_SUPABASE_URL</code> en{" "}
                      <code>NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY</code> in.
                    </li>
                    <li>
                      Configureer de app-URL bij Supabase Auth en herstart de
                      app.
                    </li>
                  </ol>
                  <p>
                    De complete instructies staan in README.md. Gebruik nooit
                    een service-role key in de browser.
                  </p>
                  <Button
                    variant="outline"
                    onClick={() => {
                      setSettings(false);
                      setAuth(true);
                    }}
                  >
                    Naar inloggen <ArrowRight size={15} />
                  </Button>
                </>
              ) : (
                <>
                  <div className="settings-members">
                    {data.members.map((m) => (
                      <div key={m.user_id}>
                        <span className="avatar">
                          {m.profiles.display_name[0]}
                        </span>
                        <strong>{m.profiles.display_name}</strong>
                        <small>Gelijkwaardige partner</small>
                      </div>
                    ))}
                  </div>
                  {h && <Invite h={h} notify={notify} />}
                  {canEditCopy && (
                    <a className="button button-outline" href="/admin/teksten">
                      <Files size={16} /> Alle websiteteksten aanpassen
                    </a>
                  )}
                  <p className="muted">
                    Tijdzone: Europe/Amsterdam · Bestanden zijn privé.
                  </p>
                  {data.user && (
                    <Button
                      variant="outline"
                      onClick={() =>
                        mutate(async () => {
                          await signout();
                          setSettings(false);
                        }, "Je bent uitgelogd.")
                      }
                    >
                      <LogOut size={16} />
                      Uitloggen
                    </Button>
                  )}
                </>
              )}
            </div>
          </Dialog>
          <Dialog
            open={notificationOpen}
            onOpenChange={setNotificationOpen}
            title="Even aan denken"
            description="Jullie aankomende afspraken, deadlines en onderhoud."
          >
            <div className="settings-content">
              {upcoming.length ? (
                upcoming.map((e) => (
                  <button
                    className="record-row"
                    key={e.id}
                    onClick={() => {
                      setNotificationOpen(false);
                      open(e.kind, e);
                    }}
                  >
                    <CalendarDays size={19} />
                    <span className="record-name">
                      <strong>{e.title}</strong>
                      <small>
                        {dateLabel(e.when)} · {labels[e.kind]}
                      </small>
                    </span>
                    <ChevronRight size={16} />
                  </button>
                ))
              ) : (
                <div className="small-empty">
                  <CheckCheck size={30} />
                  <p>Je bent helemaal bij.</p>
                </div>
              )}
              <p className="form-hint">
                Herinneringen verschijnen hier in de app. E-mail- en
                pushberichten zijn nog niet beschikbaar.
              </p>
            </div>
          </Dialog>
        </div>
      }
    </CopyScope>
  );
}
const activityActions: Record<string, string> = {
  INSERT: "Toegevoegd",
  UPDATE: "Aangepast",
  COMPLETE: "Afgerond",
  REOPEN: "Heropend",
  DELETE: "Verwijderd",
  REVERSE: "Gecorrigeerd",
};
const activityEntities: Record<string, string> = {
  ...labels,
  task_subtasks: "Subtaak",
  project_phases: "Projectfase",
  settlements: "Verrekening",
};

function activityName(data: Snapshot, userId: string | null | undefined) {
  return (
    data.members.find((member) => member.user_id === userId)?.profiles
      .display_name || "Onbekende gebruiker"
  );
}

function ActivityFeed({ data, limit }: { data: Snapshot; limit?: number }) {
  const activity = data.activity.slice(0, limit);
  return (
    <CopyScope>
      {activity.length ? (
        <ul className="activity-list">
          {activity.map((entry) => {
            const name = activityName(data, entry.user_id);
            return (
              <li className="activity-row" key={entry.id}>
                <span className="avatar avatar-small" aria-hidden="true">
                  {name[0]}
                </span>
                <p>
                  <strong>
                    {entry.title ||
                      activityEntities[entry.entity] ||
                      "Huishouden"}
                  </strong>
                  <span>
                    <b>{name}</b> ·{" "}
                    {activityActions[entry.action] || "Aangepast"} ·{" "}
                    <time dateTime={entry.created_at}>
                      {new Intl.DateTimeFormat("nl-NL", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "Europe/Amsterdam",
                      }).format(new Date(entry.created_at))}
                    </time>
                  </span>
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="small-empty">
          Hier zie je straks wat jullie hebben toegevoegd, aangepast of
          afgerond.
        </p>
      )}
    </CopyScope>
  );
}

function Auth({
  data,
  token,
  done,
  notify,
}: {
  data: Snapshot;
  token: string;
  done: () => void;
  notify: (s: string) => void;
}) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [localToken, setLocalToken] = useState(token);
  return (
    <CopyScope>
      {
        <form
          className="editor-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              if (!data.configured)
                throw new Error(
                  "Supabase is nog niet gekoppeld. Volg de stappen bij Instellingen.",
                );
              const f = new FormData(e.currentTarget);
              if (!data.user) {
                const result = await authenticate(
                  mode,
                  String(f.get("email")),
                  String(f.get("password")),
                );
                if (result.confirmation) {
                  notify("Bevestig je e-mailadres via de link in je e-mail.");
                  setMode("login");
                  return;
                }
              } else
                await setupHousehold(
                  String(f.get("house") || "Cheese the Rooster"),
                  String(f.get("person")),
                  localToken || undefined,
                );
              done();
            } catch (ex) {
              setError(ex instanceof Error ? ex.message : "Dit lukte niet.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {!data.user ? (
            <>
              <div className="tab-bar">
                <button
                  type="button"
                  className={mode === "login" ? "selected" : ""}
                  onClick={() => setMode("login")}
                >
                  Inloggen
                </button>
                <button
                  type="button"
                  className={mode === "signup" ? "selected" : ""}
                  onClick={() => setMode("signup")}
                >
                  Account maken
                </button>
              </div>
              <label className="field">
                E-mailadres
                <input
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                />
              </label>
              <label className="field">
                Wachtwoord
                <input
                  name="password"
                  type="password"
                  minLength={10}
                  maxLength={128}
                  autoComplete={
                    mode === "login" ? "current-password" : "new-password"
                  }
                  required
                />
              </label>
              <p className="form-hint">
                Gebruik minimaal 10 tekens. Ieder heeft een eigen account.
              </p>
              {mode === "login" && (
                <Link href="/wachtwoord-vergeten">Wachtwoord vergeten?</Link>
              )}
            </>
          ) : (
            <>
              <label className="field">
                Jouw naam
                <input
                  name="person"
                  placeholder="Dylan of Floor"
                  maxLength={80}
                  required
                />
              </label>
              <label className="field">
                Naam van jullie huis
                <input
                  name="house"
                  defaultValue="Cheese the Rooster"
                  maxLength={120}
                  required
                />
              </label>
              <label className="field">
                Uitnodigingscode (als je partner al een huis heeft)
                <input
                  value={localToken}
                  onChange={(e) => setLocalToken(e.target.value)}
                  placeholder="Plak hier de code uit de uitnodiging"
                />
              </label>
            </>
          )}
          {error && (
            <p role="alert" className="error-message">
              {error}
            </p>
          )}
          <Button disabled={busy || !data.configured} type="submit">
            {busy
              ? "Even geduld…"
              : !data.user
                ? mode === "login"
                  ? "Inloggen"
                  : "Account maken"
                : localToken
                  ? "Uitnodiging accepteren"
                  : "Ons huishouden maken"}
          </Button>
        </form>
      }
    </CopyScope>
  );
}
function Invite({ h, notify }: { h: string; notify: (s: string) => void }) {
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <CopyScope>
      {
        <form
          className="invite-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            try {
              const f = new FormData(e.currentTarget);
              setToken(await invite(h, String(f.get("email"))));
            } catch (ex) {
              notify(ex instanceof Error ? ex.message : "Uitnodigen mislukt.");
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3>Samen is fijner</h3>
          <p>
            Nodig je partner uit met het e-mailadres van diens eigen account. De
            code is 7 dagen geldig.
          </p>
          <label className="field">
            E-mailadres partner
            <input type="email" name="email" required />
          </label>
          <Button variant="outline" disabled={busy}>
            Uitnodigingslink maken
          </Button>
          {token && (
            <>
              <label className="field">
                Deel deze link zelf met je partner
                <textarea
                  readOnly
                  value={`${window.location.origin}/?invite=${token}`}
                  rows={3}
                />
              </label>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  navigator.clipboard
                    .writeText(`${window.location.origin}/?invite=${token}`)
                    .then(() => notify("Link gekopieerd."))
                    .catch(() =>
                      notify("Selecteer de link en kopieer deze handmatig."),
                    );
                }}
              >
                Link kopiëren
              </Button>
            </>
          )}
        </form>
      }
    </CopyScope>
  );
}
function Detail({
  entity,
  record: item,
  data,
  onClose,
  onEdit,
  onAdd,
  mutate,
  pending,
  progress,
  onOpen,
}: {
  entity: Entity;
  record: RecordData;
  data: Snapshot;
  onClose: () => void;
  onEdit: () => void;
  onAdd: (
    entity: Entity,
    extra?: {
      linkedRoom?: string;
      linkedProject?: string;
      purchase?: RecordData;
    },
  ) => void;
  mutate: (fn: () => Promise<unknown>, message?: string) => void;
  pending: boolean;
  progress: number;
  onOpen: (entity: Entity, r: RecordData) => void;
}) {
  const { text: copy } = useSiteContent();

  const [tab, setTab] = useState("Overzicht");
  const [maintenanceCost, setMaintenanceCost] = useState(
    String((item.cost_cents || 0) / 100),
  );
  const [performed, setPerformed] = useState(today());
  const latestChange = data.activity.find(
    (entry) =>
      entry.entity === entity &&
      entry.entity_id === item.id &&
      entry.action !== "INSERT",
  );
  const h = data.household!.id;
  const r = data.records;
  const isContainer = entity === "rooms" || entity === "projects";
  const tabs = isContainer
    ? [
        "Overzicht",
        "Taken",
        "Inspiratie",
        "Projecten",
        "Verlanglijst",
        "Uitgaven",
        "Budgetten",
        "Onderhoud",
        "Documenten",
        "Leveranciers",
        "Foto’s",
      ]
    : ["Overzicht"];
  const linked = (e: Entity) =>
    r[e].filter((x) =>
      entity === "rooms"
        ? x.room_id === item.id
        : entity === "projects"
          ? x.project_id === item.id
          : false,
    );
  const spent = (
    entity === "expenses"
      ? item.reversed_at
        ? []
        : [item]
      : linked("expenses").filter((x) => !x.reversed_at)
  ).reduce((n, x) => n + (x.amount_cents || 0), 0);
  const childrenKind =
    entity === "tasks"
      ? "task_subtasks"
      : entity === "projects"
        ? "project_phases"
        : entity === "ideas"
          ? "idea_comments"
          : null;
  const children = (
    childrenKind ? data.children[childrenKind] || [] : []
  ).filter((c) =>
    entity === "tasks"
      ? c.task_id === item.id
      : entity === "projects"
        ? c.project_id === item.id
        : c.idea_id === item.id,
  );
  const tabEntity: Record<string, Entity> = {
    Taken: "tasks",
    Inspiratie: "ideas",
    Projecten: "projects",
    Verlanglijst: "wishlist_items",
    Uitgaven: "expenses",
    Onderhoud: "maintenance_items",
    Documenten: "documents",
    Budgetten: "budgets",
    Leveranciers: "suppliers",
  };
  const linkedExtra =
    entity === "rooms"
      ? { linkedRoom: item.id }
      : entity === "projects"
        ? { linkedProject: item.id }
        : {};
  const displayFile = async (path: string) => {
    await openPrivateFile(h, path);
  };
  const files = (items: RecordData[]) =>
    items.map((doc) => (
      <button
        className="record-row"
        key={doc.id}
        onClick={() =>
          mutate(() => displayFile(doc.storage_path!), "Bestand geopend.")
        }
      >
        <Files size={18} />
        <span className="record-name">
          <strong>{doc.title}</strong>
          <small>
            {doc.filename} · {Math.ceil((doc.bytes || 0) / 1024)} KB
          </small>
        </span>
        <Download size={17} />
      </button>
    ));
  return (
    <CopyScope>
      {
        <Dialog
          open
          onOpenChange={(v) => !v && onClose()}
          title={item.title}
          description={`${labels[entity]} · ${item.status || item.category || "Ons huis"}`}
          wide
        >
          <div className="detail-content">
            {item.image_url && (
              <div
                className="detail-image"
                style={{ backgroundImage: `url("${item.image_url}")` }}
              />
            )}
            {isContainer && (
              <div className="tab-bar detail-tabs">
                {tabs
                  .filter((t) => !(entity === "projects" && t === "Projecten"))
                  .map((t) => (
                    <button
                      className={tab === t ? "selected" : ""}
                      key={t}
                      onClick={() => setTab(t)}
                    >
                      {t}
                    </button>
                  ))}
              </div>
            )}
            {tab === "Overzicht" ? (
              <>
                <p className="detail-description">
                  {item.description ||
                    "Een eigen plek voor alle details van dit plan."}
                </p>
                <p className="record-attribution">
                  Toegevoegd door{" "}
                  <strong>{activityName(data, item.created_by)}</strong>
                  {latestChange && (
                    <>
                      {" "}
                      · {activityActions[latestChange.action] ||
                        "Aangepast"}{" "}
                      door{" "}
                      <strong>
                        {activityName(data, latestChange.user_id)}
                      </strong>
                    </>
                  )}
                </p>
                <div className="detail-metrics">
                  {entity === "rooms" && (
                    <>
                      <div>
                        <small>Oppervlakte</small>
                        <strong>
                          {item.width_cm && item.length_cm
                            ? `${((item.width_cm * item.length_cm) / 10000).toLocaleString("nl-NL")} m²`
                            : "Nog niet ingevuld"}
                        </strong>
                      </div>
                      <div>
                        <small>Verfkleuren</small>
                        <strong>{item.paint || "Nog te kiezen"}</strong>
                      </div>
                      <div>
                        <small>Materialen</small>
                        <strong>{item.materials || "Nog te kiezen"}</strong>
                      </div>
                      <div>
                        <small>Open taken</small>
                        <strong>
                          {
                            linked("tasks").filter(
                              (t) => t.status !== "Afgerond",
                            ).length
                          }
                        </strong>
                      </div>
                    </>
                  )}
                  {entity === "projects" && (
                    <>
                      <div>
                        <small>Voortgang</small>
                        <strong>{progress}%</strong>
                        <div className="progress-track">
                          <span style={{ width: progress + "%" }} />
                        </div>
                      </div>
                      <div>
                        <small>Budget</small>
                        <strong>{euro(item.budget_cents || 0)}</strong>
                      </div>
                      <div>
                        <small>Werkelijke kosten</small>
                        <strong>{euro(spent)}</strong>
                      </div>
                      <div>
                        <small>Planning</small>
                        <strong>
                          {dateLabel(item.start_date)} –{" "}
                          {dateLabel(item.due_date)}
                        </strong>
                      </div>
                      {spent > (item.budget_cents || 0) && (
                        <p className="error-message">
                          Projectbudget overschreden met{" "}
                          {euro(spent - (item.budget_cents || 0))}.
                        </p>
                      )}
                    </>
                  )}
                  {entity === "tasks" && (
                    <>
                      <div>
                        <small>Verantwoordelijke</small>
                        <strong>
                          {data.members.find(
                            (m) => m.user_id === item.assignee_id,
                          )?.profiles.display_name || "Samen"}
                        </strong>
                      </div>
                      <div>
                        <small>Deadline</small>
                        <strong>{dateLabel(item.due_date)}</strong>
                      </div>
                      <div>
                        <small>Prioriteit</small>
                        <strong>{item.priority}</strong>
                      </div>
                      <div>
                        <small>Geschatte duur</small>
                        <strong>
                          {item.duration_minutes
                            ? `${item.duration_minutes} minuten`
                            : "Nog niet ingevuld"}
                        </strong>
                      </div>
                    </>
                  )}
                  {entity === "ideas" && (
                    <>
                      <div>
                        <small>Kostenindicatie</small>
                        <strong>{euro(item.cost_cents || 0)}</strong>
                      </div>
                      <div>
                        <small>Toegevoegd door</small>
                        <strong>
                          {data.members.find(
                            (m) => m.user_id === item.created_by,
                          )?.profiles.display_name || "Samen"}
                        </strong>
                      </div>
                    </>
                  )}
                  {entity === "expenses" && (
                    <>
                      <div>
                        <small>Bedrag</small>
                        <strong>{euro(item.amount_cents || 0)}</strong>
                      </div>
                      <div>
                        <small>Datum</small>
                        <strong>{dateLabel(item.expense_date)}</strong>
                      </div>
                      <div>
                        <small>Categorie</small>
                        <strong>{item.category}</strong>
                      </div>
                      <div>
                        <small>Status</small>
                        <strong>
                          {item.reversed_at ? "Teruggedraaid" : "Geregistreerd"}
                        </strong>
                      </div>
                    </>
                  )}
                  {entity === "wishlist_items" && (
                    <>
                      <div>
                        <small>Totaal</small>
                        <strong>
                          {euro((item.price_cents || 0) * (item.quantity || 1))}
                        </strong>
                      </div>
                      <div>
                        <small>Winkel · aantal</small>
                        <strong>
                          {item.store || "Nog te kiezen"} · {item.quantity}
                        </strong>
                      </div>
                    </>
                  )}
                  {entity === "calendar_events" && (
                    <>
                      <div>
                        <small>Begint</small>
                        <strong>
                          {new Date(item.starts_at!).toLocaleString("nl-NL", {
                            timeZone: "Europe/Amsterdam",
                          })}
                        </strong>
                      </div>
                      <div>
                        <small>Eindigt</small>
                        <strong>
                          {new Date(item.ends_at!).toLocaleString("nl-NL", {
                            timeZone: "Europe/Amsterdam",
                          })}
                        </strong>
                      </div>
                      <p className="muted">Tijdzone: Europe/Amsterdam</p>
                    </>
                  )}
                  {entity === "maintenance_items" && (
                    <>
                      <div>
                        <small>Herhaling</small>
                        <strong>Elke {item.frequency_months} maanden</strong>
                      </div>
                      <div>
                        <small>Volgende uitvoering</small>
                        <strong>{dateLabel(item.due_date)}</strong>
                      </div>
                      <div>
                        <small>Laatst uitgevoerd</small>
                        <strong>{dateLabel(item.last_done)}</strong>
                      </div>
                    </>
                  )}
                  {(entity === "budgets" || entity === "savings_goals") && (
                    <>
                      <div>
                        <small>Doelbedrag</small>
                        <strong>{euro(item.amount_cents || 0)}</strong>
                      </div>
                      <div>
                        <small>
                          {entity === "budgets"
                            ? "Werkelijke uitgaven"
                            : "Al gespaard"}
                        </small>
                        <strong>
                          {euro(
                            entity === "savings_goals"
                              ? item.saved_cents || 0
                              : r.expenses
                                  .filter(
                                    (e) =>
                                      !e.reversed_at &&
                                      (item.project_id
                                        ? e.project_id === item.project_id
                                        : item.room_id
                                          ? e.room_id === item.room_id
                                          : true),
                                  )
                                  .reduce(
                                    (n, e) => n + (e.amount_cents || 0),
                                    0,
                                  ),
                          )}
                        </strong>
                      </div>
                    </>
                  )}
                </div>
                {item.url && (
                  <a
                    className="button button-outline"
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Website bekijken <ExternalLink size={15} />
                  </a>
                )}
                {item.room_id && (
                  <button
                    className="text-link"
                    onClick={() => {
                      const room = r.rooms.find((x) => x.id === item.room_id);
                      if (room) onOpen("rooms", room);
                    }}
                  >
                    Naar{" "}
                    {r.rooms.find((x) => x.id === item.room_id)?.title ||
                      "kamer"}{" "}
                    <ArrowRight size={15} />
                  </button>
                )}
                {item.project_id && (
                  <button
                    className="text-link"
                    onClick={() => {
                      const project = r.projects.find(
                        (x) => x.id === item.project_id,
                      );
                      if (project) onOpen("projects", project);
                    }}
                  >
                    Naar{" "}
                    {r.projects.find((x) => x.id === item.project_id)?.title ||
                      "project"}{" "}
                    <ArrowRight size={15} />
                  </button>
                )}
                {entity === "expenses" && (
                  <div className="form-section">
                    <h3>Betalingen en verdeling</h3>
                    {data.members.map((m) => (
                      <div className="list-row" key={m.user_id}>
                        <strong>{m.profiles.display_name}</strong>
                        <span>
                          Betaald{" "}
                          {euro(
                            data.payments
                              .filter(
                                (p) =>
                                  p.expense_id === item.id &&
                                  p.user_id === m.user_id,
                              )
                              .reduce((n, p) => n + p.amount_cents, 0),
                          )}{" "}
                          · aandeel{" "}
                          {euro(
                            data.shares
                              .filter(
                                (p) =>
                                  p.expense_id === item.id &&
                                  p.user_id === m.user_id,
                              )
                              .reduce((n, p) => n + p.amount_cents, 0),
                          )}
                        </span>
                      </div>
                    ))}
                    {!item.reversed_at && (
                      <Button
                        variant="outline"
                        disabled={pending}
                        onClick={() =>
                          window.confirm(
                            copy(
                              "Deze uitgave terugdraaien? De auditgeschiedenis blijft bewaard.",
                            ),
                          ) &&
                          mutate(
                            () => reverseFinancial(h, item.id, "expenses"),
                            "Uitgave teruggedraaid.",
                          )
                        }
                      >
                        Uitgave terugdraaien
                      </Button>
                    )}
                    <p className="form-hint">
                      Voor een correctie: draai de uitgave terug en registreer
                      het juiste bedrag opnieuw. Bestaande verrekeningen blijven
                      zichtbaar.
                    </p>
                  </div>
                )}
                {entity === "ideas" && item.status !== "Uitgevoerd" && (
                  <div className="detail-actions">
                    <Button
                      variant="outline"
                      disabled={pending}
                      onClick={() =>
                        mutate(
                          () => convertIdea(h, item.id, "tasks", item.version),
                          "Idee omgezet naar taak.",
                        )
                      }
                    >
                      Maak er een taak van <ArrowRight size={15} />
                    </Button>
                    <Button
                      disabled={pending}
                      onClick={() =>
                        mutate(
                          () =>
                            convertIdea(h, item.id, "projects", item.version),
                          "Idee omgezet naar project.",
                        )
                      }
                    >
                      Start een project <ArrowRight size={15} />
                    </Button>
                  </div>
                )}
                {entity === "wishlist_items" && !item.expense_id && (
                  <Button
                    onClick={() => {
                      onClose();
                      onAdd("expenses", { purchase: item });
                    }}
                  >
                    Aankoop registreren <Wallet size={16} />
                  </Button>
                )}
                {entity === "wishlist_items" && !item.expense_id && (
                  <form
                    className="inline-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      const f = new FormData(e.currentTarget);
                      mutate(async () => {
                        await linkPurchase(
                          h,
                          item.id,
                          String(f.get("expense")),
                          item.version,
                        );
                      }, "Aankoop gekoppeld.");
                    }}
                  >
                    <label className="field">
                      Of koppel een bestaande uitgave
                      <select name="expense" required>
                        <option value="">Selecteer uitgave</option>
                        {r.expenses
                          .filter((e) => !e.reversed_at)
                          .map((e) => (
                            <option key={e.id} value={e.id}>
                              {e.title} · {euro(e.amount_cents || 0)}
                            </option>
                          ))}
                      </select>
                    </label>
                    <Button variant="outline" disabled={pending}>
                      Koppelen
                    </Button>
                  </form>
                )}
                {childrenKind && (
                  <div className="form-section">
                    <h3>
                      {entity === "tasks"
                        ? "Subtaken"
                        : entity === "projects"
                          ? "Projectfases"
                          : "Samen bespreken"}
                    </h3>
                    {children.map((c) => (
                      <div className="child-row" key={c.id}>
                        {childrenKind !== "idea_comments" ? (
                          <button
                            className={`check-button ${c.done ? "checked" : ""}`}
                            aria-label={`${c.title} ${c.done ? "heropenen" : "afronden"}`}
                            disabled={pending}
                            onClick={() =>
                              mutate(() =>
                                toggleChild(
                                  h,
                                  childrenKind as
                                    "task_subtasks" | "project_phases",
                                  c.id,
                                  !c.done,
                                ),
                              )
                            }
                          >
                            <Check size={14} />
                          </button>
                        ) : (
                          <MessageCircle size={16} />
                        )}
                        <div>
                          <span>{c.title || c.body}</span>
                          {childrenKind === "idea_comments" && (
                            <small>
                              {data.members.find((m) => m.user_id === c.user_id)
                                ?.profiles.display_name || "Samen"}{" "}
                              · {dateLabel(c.created_at)}
                            </small>
                          )}
                        </div>
                      </div>
                    ))}
                    <form
                      className="inline-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const form = e.currentTarget;
                        const f = new FormData(form);
                        mutate(async () => {
                          await addChild(
                            h,
                            childrenKind,
                            item.id,
                            String(f.get("text")),
                          );
                          form.reset();
                        }, "Toegevoegd.");
                      }}
                    >
                      <input
                        aria-label={
                          entity === "ideas"
                            ? "Nieuwe reactie"
                            : "Nieuw onderdeel"
                        }
                        name="text"
                        placeholder={
                          entity === "ideas"
                            ? "Wat vind jij?"
                            : "Voeg een stap toe…"
                        }
                        required
                        maxLength={4000}
                      />
                      <Button size="sm" variant="outline" disabled={pending}>
                        <Plus size={16} />
                        Toevoegen
                      </Button>
                    </form>
                  </div>
                )}
                {entity === "tasks" && (
                  <TaskDiscussion
                    data={data}
                    item={item}
                    mutate={mutate}
                    pending={pending}
                  />
                )}
                {entity === "maintenance_items" && (
                  <div className="form-section">
                    <h3>Uitvoering vastleggen</h3>
                    <p>
                      De volgende datum wordt automatisch berekend vanaf de
                      uitvoerdatum.
                    </p>
                    <div className="form-grid">
                      <label className="field">
                        Uitgevoerd op
                        <input
                          type="date"
                          value={performed}
                          onChange={(e) => setPerformed(e.target.value)}
                          max={today()}
                        />
                      </label>
                      <label className="field">
                        Werkelijke kosten (€)
                        <input
                          value={maintenanceCost}
                          onChange={(e) => setMaintenanceCost(e.target.value)}
                        />
                      </label>
                    </div>
                    <Button
                      disabled={pending}
                      onClick={() =>
                        mutate(
                          () =>
                            completeMaintenance(
                              h,
                              item.id,
                              item.version,
                              performed,
                              cents(maintenanceCost),
                            ),
                          "Onderhoud vastgelegd en volgende datum gepland.",
                        )
                      }
                    >
                      Uitvoering opslaan
                    </Button>
                    <h3>Geschiedenis</h3>
                    {(data.children.maintenance_history || [])
                      .filter((c) => c.maintenance_id === item.id)
                      .map((c) => (
                        <div className="list-row" key={c.id}>
                          <span>{dateLabel(c.performed_on)}</span>
                          <span>{euro(c.cost_cents || 0)}</span>
                        </div>
                      ))}
                    <p className="form-hint">
                      Kosten in de onderhoudshistorie worden niet automatisch
                      een gezamenlijke uitgave. Registreer deze apart bij
                      Financiën.
                    </p>
                  </div>
                )}
                {entity === "documents" && item.storage_path && files([item])}
                {entity === "suppliers" && (
                  <div className="detail-actions">
                    {item.email && (
                      <a
                        className="button button-outline"
                        href={`mailto:${item.email}`}
                      >
                        {item.email}
                      </a>
                    )}
                    {item.phone && (
                      <a
                        className="button button-outline"
                        href={`tel:${item.phone}`}
                      >
                        {item.phone}
                      </a>
                    )}
                  </div>
                )}
                {["tasks", "expenses", "maintenance_items"].includes(
                  entity,
                ) && (
                  <AttachedFiles
                    data={data}
                    entity={entity}
                    item={item}
                    mutate={mutate}
                    pending={pending}
                  />
                )}
                {(entity === "ideas" ||
                  entity === "rooms" ||
                  entity === "tasks") && (
                  <PhotoGallery
                    data={data}
                    entity={entity}
                    item={item}
                    mutate={mutate}
                    pending={pending}
                  />
                )}
              </>
            ) : tab === "Foto’s" ? (
              <PhotoGallery
                data={data}
                entity={entity as "rooms" | "projects"}
                item={item}
                mutate={mutate}
                pending={pending}
              />
            ) : tabEntity[tab] ? (
              <div className="linked-list">
                <div className="section-heading">
                  <h3>{tab}</h3>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      onAdd(tabEntity[tab], linkedExtra);
                    }}
                  >
                    <Plus size={15} />
                    Toevoegen
                  </Button>
                </div>
                {linked(tabEntity[tab]).length ? (
                  tab === "Documenten" ? (
                    files(linked("documents"))
                  ) : (
                    linked(tabEntity[tab]).map((x) => (
                      <button
                        className="record-row"
                        key={x.id}
                        onClick={() => {
                          setTab("Overzicht");
                          onOpen(tabEntity[tab], x);
                        }}
                      >
                        <span className="record-name">
                          <strong>{x.title}</strong>
                          <small>{x.status || x.category || ""}</small>
                        </span>
                        <span>
                          {x.amount_cents ? euro(x.amount_cents) : ""}
                        </span>
                        <ChevronRight size={16} />
                      </button>
                    ))
                  )
                ) : (
                  <p className="small-empty">
                    Nog geen {tab.toLowerCase()} gekoppeld.
                  </p>
                )}
              </div>
            ) : null}
            <div className="dialog-footer">
              {entity === "documents" && (
                <Button
                  variant="destructive"
                  disabled={pending}
                  onClick={() => {
                    if (
                      window.confirm(
                        copy(
                          "Dit document en de bijbehorende galerijfoto verwijderen?",
                        ),
                      )
                    )
                      mutate(async () => {
                        await deleteDocument(h, item.id, item.version);
                        onClose();
                      }, "Document verwijderd.");
                  }}
                >
                  <Trash2 size={15} />
                  Bestand verwijderen
                </Button>
              )}
              {entity !== "expenses" && entity !== "documents" && (
                <>
                  <Button
                    variant="ghost"
                    disabled={pending}
                    onClick={() => {
                      if (
                        window.confirm(
                          copy(
                            `“${item.title}” verwijderen? Gekoppelde gegevens kunnen verwijderen blokkeren.`,
                          ),
                        )
                      )
                        mutate(async () => {
                          await removeRecord(entity, h, item.id, item.version);
                          onClose();
                        }, "Verwijderd.");
                    }}
                  >
                    <Trash2 size={15} />
                    Verwijderen
                  </Button>
                  <Button onClick={onEdit}>Bewerken</Button>
                </>
              )}
            </div>
          </div>
        </Dialog>
      }
    </CopyScope>
  );
}
function PhotoGallery({
  data,
  entity,
  item,
  mutate,
  pending,
}: {
  data: Snapshot;
  entity: "rooms" | "ideas" | "projects" | "tasks";
  item: RecordData;
  mutate: (fn: () => Promise<unknown>, message?: string) => void;
  pending: boolean;
}) {
  const kind =
    entity === "rooms"
      ? "room_photos"
      : entity === "projects"
        ? "project_photos"
        : entity === "tasks"
          ? "task_photos"
          : "idea_photos";
  const photos = (data.children[kind] || []).filter((p) =>
    entity === "rooms"
      ? p.room_id === item.id
      : entity === "projects"
        ? p.project_id === item.id
        : entity === "tasks"
          ? p.task_id === item.id
          : p.idea_id === item.id,
  );
  return (
    <CopyScope>
      {
        <div className="form-section">
          <h3>Jullie fotogalerij</h3>
          <div className="photo-grid">
            {photos.map((p) => (
              <PrivatePhoto key={p.id} photo={p} h={data.household!.id} />
            ))}
          </div>
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const f = new FormData(form);
              f.set("photo_kind", kind);
              f.set("parent_id", item.id);
              f.set("title", item.title + " · foto");
              if (entity === "rooms") f.set("room_id", item.id);
              if (entity === "projects") f.set("project_id", item.id);
              if (entity === "tasks") f.set("task_id", item.id);
              mutate(async () => {
                await uploadFile(data.household!.id, f);
                form.reset();
              }, "Foto privé opgeslagen.");
            }}
          >
            {entity === "projects" && (
              <label className="field">
                Fase
                <select name="caption">
                  <option>Voor</option>
                  <option>Tijdens</option>
                  <option>Na</option>
                </select>
              </label>
            )}
            <input
              aria-label="Foto toevoegen"
              type="file"
              name="file"
              required
              accept="image/jpeg,image/png,image/webp"
            />
            <Button size="sm" variant="outline" disabled={pending}>
              <Upload size={15} />
              Foto bewaren
            </Button>
          </form>
          <p className="form-hint">
            JPG, PNG of WebP · maximaal 3 MB per foto. Voeg meerdere foto’s één
            voor één toe.
          </p>
        </div>
      }
    </CopyScope>
  );
}
function PrivatePhoto({ photo, h }: { photo: Child; h: string }) {
  const { text: copy } = useSiteContent();

  const [url, setUrl] = useState("");
  useEffect(() => {
    let active = true;
    fileURL(h, photo.storage_path!)
      .then((u) => {
        if (active) setUrl(u);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [h, photo.storage_path]);
  return (
    <CopyScope>
      {url ? (
        <a
          title={photo.caption || "Privéfoto"}
          className="private-photo"
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          style={{ backgroundImage: `url("${url}")` }}
          onClick={(event) => {
            event.preventDefault();
            void openPrivateFile(h, photo.storage_path!).catch(() =>
              window.alert(
                copy("Foto openen mislukt. Vernieuw en probeer opnieuw."),
              ),
            );
          }}
          aria-label={
            photo.caption
              ? `Foto ${photo.caption.toLowerCase()} openen`
              : "Privéfoto openen"
          }
        >
          {photo.caption && <span>{photo.caption}</span>}
        </a>
      ) : (
        <div className="skeleton" />
      )}
    </CopyScope>
  );
}
function AttachedFiles({
  data,
  entity,
  item,
  mutate,
  pending,
}: {
  data: Snapshot;
  entity: Entity;
  item: RecordData;
  mutate: (fn: () => Promise<unknown>, message?: string) => void;
  pending: boolean;
}) {
  const field =
    entity === "tasks"
      ? "task_id"
      : entity === "expenses"
        ? "expense_id"
        : "maintenance_id";
  return (
    <CopyScope>
      {
        <div className="form-section">
          <h3>{entity === "expenses" ? "Bonnen en facturen" : "Documenten"}</h3>
          {data.records.documents
            .filter(
              (d) =>
                (d as unknown as Record<string, unknown>)[field] === item.id,
            )
            .map((d) => (
              <button
                className="record-row"
                key={d.id}
                onClick={() =>
                  mutate(async () => {
                    await openPrivateFile(data.household!.id, d.storage_path!);
                  }, "Bestand geopend.")
                }
              >
                <Files size={18} />
                <span className="record-name">
                  <strong>{d.title}</strong>
                  <small>{d.filename}</small>
                </span>
                <Download size={16} />
              </button>
            ))}
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const f = new FormData(form);
              f.set(field, item.id);
              f.set("title", item.title + " · bijlage");
              mutate(async () => {
                await uploadFile(data.household!.id, f);
                form.reset();
              }, "Bijlage privé opgeslagen.");
            }}
          >
            <input
              aria-label="Bijlage toevoegen"
              type="file"
              name="file"
              required
              accept="application/pdf,image/jpeg,image/png,image/webp"
            />
            <Button variant="outline" size="sm" disabled={pending}>
              <Upload size={15} />
              Bewaren
            </Button>
          </form>
          <p className="form-hint">PDF of afbeelding · maximaal 3 MB.</p>
        </div>
      }
    </CopyScope>
  );
}

function TaskDiscussion({
  data,
  item,
  mutate,
  pending,
}: {
  data: Snapshot;
  item: RecordData;
  mutate: (fn: () => Promise<unknown>, message?: string) => void;
  pending: boolean;
}) {
  return (
    <CopyScope>
      {
        <div className="form-section">
          <h3>Opmerkingen</h3>
          {(data.children.task_comments || [])
            .filter((c) => c.task_id === item.id)
            .map((c) => (
              <div className="child-row" key={c.id}>
                <MessageCircle size={16} />
                <div>
                  <p>{c.body}</p>
                  <small>
                    {
                      data.members.find((m) => m.user_id === c.user_id)
                        ?.profiles.display_name
                    }{" "}
                    · {dateLabel(c.created_at)}
                  </small>
                </div>
              </div>
            ))}
          <form
            className="inline-form"
            onSubmit={(e) => {
              e.preventDefault();
              const form = e.currentTarget;
              const text = String(new FormData(form).get("text"));
              mutate(async () => {
                await addChild(
                  data.household!.id,
                  "task_comments",
                  item.id,
                  text,
                );
                form.reset();
              }, "Opmerking toegevoegd.");
            }}
          >
            <input
              aria-label="Nieuwe opmerking"
              name="text"
              required
              maxLength={4000}
              placeholder="Nog iets om aan te denken?"
            />
            <Button disabled={pending} variant="outline" size="sm">
              Plaatsen
            </Button>
          </form>
        </div>
      }
    </CopyScope>
  );
}
