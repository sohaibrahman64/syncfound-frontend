import { BASE_URL } from "./Constants";

const API_BASE_URL = String(process.env.EXPO_PUBLIC_API_BASE_URL || BASE_URL)
  .trim()
  .replace(/^['\"]|['\"]$/g, "")
  .replace(/\/$/, "");

export async function apiFetch(path, options = {}) {
  const normalizedPath = String(path || "").replace(/^\/+/, "");
  const url = `${API_BASE_URL}/${normalizedPath}`;
  const isFormData =
    typeof FormData !== "undefined" && options.body instanceof FormData;

  return fetch(url, {
    ...options,
    headers: {
      "ngrok-skip-browser-warning": "true",
      ...(!isFormData ? { "Content-Type": "application/json" } : {}),
      ...(options.headers || {}),
    },
  });
}