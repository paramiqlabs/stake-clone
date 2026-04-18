import { apiGet } from "@/services/apiClient";

export const fetchGames = async () => {
  const payload = await apiGet("/games");
  return payload?.data || [];
};

