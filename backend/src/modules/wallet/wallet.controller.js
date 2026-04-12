const walletService = require("./wallet.service");

const isBadRequestError = (message) =>
  message.includes("Invalid user id") ||
  message.includes("Amount is required") ||
  message.includes("Invalid amount") ||
  message.includes("Amount must be greater than 0") ||
  message.includes("Insufficient balance");

const getWallet = async (req, res) => {
  try {
    const wallet = await walletService.getWallet(req.user.id);
    return res.status(200).json({ success: true, data: wallet });
  } catch (error) {
    const message = error?.message || "Internal server error";
    const status = isBadRequestError(message) ? 400 : 500;
    return res.status(status).json({ success: false, message });
  }
};

const deposit = async (req, res) => {
  try {
    const result = await walletService.deposit(req.user.id, req.body);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const message = error?.message || "Internal server error";
    const status = isBadRequestError(message) ? 400 : 500;
    return res.status(status).json({ success: false, message });
  }
};

const withdraw = async (req, res) => {
  try {
    const result = await walletService.withdraw(req.user.id, req.body);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const message = error?.message || "Internal server error";
    const status = isBadRequestError(message) ? 400 : 500;
    return res.status(status).json({ success: false, message });
  }
};

module.exports = {
  getWallet,
  deposit,
  withdraw,
};
