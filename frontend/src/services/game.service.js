import { apiGet } from "@/services/apiClient";

export const fetchGames = async () => {
  const payload = await apiGet("/games");
  return payload?.data || [];
};

export const fetchGameBySlug = async (slug) => {
  const games = await fetchGames();
  return games.find((game) => game.slug === slug) || null;
};
