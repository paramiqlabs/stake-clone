const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const prisma = require("../../lib/prisma");

const JWT_EXPIRES_IN = "7d";
const BCRYPT_SALT_ROUNDS = 10;

const ensureAuthConfig = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing. Set it in backend/.env.");
  }
};

const sanitizeUser = (user) => ({
  id: user.id.toString(),
  email: user.email,
  role: user.role,
  createdAt: user.createdAt,
});

const signToken = (user) =>
  jwt.sign(
    { userId: user.id.toString(), role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: JWT_EXPIRES_IN }
  );

const validateRegisterPayload = (payload) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Request body must be a JSON object");
  }

  const email = String(payload.email || "").trim().toLowerCase();
  const password = String(payload.password || "");

  if (!email || !email.includes("@")) {
    throw new Error("Valid email is required");
  }

  if (password.length < 6) {
    throw new Error("Password must be at least 6 characters");
  }

  return { email, password };
};

const validateLoginPayload = (payload) => {
  if (!payload || typeof payload !== "object") {
    throw new Error("Request body must be a JSON object");
  }

  const email = String(payload.email || "").trim().toLowerCase();
  const password = String(payload.password || "");

  if (!email || !password) {
    throw new Error("Email and password are required");
  }

  return { email, password };
};

const register = async (payload) => {
  ensureAuthConfig();
  const { email, password } = validateRegisterPayload(payload);

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    throw new Error("Email already registered");
  }

  const hashedPassword = await bcrypt.hash(password, BCRYPT_SALT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      email,
      password: hashedPassword,
      role: "user",
    },
  });

  const token = signToken(user);
  return { user: sanitizeUser(user), token };
};

const login = async (payload) => {
  ensureAuthConfig();
  const { email, password } = validateLoginPayload(payload);

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    throw new Error("Invalid credentials");
  }

  const isValidPassword = await bcrypt.compare(password, user.password);
  if (!isValidPassword) {
    throw new Error("Invalid credentials");
  }

  const token = signToken(user);
  return { user: sanitizeUser(user), token };
};

module.exports = {
  register,
  login,
};
