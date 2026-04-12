const dotenv = require("dotenv");
const { PrismaClient } = require("@prisma/client");

dotenv.config();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL is missing. Set it in backend/.env (see backend/.env.example)."
  );
}

const prisma = new PrismaClient({});

module.exports = prisma;
