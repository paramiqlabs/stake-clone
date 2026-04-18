import { apiGet, apiPost } from "@/services/apiClient";

export const placeBet = async ({ gameId, amount }) => {
  const payload = await apiPost("/bet", { gameId, amount });
  return payload?.data || payload;
};

export const getMyBets = async (limit = 20) => {
  const payload = await apiGet(`/bets/me?limit=${limit}`);
  return payload?.data || [];
};
