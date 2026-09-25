import { useEffect, useState, type ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { buttonStyles } from "@/components/Button";
import { useAuth } from "@/auth/AuthContext";
import { cn } from "@/utils/cn";

type NavItem = { label: string; to: string };

const NAV: NavItem[] = [
  { label: "How It Works", to: "/how-it-works" },
  { label: "Help Center", to: "/help-center" },
  { label: "About", to: "/about" },
];

const linkClass =
  "rounded-md px-2.5 py-1.5 text-[13px] font-medium text-ink-secondary transition-colors hover:bg-canvas hover:text-ink";

export function PublicHeader() {
  const { user } = useAuth();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [location.pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const renderItem = (item: NavItem, mobile = false) => {
    const cls = mobile
      ? "block w-full rounded-md px-3 py-2.5 text-left text-[14px] font-medium text-ink-secondary hover:bg-canvas hover:text-ink"
      : linkClass;
    return (
      <NavLink
        key={item.label}
        to={item.to}
        className={({ isActive }) => cn(cls, isActive && "text-ink bg-canvas")}
      >
        {item.label}
      </NavLink>
    );
  };

  return (
    <header
      className={cn(
        "sticky top-0 z-40 border-b bg-surface transition-shadow",
        scrolled ? "border-line shadow-[var(--shadow-panel)]" : "border-line/70",
      )}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link to="/" className="shrink-0" aria-label="SupportNova home">
          <Logo />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-0.5 lg:flex">
          {NAV.map((item) => renderItem(item))}
        </nav>
        <div className="hidden items-center gap-3 lg:flex">
          {user ? (
            <Link to="/dashboard" className={buttonStyles("primary", "md")}>
              Open workspace
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-[13px] font-medium text-ink-secondary hover:text-ink">
                Sign in
              </Link>
              <Link to="/complaints/new" className={buttonStyles("primary", "md")}>
                Submit a complaint
              </Link>
            </>
          )}
        </div>
        <button
          type="button"
          className="rounded-md p-2 text-ink-secondary hover:bg-canvas lg:hidden"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
        >
          <Menu size={20} />
        </button>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Close menu" className="overlay-in absolute inset-0 bg-primary-dark/40" onClick={() => setOpen(false)} />
          <div className="fade-in absolute right-0 top-0 flex h-full w-[300px] max-w-[85vw] flex-col bg-surface shadow-[var(--shadow-overlay)]">
            <div className="flex h-14 items-center justify-between border-b border-line px-4">
              <Logo />
              <button type="button" onClick={() => setOpen(false)} className="rounded-md p-2 text-ink-muted hover:bg-canvas" aria-label="Close menu">
                <X size={18} />
              </button>
            </div>
            <nav aria-label="Mobile" className="flex-1 space-y-0.5 overflow-y-auto p-3">
              {NAV.map((item) => renderItem(item, true))}
              <Link to="/track" className="block rounded-md px-3 py-2.5 text-[14px] font-medium text-ink-secondary hover:bg-canvas">
                Track a complaint
              </Link>
            </nav>
            <div className="space-y-2 border-t border-line p-4">
              {user ? (
                <Link to="/dashboard" className={buttonStyles("primary", "lg", "w-full")}>
                  Open workspace
                </Link>
              ) : (
                <>
                  <Link to="/complaints/new" className={buttonStyles("primary", "lg", "w-full")}>
                    Submit a complaint
                  </Link>
                  <Link to="/login" className={buttonStyles("outline", "lg", "w-full")}>
                    Sign in
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </header>
  );
}

const PUBLIC_FOOTER: { title: string; links: { label: string; to: string }[] }[] = [
  {
    title: "Product",
    links: [
      { label: "How It Works", to: "/how-it-works" },
      { label: "Help Center", to: "/help-center" },
    ],
  },
  {
    title: "Customers",
    links: [
      { label: "Submit Complaint", to: "/complaints/new" },
      { label: "Track Complaint", to: "/track" },
      { label: "My Complaints", to: "/my-complaints" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", to: "/about" },
      { label: "Contact", to: "/contact" },
      { label: "Privacy", to: "/privacy" },
      { label: "Terms", to: "/terms" },
    ],
  },
];

const STAFF_FOOTER: { title: string; links: { label: string; to: string }[] } = {
  title: "Support Teams",
  links: [
    { label: "Dashboard", to: "/dashboard" },
    { label: "Queue", to: "/queue" },
    { label: "Manual Review", to: "/manual-review" },
    { label: "Reports", to: "/reports" },
    { label: "Analytics", to: "/analytics" },
  ],
};

export function PublicFooter() {
  const { user } = useAuth();
  const isStaff = user?.role === "Agent" || user?.role === "Admin";
  const columns = isStaff ? [...PUBLIC_FOOTER, STAFF_FOOTER] : PUBLIC_FOOTER;

  return (
    <footer className="border-t border-line bg-surface">
      <div
        className={cn(
          "mx-auto grid max-w-6xl gap-10 px-4 py-12 sm:px-6",
          isStaff ? "lg:grid-cols-[1.3fr_repeat(4,1fr)]" : "lg:grid-cols-[1.3fr_repeat(3,1fr)]",
        )}
      >
        <div className="max-w-xs">
          <Logo />
          <p className="mt-3 text-[13px] leading-relaxed text-ink-muted">
            Complaint resolution intelligence for clearer customer support.
          </p>
        </div>
        <div
          className={cn(
            "grid grid-cols-2 gap-8 sm:grid-cols-3",
            isStaff ? "sm:grid-cols-4 lg:col-span-4" : "lg:col-span-3",
          )}
        >
          {columns.map((col) => (
            <div key={col.title}>
              <p className="text-[12px] font-semibold uppercase tracking-[0.12em] text-ink">{col.title}</p>
              <ul className="mt-3 space-y-2">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link to={l.to} className="text-[13px] text-ink-muted transition-colors hover:text-primary">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-4 text-[12px] text-ink-faint sm:flex-row sm:justify-between sm:px-6">
          <p>© {new Date().getFullYear()} SupportNova</p>
          <p>Every complaint deserves a clear path forward.</p>
        </div>
      </div>
    </footer>
  );
}

/** Full-width public page frame: header, content, footer. */
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-full flex-col bg-surface">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}