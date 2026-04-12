const dotenv = require("dotenv");
const jwt = require("jsonwebtoken");

dotenv.config();

const authenticateSocket = (socket, next) => {
  try {
    const token = socket.handshake?.auth?.token;

    if (!process.env.JWT_SECRET) {
      return next(new Error("JWT_SECRET is missing"));
    }

    if (!token || typeof token !== "string") {
      return next(new Error("Unauthorized"));
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    socket.user = {
      id: String(payload.userId),
      role: payload.role,
    };

    return next();
  } catch (error) {
    return next(new Error("Unauthorized"));
  }
};

module.exports = {
  authenticateSocket,
};
