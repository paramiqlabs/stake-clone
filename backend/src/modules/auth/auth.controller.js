const authService = require("./auth.service");

const isBadRequestError = (message) =>
  message.includes("required") ||
  message.includes("Valid email") ||
  message.includes("at least 6") ||
  message.includes("already registered") ||
  message.includes("Request body");

const register = async (req, res) => {
  try {
    const result = await authService.register(req.body);
    return res.status(201).json({ success: true, data: result });
  } catch (error) {
    const message = error?.message || "Internal server error";
    if (isBadRequestError(message)) {
      return res.status(400).json({ success: false, message });
    }

    return res.status(500).json({ success: false, message });
  }
};

const login = async (req, res) => {
  try {
    const result = await authService.login(req.body);
    return res.status(200).json({ success: true, data: result });
  } catch (error) {
    const message = error?.message || "Internal server error";

    if (message === "Invalid credentials") {
      return res.status(401).json({ success: false, message });
    }

    if (isBadRequestError(message)) {
      return res.status(400).json({ success: false, message });
    }

    return res.status(500).json({ success: false, message });
  }
};

module.exports = {
  register,
  login,
};
