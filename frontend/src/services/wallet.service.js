import { apiGet } from "@/services/apiClient";

export const getWalletBalance = async () => {
  const payload = await apiGet("/wallet");
  return payload?.data?.balance || "0";
};

