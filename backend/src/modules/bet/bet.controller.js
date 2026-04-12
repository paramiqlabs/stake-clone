const betService = require("./bet.service");

const isBadRequestError = (message) =>
  message.includes("Invalid user id") ||
  message.includes("Invalid gameId") ||
  message.includes("Invalid bet id") ||
  message.includes("amount is required") ||
  message.includes("Invalid amount") ||
  message.includes("amount must be greater than 0") ||
  message.includes("result must be") ||
  message.includes("payout is required") ||
  message.includes("Invalid payout") ||
  message.includes("payout must be greater than 0") ||
  message.includes("Insufficient balance") ||
  message.includes("already resolved") ||
  message.includes("Game is not available") ||
  message.includes("Wallet not found");

const placeBet = async (req, res) => {
  try {
    const data = await betService.placeBet(req.user.id, req.body);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    const message = error?.message || "Internal server error";
    const status = isBadRequestError(message) ? 400 : 500;
    return res.status(status).json({ success: false, message });
  }
};

const resolveBet = async (req, res) => {
  try {
    const data = await betService.resolveBet(req.params.id, req.body);
    return res.status(200).json({ success: true, data });
  } catch (error) {
    const message = error?.message || "Internal server error";
    if (message === "Bet not found") {
      return res.status(404).json({ success: false, message });
    }

    const status = isBadRequestError(message) ? 400 : 500;
    return res.status(status).json({ success: false, message });
  }
};

module.exports = {
  placeBet,
  resolveBet,
};
