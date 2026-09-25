import axios from "axios";

/**
 * HTTP client for the SupportNova API.
 * Base URL points at the local FastAPI service.
 * JWT interceptors will be added when authentication endpoints exist.
 * Do not call live endpoints from the UI until backend integration is approved.
 */
export const api = axios.create({
  baseURL: "http://127.0.0.1:8000",
  timeout: 10000,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use((config) => {
  const raw = localStorage.getItem("supportnova.auth");
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as { token?: string };
      if (parsed.token) {
        config.headers.Authorization = `Bearer ${parsed.token}`;
      }
    } catch {
      /* ignore malformed storage */
    }
  }
  return config;
});
