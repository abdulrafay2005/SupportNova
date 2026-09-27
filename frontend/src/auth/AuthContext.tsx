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
  loading: boolean;
}

/*
 * NOTE: there is no `users` list on the auth context.
 *
 * Staff administration reads the real directory from
 * GET /api/admin/users (Admin only) and the assigned agent on a
 * complaint comes from the complaint detail response, so no screen
 * needs — or is allowed — a client-side copy of the user table.
 */

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
}

/*
 * NOTE: there is no `updateProfile` on the auth context.
 *
 * The API exposes no self-service profile update, so mutating the
 * cached user locally would show a change that the server never
 * stored. Staff details are edited by an Admin through
 * PATCH /api/admin/users/{user_id}.
 */

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

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      logout,
    }),
    [
      user,
      loading,
      login,
      register,
      logout,
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