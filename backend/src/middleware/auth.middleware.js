const jwt = require("jsonwebtoken");

const extractToken = (authHeader = "") => {
  if (!authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice(7).trim();
};

const authenticate = (req, res, next) => {
  try {
    if (!process.env.JWT_SECRET) {
      return res
        .status(500)
        .json({ success: false, message: "JWT_SECRET is missing" });
    }

    const token = extractToken(req.headers.authorization);
    if (!token) {
      return res
        .status(401)
        .json({ success: false, message: "Authorization token required" });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = {
      id: payload.userId,
      role: payload.role,
    };

    return next();
  } catch (error) {
    return res.status(401).json({ success: false, message: "Invalid token" });
  }
};

const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ success: false, message: "Admin access required" });
  }

  return next();
};

module.exports = {
  authenticate,
  requireAdmin,
};
