import { apiPost } from "@/services/apiClient";

export const register = async ({ email, password }) => {
  const payload = await apiPost("/auth/register", { email, password });
  return payload?.data || payload;
};

export const login = async ({ email, password }) => {
  const payload = await apiPost("/auth/login", { email, password });
  return payload?.token;
};

