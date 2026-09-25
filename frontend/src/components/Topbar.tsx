import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, Menu, Search } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { useAuth } from "@/auth/AuthContext";
import { useData } from "@/context/DataContext";
import { useUi } from "@/context/UiContext";
import { formatRelative } from "@/utils/dates";
import { cn } from "@/utils/cn";

export function Topbar() {
  const { user, logout } = useAuth();
  const { complaints, customers, articles, notifications, markNotificationRead, markAllNotificationsRead } =
    useData();
  const { openMobile } = useUi();
  const navigate = useNavigate();

  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const noteRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      const t = e.target as Node;
      if (searchRef.current && !searchRef.current.contains(t)) setSearchOpen(false);
      if (noteRef.current && !noteRef.current.contains(t)) setNoteOpen(false);
      if (menuRef.current && !menuRef.current.contains(t)) setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];
    const ticketHits = complaints
      .filter(
        (c) =>
          c.id.toLowerCase().includes(q) ||
          c.subject.toLowerCase().includes(q) ||
          c.description.toLowerCase().includes(q),
      )
      .slice(0, 5)
      .map((c) => ({
        type: "Complaint",
        label: c.id,
        sub: c.subject,
        to: `/complaints/${c.id}`,
      }));
    const customerHits = customers
      .filter((c) => c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || (c.reference ?? "").toLowerCase().includes(q))
      .slice(0, 4)
      .map((c) => ({
        type: "Customer",
        label: c.name,
        sub: c.email,
        to: `/complaints?q=${encodeURIComponent(c.name)}`,
      }));
    const articleHits = articles
      .filter((a) => a.title.toLowerCase().includes(q) || a.summary.toLowerCase().includes(q))
      .slice(0, 3)
      .map((a) => ({
        type: "Article",
        label: a.title,
        sub: a.category,
        to: `/help-center/${a.id}`,
      }));
    return [...ticketHits, ...customerHits, ...articleHits];
  }, [query, complaints, customers, articles]);

  const unread = notifications.filter((n) => !n.read).length;
  if (!user) return null;

  return (
    <header className="flex h-[52px] shrink-0 items-center gap-3 border-b border-line bg-surface px-3 sm:px-4">
      <button
        type="button"
        className="rounded-md p-1.5 text-ink-secondary hover:bg-canvas md:hidden"
        onClick={openMobile}
        aria-label="Open menu"
      >
        <Menu size={18} />
      </button>

      <div ref={searchRef} className="relative min-w-0 flex-1 max-w-xl">
        <Search size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSearchOpen(true);
          }}
          onFocus={() => setSearchOpen(true)}
          placeholder="Search complaints, customers, or IDs..."
          className="h-8 w-full rounded-md border border-line bg-canvas-subtle pl-8 pr-3 text-[13px] text-ink placeholder:text-ink-faint hover:border-line-strong focus:border-primary focus:bg-surface"
        />
        {searchOpen && query.trim().length >= 2 && (
          <div className="absolute z-30 mt-1 w-full overflow-hidden rounded-md border border-line bg-surface shadow-[var(--shadow-overlay)]">
            {results.length === 0 ? (
              <p className="px-3 py-3 text-[13px] text-ink-muted">No matches for “{query.trim()}”.</p>
            ) : (
              <ul className="max-h-80 overflow-y-auto py-1">
                {results.map((r) => (
                  <li key={r.type + r.to + r.label}>
                    <button
                      type="button"
                      className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-canvas-subtle"
                      onClick={() => {
                        navigate(r.to);
                        setQuery("");
                        setSearchOpen(false);
                      }}
                    >
                      <span className="mt-0.5 w-16 shrink-0 text-[10px] font-semibold uppercase tracking-wide text-ink-faint">
                        {r.type}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-medium text-ink">{r.label}</span>
                        <span className="block truncate text-[12px] text-ink-muted">{r.sub}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      <div className="ml-auto flex items-center gap-1 sm:gap-2">
        <div ref={noteRef} className="relative">
          <button
            type="button"
            onClick={() => setNoteOpen((v) => !v)}
            className="relative rounded-md p-1.5 text-ink-secondary hover:bg-canvas"
            aria-label="Notifications"
          >
            <Bell size={18} />
            {unread > 0 && (
              <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-danger" />
            )}
          </button>
          {noteOpen && (
            <div className="absolute right-0 z-30 mt-1 w-[320px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-md border border-line bg-surface shadow-[var(--shadow-overlay)]">
              <div className="flex items-center justify-between border-b border-line px-3 py-2">
                <p className="text-[13px] font-semibold text-ink">Notifications</p>
                {unread > 0 && (
                  <button
                    type="button"
                    className="text-[12px] text-primary hover:underline"
                    onClick={markAllNotificationsRead}
                  >
                    Mark all read
                  </button>
                )}
              </div>
              <ul className="max-h-80 overflow-y-auto">
                {notifications.slice(0, 8).map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      className={cn(
                        "flex w-full flex-col items-start px-3 py-2.5 text-left hover:bg-canvas-subtle",
                        !n.read && "bg-primary-subtle/40",
                      )}
                      onClick={() => {
                        markNotificationRead(n.id);
                        setNoteOpen(false);
                        navigate(n.href);
                      }}
                    >
                      <span className="text-[13px] font-medium text-ink">{n.title}</span>
                      <span className="text-[12px] text-ink-muted">{n.body}</span>
                      <span className="mt-0.5 text-[11px] text-ink-faint">{formatRelative(n.timestamp)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <div ref={menuRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            className="flex items-center gap-2 rounded-md py-1 pl-1 pr-2 hover:bg-canvas"
          >
            <Avatar name={user.name} size="sm" />
            <span className="hidden text-left sm:block">
              <span className="block text-[13px] font-medium leading-4 text-ink">{user.name}</span>
              <span className="block text-[11px] leading-4 text-ink-muted">{user.role}</span>
            </span>
          </button>
          {menuOpen && (
            <div className="absolute right-0 z-30 mt-1 w-48 overflow-hidden rounded-md border border-line bg-surface py-1 shadow-[var(--shadow-overlay)]">
              <Link
                to="/profile"
                className="block px-3 py-1.5 text-[13px] text-ink-secondary hover:bg-canvas"
                onClick={() => setMenuOpen(false)}
              >
                Profile
              </Link>
              <Link
                to="/settings"
                className="block px-3 py-1.5 text-[13px] text-ink-secondary hover:bg-canvas"
                onClick={() => setMenuOpen(false)}
              >
                Settings
              </Link>
              <button
                type="button"
                className="block w-full px-3 py-1.5 text-left text-[13px] text-ink-secondary hover:bg-canvas"
                onClick={() => {
                  setMenuOpen(false);
                  logout();
                }}
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
