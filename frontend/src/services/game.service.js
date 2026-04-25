import { apiGet, apiPost } from "@/services/apiClient";

export const fetchGames = async () => {
  const payload = await apiGet("/games");
  return payload?.data || [];
};

export const fetchGameBySlug = async (slug) => {
  const games = await fetchGames();
  return games.find((game) => game.slug === slug) || null;
};

export const launchGame = async (gameId) => {
  const payload = await apiPost(`/games/${gameId}/launch`, {});
  return payload?.data || null;
};
