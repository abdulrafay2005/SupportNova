import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { DEMO_PASSWORD, users as seedUsers } from "@/data/mockData";
import { toCustomerUser } from "@/api/auth";
import type { User } from "@/types";

const STORAGE_KEY = "supportnova.auth";

interface AuthState {
  user: User | null;
  users: User[];
}

interface AuthContextValue extends AuthState {
  login: (email: string, password: string, remember?: boolean) => { ok: boolean; error?: string };
  register: (name: string, email: string, password: string) => { ok: boolean; error?: string };
  logout: () => void;
  updateProfile: (patch: Partial<Pick<User, "name" | "phone">>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredUser(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { user?: User };
    return parsed.user ?? null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const stored = readStoredUser();
  const [user, setUser] = useState<User | null>(stored);
  const [users, setUsers] = useState<User[]>(() => {
    if (stored && !seedUsers.some((u) => u.email === stored.email)) {
      return [...seedUsers, stored];
    }
    return seedUsers;
  });

  const persist = (next: User | null, remember = true) => {
    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
    if (!next) return;
    const payload = JSON.stringify({ user: next });
    if (remember) localStorage.setItem(STORAGE_KEY, payload);
    else sessionStorage.setItem(STORAGE_KEY, payload);
  };

  const login = useCallback(
    (email: string, password: string, remember = true) => {
      const found = users.find((u) => u.email.toLowerCase() === email.trim().toLowerCase());
      if (!found) return { ok: false, error: "No account found for that email." };
      if (found.status !== "Active") return { ok: false, error: "This account is inactive. Contact an administrator." };
      if (password !== DEMO_PASSWORD) return { ok: false, error: "Incorrect password." };
      const next = { ...found, lastActive: new Date().toISOString() };
      setUser(next);
      persist(next, remember);
      return { ok: true };
    },
    [users],
  );

  const register = useCallback(
    (name: string, email: string, password: string) => {
      if (users.some((u) => u.email.toLowerCase() === email.trim().toLowerCase())) {
        return { ok: false, error: "An account with that email already exists." };
      }
      if (password.length < 8) return { ok: false, error: "Password must be at least 8 characters." };
      const created = toCustomerUser(name.trim(), email.trim().toLowerCase());
      setUsers((prev) => [...prev, created]);
      setUser(created);
      persist(created);
      return { ok: true };
    },
    [users],
  );

  const logout = useCallback(() => {
    setUser(null);
    persist(null);
  }, []);

  const updateProfile = useCallback((patch: Partial<Pick<User, "name" | "phone">>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      persist(next);
      setUsers((list) => list.map((u) => (u.id === next.id ? { ...u, ...patch } : u)));
      return next;
    });
  }, []);

  const value = useMemo(
    () => ({ user, users, login, register, logout, updateProfile }),
    [user, users, login, register, logout, updateProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
