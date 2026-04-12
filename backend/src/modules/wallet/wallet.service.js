const { Prisma } = require("@prisma/client");
const prisma = require("../../lib/prisma");

const parseUserId = (userId) => {
  const asString = String(userId || "");
  if (!/^\d+$/.test(asString)) {
    throw new Error("Invalid user id");
  }

  return BigInt(asString);
};

const parseAmount = (amount) => {
  if (amount === undefined || amount === null || amount === "") {
    throw new Error("Amount is required");
  }

  try {
    const decimalAmount = new Prisma.Decimal(amount);
    if (decimalAmount.lte(0)) {
      throw new Error("Amount must be greater than 0");
    }

    return decimalAmount;
  } catch (error) {
    if (error.message === "Amount must be greater than 0") {
      throw error;
    }

    throw new Error("Invalid amount");
  }
};

const toWalletResponse = (wallet) => ({
  id: wallet.id.toString(),
  userId: wallet.userId.toString(),
  balance: wallet.balance.toString(),
  createdAt: wallet.createdAt,
  updatedAt: wallet.updatedAt,
});

const toTransactionResponse = (transaction) => ({
  id: transaction.id.toString(),
  userId: transaction.userId.toString(),
  amount: transaction.amount.toString(),
  type: transaction.type,
  status: transaction.status,
  reference: transaction.reference,
  createdAt: transaction.createdAt,
});

const getWallet = async (authUserId) => {
  const userId = parseUserId(authUserId);

  const wallet = await prisma.wallet.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      balance: new Prisma.Decimal("0"),
    },
  });

  return toWalletResponse(wallet);
};

const deposit = async (authUserId, payload) => {
  const userId = parseUserId(authUserId);
  const amount = parseAmount(payload?.amount);
  const reference = payload?.reference ? String(payload.reference) : null;

  const result = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.upsert({
      where: { userId },
      update: {},
      create: {
        userId,
        balance: new Prisma.Decimal("0"),
      },
    });

    const updatedWallet = await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { increment: amount } },
    });

    const transaction = await tx.transaction.create({
      data: {
        userId,
        amount,
        type: "credit",
        status: "success",
        reference,
      },
    });

    return { updatedWallet, transaction };
  });

  return {
    wallet: toWalletResponse(result.updatedWallet),
    transaction: toTransactionResponse(result.transaction),
  };
};

const withdraw = async (authUserId, payload) => {
  const userId = parseUserId(authUserId);
  const amount = parseAmount(payload?.amount);
  const reference = payload?.reference ? String(payload.reference) : null;

  const result = await prisma.$transaction(async (tx) => {
    const wallet = await tx.wallet.findUnique({ where: { userId } });

    if (!wallet || wallet.balance.lt(amount)) {
      throw new Error("Insufficient balance");
    }

    const updatedWallet = await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: { decrement: amount } },
    });

    const transaction = await tx.transaction.create({
      data: {
        userId,
        amount,
        type: "debit",
        status: "success",
        reference,
      },
    });

    return { updatedWallet, transaction };
  });

  return {
    wallet: toWalletResponse(result.updatedWallet),
    transaction: toTransactionResponse(result.transaction),
  };
};

module.exports = {
  getWallet,
  deposit,
  withdraw,
};
