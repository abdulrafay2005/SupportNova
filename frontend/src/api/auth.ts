import { api } from "@/api/client";
import type { Role, User } from "@/types";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

interface BackendUser {
  id: string;
  name: string;
  email: string;
  role: string;
  status?: User["status"];
  phone?: string | null;
  created_at?: string;
  updated_at?: string;
  last_active?: string | null;
}

interface BackendAuthResponse {
  access_token?: string;
  token?: string;
  token_type?: string;
  user?: BackendUser;
}

function normalizeRole(role: string): Role {
  switch (role.toLowerCase()) {
    case "customer":
      return "Customer";
    case "agent":
      return "Agent";
    case "reviewer":
      return "Reviewer";
    case "manager":
      return "Manager";
    case "admin":
      return "Admin";
    default:
      return "Customer";
  }
}

export function normalizeUser(user: BackendUser): User {
  const now = new Date().toISOString();

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: normalizeRole(user.role),
    status: user.status ?? "Active",
    phone: user.phone ?? undefined,
    lastActive: user.last_active ?? now,
    createdAt: user.created_at ?? now,
  };
}

export async function login(
  payload: LoginPayload,
): Promise<AuthSession> {
  const response = await api.post<BackendAuthResponse>(
    "/api/auth/login",
    payload,
  );

  const data = response.data;

  const token = data.access_token ?? data.token;

  if (!token) {
    throw new Error(
      "Login succeeded but no authentication token was returned.",
    );
  }

  if (!data.user) {
    throw new Error(
      "Login succeeded but no user information was returned.",
    );
  }

  return {
    token,
    user: normalizeUser(data.user),
  };
}

export async function register(
  payload: RegisterPayload,
): Promise<AuthSession> {
  /*
   * Registration creates the account.
   * The current backend registration endpoint does not return a JWT,
   * so authenticate immediately afterward using the same credentials.
   */

  await api.post("/api/auth/register", payload);

  return login({
    email: payload.email,
    password: payload.password,
  });
}

export async function getMe(): Promise<User> {
  const response = await api.get<BackendUser>("/api/auth/me");

  return normalizeUser(response.data);
}

export interface AuthSession {
  user: User;
  token: string;
}