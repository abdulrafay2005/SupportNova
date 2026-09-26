import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  getMe,
  login as apiLogin,
  register as apiRegister,
} from "@/api/auth";

import type { User } from "@/types";

const STORAGE_KEY = "supportnova.auth";

interface StoredAuth {
  user: User;
  token: string;
}

interface AuthState {
  user: User | null;
  users: User[];
  loading: boolean;
}

interface AuthContextValue extends AuthState {
  login: (
    email: string,
    password: string,
    remember?: boolean,
  ) => Promise<{ ok: boolean; error?: string }>;

  register: (
    name: string,
    email: string,
    password: string,
  ) => Promise<{ ok: boolean; error?: string }>;

  logout: () => void;

  updateProfile: (
    patch: Partial<Pick<User, "name" | "phone">>,
  ) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredAuth(): StoredAuth | null {
  try {
    const localRaw = localStorage.getItem(STORAGE_KEY);
    const sessionRaw = sessionStorage.getItem(STORAGE_KEY);

    const raw = localRaw ?? sessionRaw;

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredAuth>;

    if (!parsed.user || !parsed.token) {
      return null;
    }

    return {
      user: parsed.user,
      token: parsed.token,
    };
  } catch {
    return null;
  }
}

function persistAuth(
  auth: StoredAuth | null,
  remember = true,
) {
  localStorage.removeItem(STORAGE_KEY);
  sessionStorage.removeItem(STORAGE_KEY);

  if (!auth) {
    return;
  }

  const value = JSON.stringify(auth);

  if (remember) {
    localStorage.setItem(STORAGE_KEY, value);
  } else {
    sessionStorage.setItem(STORAGE_KEY, value);
  }
}

function getApiErrorMessage(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error
  ) {
    const response = (
      error as {
        response?: {
          data?: {
            detail?: string | Array<{ msg?: string }>;
          };
        };
      }
    ).response;

    const detail = response?.data?.detail;

    if (typeof detail === "string") {
      return detail;
    }

    if (Array.isArray(detail)) {
      const messages = detail
        .map((item) => item?.msg)
        .filter(Boolean);

      if (messages.length) {
        return messages.join(", ");
      }
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Something went wrong. Please try again.";
}

export function AuthProvider({
  children,
}: {
  children: ReactNode;
}) {
  const storedAuth = readStoredAuth();

  const [user, setUser] = useState<User | null>(
    storedAuth?.user ?? null,
  );

  const [loading, setLoading] = useState(
    Boolean(storedAuth?.token),
  );

  /*
   * Kept temporarily because existing frontend components may still
   * expect `users` from the AuthContext.
   *
   * User administration will later use the real backend users API.
   */
  const [users] = useState<User[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const stored = readStoredAuth();

      if (!stored?.token) {
        setLoading(false);
        return;
      }

      try {
        const currentUser = await getMe();

        if (cancelled) {
          return;
        }

        setUser(currentUser);

        persistAuth(
          {
            token: stored.token,
            user: currentUser,
          },
          Boolean(localStorage.getItem(STORAGE_KEY)),
        );
      } catch {
        if (cancelled) {
          return;
        }

        localStorage.removeItem(STORAGE_KEY);
        sessionStorage.removeItem(STORAGE_KEY);
        setUser(null);
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (
      email: string,
      password: string,
      remember = true,
    ) => {
      try {
        const session = await apiLogin({
          email: email.trim().toLowerCase(),
          password,
        });

        setUser(session.user);

        persistAuth(
          {
            user: session.user,
            token: session.token,
          },
          remember,
        );

        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: getApiErrorMessage(error),
        };
      }
    },
    [],
  );

  const register = useCallback(
    async (
      name: string,
      email: string,
      password: string,
    ) => {
      try {
        const session = await apiRegister({
          name: name.trim(),
          email: email.trim().toLowerCase(),
          password,
        });

        setUser(session.user);

        persistAuth(
          {
            user: session.user,
            token: session.token,
          },
          true,
        );

        return { ok: true };
      } catch (error) {
        return {
          ok: false,
          error: getApiErrorMessage(error),
        };
      }
    },
    [],
  );

  const logout = useCallback(() => {
    setUser(null);

    localStorage.removeItem(STORAGE_KEY);
    sessionStorage.removeItem(STORAGE_KEY);
  }, []);

  const updateProfile = useCallback(
    (
      patch: Partial<Pick<User, "name" | "phone">>,
    ) => {
      setUser((previous) => {
        if (!previous) {
          return previous;
        }

        const next = {
          ...previous,
          ...patch,
        };

        const localRaw = localStorage.getItem(STORAGE_KEY);
        const sessionRaw = sessionStorage.getItem(STORAGE_KEY);

        const raw = localRaw ?? sessionRaw;

        if (raw) {
          try {
            const stored = JSON.parse(raw) as StoredAuth;

            persistAuth(
              {
                token: stored.token,
                user: next,
              },
              Boolean(localRaw),
            );
          } catch {
            // Ignore malformed local authentication data.
          }
        }

        return next;
      });
    },
    [],
  );

  const value = useMemo(
    () => ({
      user,
      users,
      loading,
      login,
      register,
      logout,
      updateProfile,
    }),
    [
      user,
      users,
      loading,
      login,
      register,
      logout,
      updateProfile,
    ],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error(
      "useAuth must be used within AuthProvider",
    );
  }

  return context;
}