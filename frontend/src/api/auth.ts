import type { Role, User } from "@/types";

/**
 * Prepared auth service. Real endpoints do not exist yet:
 *   POST /api/auth/login
 *   POST /api/auth/register
 *   POST /api/auth/logout
 *
 * Do not call them. Login is handled in AuthContext against mock users.
 */

export interface LoginPayload {
  email: string;
  password: string;
}

export interface RegisterPayload {
  name: string;
  email: string;
  password: string;
}

export interface AuthSession {
  user: User;
  token?: string;
}

export function toCustomerUser(name: string, email: string): User {
  const now = new Date().toISOString();
  return {
    id: `c-${Date.now()}`,
    name,
    email,
    role: "Customer" as Role,
    status: "Active",
    lastActive: now,
    createdAt: now,
  };
}
