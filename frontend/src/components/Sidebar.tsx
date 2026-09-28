import { NavLink,useNavigate } from "react-router-dom";
import {
  BarChart3,
  BookOpen,
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  FileBarChart,
  FileStack,
  Inbox,
  LayoutDashboard,
  ListTodo,
  LogOut,
  Plus,
  ScrollText,
  Settings,
  Shield,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { Logo } from "@/components/Logo";
import { useAuth } from "@/auth/AuthContext";
import { useUi } from "@/context/UiContext";
import { cn } from "@/utils/cn";
import type { Role } from "@/types";


interface Item {
  to: string;
  label: string;
  icon: typeof Inbox;
  roles?: Role[];
}

interface Section {
  label?: string;
  items: Item[];
}

const staffSections: Section[] = [
  { items: [{ to: "/dashboard", label: "Overview", icon: LayoutDashboard }] },
  {
    label: "Workspace",
    items: [
      { to: "/complaints", label: "All Complaints", icon: Inbox },
      { to: "/queue", label: "My Queue", icon: ListTodo, roles: ["Agent"] },
      { to: "/manual-review", label: "Manual Review", icon: ClipboardCheck, roles: ["Reviewer"] },
    ],
  },
  {
    label: "Knowledge",
    items: [{ to: "/help-center", label: "Help Center", icon: BookOpen }],
  },
  {
    label: "Insights",
    items: [
      { to: "/analytics", label: "Analytics", icon: BarChart3, roles: ["Manager", "Admin"] },
      { to: "/reports", label: "Reports", icon: FileBarChart, roles: ["Manager", "Admin"] },
    ],
  },
  {
    label: "Administration",
    items: [
      { to: "/users", label: "Staff & Users", icon: Users, roles: ["Admin"] },
      { to: "/departments", label: "Departments", icon: Building2, roles: ["Admin"] },
      { to: "/documents", label: "Documents", icon: FileStack, roles: ["Admin"] },
      { to: "/audit-logs", label: "Audit Logs", icon: ScrollText, roles: ["Admin"] },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/profile", label: "Profile", icon: UserRound },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

const customerSections: Section[] = [
  { items: [{ to: "/dashboard", label: "Overview", icon: LayoutDashboard }] },
  {
    label: "Workspace",
    items: [
      { to: "/my-complaints", label: "My Complaints", icon: Inbox },
      { to: "/complaints/new", label: "Submit Complaint", icon: Plus },
      { to: "/help-center", label: "Help Center", icon: BookOpen },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/profile", label: "Profile", icon: UserRound },
      { to: "/settings", label: "Settings", icon: Settings },
    ],
  },
];

function NavItems({ collapsed, onNavigate }: { collapsed: boolean; onNavigate?: () => void }) {
  const { user, logout } = useAuth();
  const sections = user?.role === "Customer" ? customerSections : staffSections;

  return (
    <div className="flex h-full flex-col">
      <nav className="flex-1 overflow-y-auto px-2 py-3 scrollbar-thin">
        {sections.map((section, si) => {
          const visible = section.items.filter((item) => !item.roles || (user && item.roles.includes(user.role)));
          if (visible.length === 0) return null;
          return (
            <div key={section.label ?? `s-${si}`} className={cn(si > 0 && "mt-4")}>
              {section.label && !collapsed && (
                <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-nav-muted">
                  {section.label}
                </p>
              )}
              {collapsed && si > 0 && <div className="mx-2 mb-2 border-t border-secondary-dark" />}
              <ul className="space-y-0.5">
                {visible.map((item) => {
                  const Icon = item.icon;
                  return (
                    <li key={item.to}>
                      <NavLink
                        to={item.to}
                        end
                        title={collapsed ? item.label : undefined}
                        onClick={onNavigate}
                        className={({ isActive }) =>
                          cn(
                            "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] font-medium transition-colors",
                            collapsed && "justify-center px-0",
                            isActive
                              ? "bg-nav-active text-white"
                              : "text-nav-text/80 hover:bg-nav-hover hover:text-white",
                          )
                        }
                      >
                        <Icon size={16} className="shrink-0" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </div>
          );
        })}
      </nav>
      <div className="border-t border-secondary-dark p-2">
        <button
          type="button"
          onClick={logout}
          title={collapsed ? "Log out" : undefined}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] font-medium text-nav-text/80 hover:bg-nav-hover hover:text-white",
            collapsed && "justify-center px-0",
          )}
        >
          <LogOut size={16} />
          {!collapsed && "Log out"}
        </button>
      </div>
    </div>
  );
}

export function Sidebar() {
   const navigate = useNavigate();
  const { collapsed, mobileOpen, toggleCollapsed, closeMobile } = useUi();
  

  return (
    <>
      <aside
        className={cn(
          "hidden h-full shrink-0 flex-col bg-nav text-nav-text md:flex",
          collapsed ? "w-16" : "w-[232px]",
        )}
      >
        <div className={cn("flex h-[52px] items-center border-b border-secondary-dark", collapsed ? "justify-center px-2" : "justify-between px-3")}>
          <Logo compact={collapsed} light />
          <button
            type="button"
            onClick={toggleCollapsed}
            className={cn("rounded-md p-1 text-nav-muted hover:bg-nav-hover hover:text-white", collapsed && "hidden")}
            aria-label="Collapse sidebar"
          >
            <ChevronLeft size={16} />
          </button>
        </div>
        {collapsed && (
          <div className="flex justify-center border-b border-secondary-dark py-1.5">
            <button type="button" onClick={toggleCollapsed} className="rounded-md p-1 text-nav-muted hover:bg-nav-hover hover:text-white" aria-label="Expand sidebar">
              <ChevronRight size={16} />
            </button>
          </div>
        )}
        <NavItems collapsed={collapsed} />
      </aside>

      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <button type="button" aria-label="Close menu" className="overlay-in absolute inset-0 bg-ink/40" onClick={closeMobile} />
          <aside className="fade-in relative z-10 flex h-full w-[232px] flex-col bg-nav text-nav-text shadow-[var(--shadow-overlay)]">
            <div className="flex h-[52px] items-center justify-between border-b border-secondary-dark px-3">
              <Logo light />
              <button type="button" onClick={closeMobile} className="rounded-md p-1 text-nav-muted hover:bg-nav-hover" aria-label="Close menu">
                <X size={16} />
              </button>
            </div>
            <NavItems collapsed={false} onNavigate={closeMobile} />
          </aside>
        </div>
      )}
    </>
  );
}
