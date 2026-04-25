import { apiPost } from "@/services/apiClient";

export const playDice = async ({ amount, target }) => {
  const payload = await apiPost("/games/dice/play", { amount, target });
  return payload?.data || null;
};
