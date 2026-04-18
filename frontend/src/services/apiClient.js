import { API_BASE_URL } from "@/lib/config";

const JWT_STORAGE_KEY = "jwt_token";

const getTokenFromStorage = () => {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage.getItem(JWT_STORAGE_KEY);
};

const toHeaders = (customHeaders = {}) => {
  const headers = {
    "Content-Type": "application/json",
    ...customHeaders,
  };

  const token = getTokenFromStorage();
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
};

const parseResponse = async (response) => {
  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.message || "Request failed";
    throw new Error(message);
  }

  return payload;
};

export const apiRequest = async (path, options = {}) => {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers: toHeaders(options.headers),
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: "no-store",
  });

  return parseResponse(response);
};

export const apiGet = (path) => apiRequest(path, { method: "GET" });
export const apiPost = (path, body) => apiRequest(path, { method: "POST", body });
export const JWT_KEY = JWT_STORAGE_KEY;
