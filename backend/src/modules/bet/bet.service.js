const { Prisma } = require("@prisma/client");
const prisma = require("../../lib/prisma");

const BET_STATUS_PENDING = "pending";
const BET_STATUS_WON = "won";
const BET_STATUS_LOST = "lost";

const parseUnsignedBigInt = (value, fieldName) => {
  const asString = String(value || "");
  if (!/^\d+$/.test(asString)) {
    throw new Error(`Invalid ${fieldName}`);
  }

  return BigInt(asString);
};

const parsePositiveAmount = (value, fieldName) => {
  if (value === undefined || value === null || value === "") {
    throw new Error(`${fieldName} is required`);
  }

  let decimalValue;
  try {
    decimalValue = new Prisma.Decimal(value);
  } catch (error) {
    throw new Error(`Invalid ${fieldName}`);
  }

  if (decimalValue.lte(0)) {
    throw new Error(`${fieldName} must be greater than 0`);
  }

  return decimalValue;
};

const parseResult = (value) => {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
};

const toBetResponse = (bet) => ({
  id: bet.id.toString(),
  userId: bet.userId.toString(),
  gameId: bet.gameId.toString(),
  gameType: bet.gameType || null,
  amount: bet.amount.toString(),
  payout: bet.payout ? bet.payout.toString() : null,
  status: bet.status,
  result: parseResult(bet.result),
  createdAt: bet.createdAt,
  updatedAt: bet.updatedAt,
});

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

const placeBet = async (authUserId, payload) => {
  const userId = parseUnsignedBigInt(authUserId, "user id");
  const gameId = parseUnsignedBigInt(payload?.gameId, "gameId");
  const amount = parsePositiveAmount(payload?.amount, "amount");

  const result = await prisma.$transaction(async (tx) => {
    const game = await tx.game.findUnique({ where: { id: gameId } });
    if (!game || !game.isActive) {
      throw new Error("Game is not available");
    }

    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet || wallet.balance.lt(amount)) {
      throw new Error("Insufficient balance");
    }

    const bet = await tx.bet.create({
      data: {
        userId,
        gameId,
        amount,
        status: BET_STATUS_PENDING,
      },
    });

    const updatedWallet = await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: { decrement: amount },
      },
    });

    const transaction = await tx.transaction.create({
      data: {
        userId,
        amount,
        type: "debit",
        status: "success",
        reference: `bet:${bet.id.toString()}`,
      },
    });

    return { bet, wallet: updatedWallet, transaction };
  });

  return {
    bet: toBetResponse(result.bet),
    wallet: toWalletResponse(result.wallet),
    transaction: toTransactionResponse(result.transaction),
  };
};

const resolveBet = async (betIdParam, payload) => {
  const betId = parseUnsignedBigInt(betIdParam, "bet id");
  const result = String(payload?.result || "").trim().toLowerCase();

  if (result !== BET_STATUS_WON && result !== BET_STATUS_LOST) {
    throw new Error("result must be 'win' or 'loss'");
  }

  const payout = result === BET_STATUS_WON ? parsePositiveAmount(payload?.payout, "payout") : new Prisma.Decimal(0);

  const resolved = await prisma.$transaction(async (tx) => {
    const bet = await tx.bet.findUnique({ where: { id: betId } });
    if (!bet) {
      throw new Error("Bet not found");
    }

    if (bet.status !== BET_STATUS_PENDING) {
      throw new Error("Bet is already resolved");
    }

    if (result === BET_STATUS_LOST) {
      const lostBet = await tx.bet.update({
        where: { id: betId },
        data: {
          status: BET_STATUS_LOST,
          payout: null,
        },
      });

      return { bet: lostBet, wallet: null, transaction: null };
    }

    const wallet = await tx.wallet.findUnique({ where: { userId: bet.userId } });
    if (!wallet) {
      throw new Error("Wallet not found");
    }

    const wonBet = await tx.bet.update({
      where: { id: betId },
      data: {
        status: BET_STATUS_WON,
        payout,
      },
    });

    const updatedWallet = await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: { increment: payout },
      },
    });

    const transaction = await tx.transaction.create({
      data: {
        userId: bet.userId,
        amount: payout,
        type: "credit",
        status: "success",
        reference: `bet:${bet.id.toString()}`,
      },
    });

    return { bet: wonBet, wallet: updatedWallet, transaction };
  });

  return {
    bet: toBetResponse(resolved.bet),
    wallet: resolved.wallet ? toWalletResponse(resolved.wallet) : null,
    transaction: resolved.transaction ? toTransactionResponse(resolved.transaction) : null,
  };
};

const toHistoryBetResponse = (bet) => ({
  id: bet.id.toString(),
  gameType: bet.gameType || null,
  amount: bet.amount.toString(),
  payout: bet.payout ? bet.payout.toString() : null,
  status: bet.status,
  result: parseResult(bet.result),
  createdAt: bet.createdAt,
});

const getMyBets = async (authUserId, options = {}) => {
  const userId = parseUnsignedBigInt(authUserId, "user id");
  const take = Math.max(1, Math.min(Number(options.limit) || 20, 20));

  const bets = await prisma.bet.findMany({
    where: {
      userId,
    },
    orderBy: {
      createdAt: "desc",
    },
    take,
  });

  return bets.map(toHistoryBetResponse);
};

module.exports = {
  placeBet,
  resolveBet,
  getMyBets,
};
