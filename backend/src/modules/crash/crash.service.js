const { Prisma } = require("@prisma/client");
const prisma = require("../../lib/prisma");

const BET_STATUS_PENDING = "pending";
const BET_STATUS_WON = "won";
const BET_STATUS_LOST = "lost";
const SOCKET_ERROR_EVENT = "socket_error";

const CRASH_GAME_SLUG = "crash";

let cachedCrashGameId = null;
const roundActiveBets = new Map();

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

const parseRoundId = (roundId) => {
  const normalized = String(roundId || "").trim();
  if (!normalized) {
    throw new Error("Round is not ready");
  }

  return normalized;
};

const toTwoDecimal = (value) => new Prisma.Decimal(value).toDecimalPlaces(2);

const toBetResponse = (bet) => ({
  id: bet.id.toString(),
  userId: bet.userId.toString(),
  gameId: bet.gameId.toString(),
  crashRoundId: bet.crashRoundId,
  amount: bet.amount.toString(),
  payout: bet.payout ? bet.payout.toString() : null,
  cashoutMultiplier: bet.cashoutMultiplier ? bet.cashoutMultiplier.toString() : null,
  status: bet.status,
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

const getRoundBetIndex = (roundId) => {
  if (!roundActiveBets.has(roundId)) {
    roundActiveBets.set(roundId, new Map());
  }

  return roundActiveBets.get(roundId);
};

const removeRoundBetIndex = (roundId) => {
  roundActiveBets.delete(roundId);
};

const ensureCrashGameId = async (tx) => {
  if (cachedCrashGameId) {
    return cachedCrashGameId;
  }

  const game = await tx.game.upsert({
    where: { slug: CRASH_GAME_SLUG },
    update: {
      isActive: true,
      provider: "stake-clone",
      name: "Crash",
      thumbnail: "crash.png",
      gameUrl: "/games/crash",
      config: JSON.stringify({ type: "crash" }),
    },
    create: {
      name: "Crash",
      slug: CRASH_GAME_SLUG,
      provider: "stake-clone",
      thumbnail: "crash.png",
      gameUrl: "/games/crash",
      category: "casino",
      isActive: true,
      config: JSON.stringify({ type: "crash" }),
      launchType: "internal",
    },
  });

  cachedCrashGameId = game.id;
  return game.id;
};

const placeCrashBet = async ({ authUserId, amount, roundState }) => {
  if (roundState?.status !== "waiting") {
    throw new Error("Betting is closed");
  }

  const roundId = parseRoundId(roundState?.roundId);
  const userId = parseUnsignedBigInt(authUserId, "user id");
  const wagerAmount = parsePositiveAmount(amount, "amount");
  const userIdKey = userId.toString();
  const roundBetIndex = getRoundBetIndex(roundId);

  if (roundBetIndex.has(userIdKey)) {
    throw new Error("Bet already placed for current round");
  }

  roundBetIndex.set(userIdKey, "LOCKED");

  try {
    const result = await prisma.$transaction(async (tx) => {
      const crashGameId = await ensureCrashGameId(tx);

      const existingBet = await tx.bet.findFirst({
        where: {
          userId,
          gameId: crashGameId,
          crashRoundId: roundId,
          status: BET_STATUS_PENDING,
        },
      });

      if (existingBet) {
        throw new Error("Bet already placed for current round");
      }

      const wallet = await tx.wallet.findUnique({ where: { userId } });
      if (!wallet || wallet.balance.lt(wagerAmount)) {
        throw new Error("Insufficient balance");
      }

      const bet = await tx.bet.create({
        data: {
          userId,
          gameId: crashGameId,
          crashRoundId: roundId,
          amount: wagerAmount,
          status: BET_STATUS_PENDING,
          cashoutMultiplier: null,
        },
      });

      const updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { decrement: wagerAmount },
        },
      });

      const transaction = await tx.transaction.create({
        data: {
          userId,
          amount: wagerAmount,
          type: "debit",
          status: "success",
          reference: `crash:bet:${bet.id.toString()}`,
        },
      });

      return { bet, wallet: updatedWallet, transaction };
    });

    roundBetIndex.set(userIdKey, result.bet.id.toString());

    return {
      roundId,
      bet: toBetResponse(result.bet),
      wallet: toWalletResponse(result.wallet),
      transaction: toTransactionResponse(result.transaction),
    };
  } catch (error) {
    roundBetIndex.delete(userIdKey);
    throw error;
  }
};

const cashoutCrashBet = async ({ authUserId, roundState, betId }) => {
  if (!betId) {
    throw new Error("no betId");
  }

  if (roundState?.status !== "running") {
    throw new Error("round ended");
  }

  const roundId = parseRoundId(roundState?.roundId);
  const userId = parseUnsignedBigInt(authUserId, "user id");
  const normalizedBetId = parseUnsignedBigInt(betId, "bet id");
  const currentMultiplier = toTwoDecimal(roundState?.multiplier ?? "0");

  if (currentMultiplier.lte(1)) {
    throw new Error("Cashout is not available yet");
  }

  const result = await prisma.$transaction(async (tx) => {
    const crashGameId = await ensureCrashGameId(tx);

    const bet = await tx.bet.findUnique({
      where: {
        id: normalizedBetId,
      },
    });

    if (!bet) {
      throw new Error("bet not found");
    }

    if (bet.userId.toString() !== userId.toString()) {
      throw new Error("bet not found");
    }

    if (bet.gameId.toString() !== crashGameId.toString()) {
      throw new Error("bet not found");
    }

    if (String(bet.status || "").toLowerCase() !== BET_STATUS_PENDING) {
      throw new Error("already cashed out");
    }

    if (!bet.crashRoundId || String(bet.crashRoundId) !== String(roundId)) {
      throw new Error("round ended");
    }

    const payout = toTwoDecimal(bet.amount.mul(currentMultiplier));

    const updated = await tx.bet.updateMany({
      where: {
        id: bet.id,
        userId,
        crashRoundId: roundId,
        status: BET_STATUS_PENDING,
      },
      data: {
        status: BET_STATUS_WON,
        payout,
        cashoutMultiplier: currentMultiplier,
      },
    });

    if (updated.count !== 1) {
      throw new Error("already cashed out");
    }

    const wallet = await tx.wallet.findUnique({ where: { userId } });
    if (!wallet) {
      throw new Error("Wallet not found");
    }

    const updatedWallet = await tx.wallet.update({
      where: { id: wallet.id },
      data: {
        balance: { increment: payout },
      },
    });

    const transaction = await tx.transaction.create({
      data: {
        userId,
        amount: payout,
        type: "credit",
        status: "success",
        reference: `crash:cashout:${bet.id.toString()}`,
      },
    });

    const updatedBet = await tx.bet.findUnique({ where: { id: bet.id } });
    return {
      bet: updatedBet,
      wallet: updatedWallet,
      transaction,
      payout,
      multiplier: currentMultiplier,
    };
  });

  const roundBetIndex = getRoundBetIndex(roundId);
  roundBetIndex.delete(userId.toString());

  return {
    roundId,
    bet: toBetResponse(result.bet),
    wallet: toWalletResponse(result.wallet),
    transaction: toTransactionResponse(result.transaction),
    payout: result.payout.toString(),
    cashoutMultiplier: result.multiplier.toString(),
  };
};

const settleCrashRound = async ({ roundId, finalMultiplier }) => {
  const normalizedRoundId = parseRoundId(roundId);
  const crashMultiplier = toTwoDecimal(finalMultiplier ?? "1");

  const summary = await prisma.$transaction(async (tx) => {
    const crashGameId = await ensureCrashGameId(tx);

    const wonCount = await tx.bet.count({
      where: {
        gameId: crashGameId,
        crashRoundId: normalizedRoundId,
        status: BET_STATUS_WON,
      },
    });

    const lostUpdate = await tx.bet.updateMany({
      where: {
        gameId: crashGameId,
        crashRoundId: normalizedRoundId,
        status: BET_STATUS_PENDING,
      },
      data: {
        status: BET_STATUS_LOST,
        payout: null,
        cashoutMultiplier: null,
      },
    });

    return {
      roundId: normalizedRoundId,
      finalMultiplier: crashMultiplier.toString(),
      wonCount,
      lostCount: lostUpdate.count,
    };
  });

  removeRoundBetIndex(normalizedRoundId);
  return summary;
};

const mapCrashError = (error) => {
  const message = error?.message || "Internal server error";
  const isClientError =
    message.includes("Invalid user id") ||
    message.includes("amount is required") ||
    message.includes("Invalid amount") ||
    message.includes("amount must be greater than 0") ||
    message.includes("Betting is closed") ||
    message.includes("Round is not running") ||
    message.includes("round ended") ||
    message.includes("Cashout is not available yet") ||
    message.includes("No pending crash bet found") ||
    message.includes("no betId") ||
    message.includes("bet not found") ||
    message.includes("already cashed out") ||
    message.includes("Bet is already resolved") ||
    message.includes("Bet already placed for current round") ||
    message.includes("Insufficient balance") ||
    message.includes("Wallet not found") ||
    message.includes("Round is not ready");

  return {
    event: SOCKET_ERROR_EVENT,
    status: isClientError ? 400 : 500,
    message,
  };
};

module.exports = {
  placeCrashBet,
  cashoutCrashBet,
  settleCrashRound,
  mapCrashError,
};
