const dotenv = require("dotenv");
const bcrypt = require("bcrypt");
const { PrismaClient } = require("@prisma/client");

dotenv.config();

const prisma = new PrismaClient();

const ADMIN_EMAIL = "admin@test.com";
const ADMIN_PASSWORD = "123456";
const BCRYPT_SALT_ROUNDS = 10;

const seedAdminUser = async () => {
  const hashedPassword = await bcrypt.hash(ADMIN_PASSWORD, BCRYPT_SALT_ROUNDS);

  const user = await prisma.user.upsert({
    where: { email: ADMIN_EMAIL },
    update: {
      password: hashedPassword,
      role: "admin",
    },
    create: {
      email: ADMIN_EMAIL,
      password: hashedPassword,
      role: "admin",
    },
  });

  console.log(`[seed] admin user ready: ${user.email} (${user.role})`);
};

const main = async () => {
  await seedAdminUser();
};

main()
  .catch((error) => {
    console.error("[seed] failed:", error.message);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
