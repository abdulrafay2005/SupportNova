import axios from "axios";

// In production the frontend is served with the API behind the same origin.
// Keep the URL configurable for local development and separate deployments.
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "/";

export const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const localRaw = localStorage.getItem("supportnova.auth");
  const sessionRaw = sessionStorage.getItem("supportnova.auth");

  const raw = localRaw ?? sessionRaw;

  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { token?: string };

      if (parsed.token) {
        config.headers.Authorization = `Bearer ${parsed.token}`;
      }
    } catch {
      // Ignore malformed authentication storage.
    }
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("supportnova.auth");
      sessionStorage.removeItem("supportnova.auth");
    }

    return Promise.reject(error);
  },
);