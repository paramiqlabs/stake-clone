import { apiPost } from "@/services/apiClient";

export const placeBet = async ({ gameId, amount }) => {
  const payload = await apiPost("/bet", { gameId, amount });
  return payload?.data || payload;
};

