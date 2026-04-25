const { Prisma } = require("@prisma/client");
const prisma = require("../../lib/prisma");
const { buildFairnessContext } = require("./fairness.service");

const BET_STATUS_PENDING = "pending";
const BET_STATUS_WON = "won";
const BET_STATUS_LOST = "lost";
const BET_STATUS_ACTIVE = "active";

const CORE_GAME_TYPES = new Set(["dice", "mines", "plinko"]);

const parseUnsignedBigInt = (value, fieldName) => {
  const asString = String(value || "");
  if (!/^\d+$/.test(asString)) {
    throw new Error(`Invalid ${fieldName}`);
  }

  return BigInt(asString);
};

const parseAmount = (amount) => {
  if (amount === undefined || amount === null || amount === "") {
    throw new Error("amount is required");
  }

  let parsed;
  try {
    parsed = new Prisma.Decimal(amount);
  } catch (error) {
    throw new Error("Invalid amount");
  }

  if (parsed.lte(0)) {
    throw new Error("amount must be greater than 0");
  }

  return parsed;
};

const parseResult = (resultValue) => {
  if (!resultValue) {
    return null;
  }

  try {
    return JSON.parse(resultValue);
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

const toWalletResponse = (wallet) =>
  wallet
    ? {
        id: wallet.id.toString(),
        userId: wallet.userId.toString(),
        balance: wallet.balance.toString(),
        createdAt: wallet.createdAt,
        updatedAt: wallet.updatedAt,
      }
    : null;

const ensureCoreGame = async (tx, gameType) => {
  const slug = `original-${gameType}`;

  const existing = await tx.game.findUnique({
    where: { slug },
  });
  if (existing) {
    return existing;
  }

  return tx.game.create({
    data: {
      name: `Original ${gameType.charAt(0).toUpperCase()}${gameType.slice(1)}`,
      slug,
      provider: "internal",
      thumbnail: `${gameType}.png`,
      gameUrl: `/games/${gameType}`,
      isActive: true,
      config: JSON.stringify({ type: gameType }),
      launchType: "internal",
      category: "original",
      isFeatured: true,
      isMaintenance: false,
      sortOrder: 0,
    },
  });
};

const createDebitTransaction = (tx, { userId, amount, reference }) =>
  tx.transaction.create({
    data: {
      userId,
      amount,
      type: "debit",
      status: "success",
      reference,
    },
  });

const createCreditTransaction = (tx, { userId, amount, reference }) =>
  tx.transaction.create({
    data: {
      userId,
      amount,
      type: "credit",
      status: "success",
      reference,
    },
  });

const placeBet = async ({ userId, gameType, amount, config = {}, resolver }) => {
  const normalizedGameType = String(gameType || "").trim().toLowerCase();
  if (!CORE_GAME_TYPES.has(normalizedGameType)) {
    throw new Error("Unsupported game type");
  }

  if (typeof resolver !== "function") {
    throw new Error("Invalid game resolver");
  }

  const numericUserId = parseUnsignedBigInt(userId, "user id");
  const parsedAmount = parseAmount(amount);
  const clientSeed = String(config?.clientSeed || "");

  const result = await prisma.$transaction(async (tx) => {
    const game = await ensureCoreGame(tx, normalizedGameType);

    const wallet = await tx.wallet.upsert({
      where: { userId: numericUserId },
      update: {},
      create: {
        userId: numericUserId,
        balance: new Prisma.Decimal("0"),
      },
    });

    const lockResult = await tx.wallet.updateMany({
      where: {
        id: wallet.id,
        balance: { gte: parsedAmount },
      },
      data: {
        balance: { decrement: parsedAmount },
      },
    });

    if (lockResult.count === 0) {
      throw new Error("Insufficient balance");
    }

    const nonceBase = await tx.bet.count({
      where: {
        userId: numericUserId,
        gameType: normalizedGameType,
      },
    });
    const nonce = nonceBase + 1;
    const fairness = buildFairnessContext({ clientSeed, nonce });

    const initialBet = await tx.bet.create({
      data: {
        userId: numericUserId,
        gameId: game.id,
        gameType: normalizedGameType,
        amount: parsedAmount,
        status: BET_STATUS_PENDING,
        result: JSON.stringify({
          phase: "locked",
          fairness,
          config,
        }),
      },
    });

    await createDebitTransaction(tx, {
      userId: numericUserId,
      amount: parsedAmount,
      reference: `game:${normalizedGameType}:bet:${initialBet.id.toString()}`,
    });

    const resolution = await resolver({
      bet: initialBet,
      amount: parsedAmount,
      config,
      fairness,
    });

    const normalizedStatus = String(resolution?.status || BET_STATUS_LOST).toLowerCase();
    const status = [BET_STATUS_WON, BET_STATUS_LOST, BET_STATUS_ACTIVE].includes(normalizedStatus)
      ? normalizedStatus
      : BET_STATUS_LOST;
    const payout = resolution?.payout ? new Prisma.Decimal(resolution.payout) : new Prisma.Decimal("0");
    const resultPayload = resolution?.result ?? {};

    const updatedBet = await tx.bet.update({
      where: { id: initialBet.id },
      data: {
        status,
        payout: status === BET_STATUS_WON ? payout : null,
        result: JSON.stringify({
          ...resultPayload,
          fairness,
          config,
        }),
      },
    });

    let updatedWallet = await tx.wallet.findUnique({ where: { id: wallet.id } });

    if (status === BET_STATUS_WON && payout.gt(0)) {
      updatedWallet = await tx.wallet.update({
        where: { id: wallet.id },
        data: {
          balance: { increment: payout },
        },
      });

      await createCreditTransaction(tx, {
        userId: numericUserId,
        amount: payout,
        reference: `game:${normalizedGameType}:payout:${initialBet.id.toString()}`,
      });
    }

    return { bet: updatedBet, wallet: updatedWallet, game };
  });

  return {
    bet: toBetResponse(result.bet),
    wallet: toWalletResponse(result.wallet),
    game: {
      id: result.game.id.toString(),
      slug: result.game.slug,
      name: result.game.name,
    },
  };
};

const revealMinesTile = async ({ userId, betId, tileIndex }) => {
  const numericUserId = parseUnsignedBigInt(userId, "user id");
  const numericBetId = parseUnsignedBigInt(betId, "bet id");
  const parsedTileIndex = Number(tileIndex);

  if (!Number.isInteger(parsedTileIndex) || parsedTileIndex < 0 || parsedTileIndex > 24) {
    throw new Error("Invalid tileIndex");
  }

  const result = await prisma.$transaction(async (tx) => {
    const bet = await tx.bet.findUnique({ where: { id: numericBetId } });
    if (!bet || bet.userId !== numericUserId) {
      throw new Error("Bet not found");
    }

    if (bet.gameType !== "mines") {
      throw new Error("Bet is not a mines game");
    }

    if (bet.status !== BET_STATUS_ACTIVE) {
      throw new Error("Bet is already settled");
    }

    const state = parseResult(bet.result);
    if (!state || !Array.isArray(state.mines) || !Array.isArray(state.revealedTiles)) {
      throw new Error("Invalid mines state");
    }

    if (state.revealedTiles.includes(parsedTileIndex)) {
      throw new Error("Tile already revealed");
    }

    const nextRevealed = [...state.revealedTiles, parsedTileIndex];
    const mineHit = state.mines.includes(parsedTileIndex);
    const totalTiles = Number(state.totalTiles || 25);
    const mineCount = Number(state.mineCount || 3);

    const safeReveals = nextRevealed.filter((index) => !state.mines.includes(index)).length;
    const stepMultiplier = 1 + mineCount / (totalTiles - mineCount);
    const currentMultiplier = Number((stepMultiplier ** safeReveals).toFixed(4));
    const amount = new Prisma.Decimal(bet.amount);
    const payout = new Prisma.Decimal(Number((Number(amount.toString()) * currentMultiplier).toFixed(2)));
    const allSafeRevealed = safeReveals >= totalTiles - mineCount;

    let finalStatus = BET_STATUS_ACTIVE;
    let payoutToStore = null;
    if (mineHit) {
      finalStatus = BET_STATUS_LOST;
    } else if (allSafeRevealed) {
      finalStatus = BET_STATUS_WON;
      payoutToStore = payout;
    }

    const updatedBet = await tx.bet.update({
      where: { id: bet.id },
      data: {
        status: finalStatus,
        payout: payoutToStore,
        result: JSON.stringify({
          ...state,
          revealedTiles: nextRevealed,
          currentMultiplier,
          mineHit,
          completed: finalStatus !== BET_STATUS_ACTIVE,
        }),
      },
    });

    let updatedWallet = await tx.wallet.findUnique({ where: { userId: numericUserId } });
    if (finalStatus === BET_STATUS_WON && payoutToStore) {
      updatedWallet = await tx.wallet.update({
        where: { userId: numericUserId },
        data: {
          balance: { increment: payoutToStore },
        },
      });

      await createCreditTransaction(tx, {
        userId: numericUserId,
        amount: payoutToStore,
        reference: `game:mines:payout:${bet.id.toString()}`,
      });
    }

    return {
      bet: updatedBet,
      wallet: updatedWallet,
    };
  });

  return {
    bet: toBetResponse(result.bet),
    wallet: toWalletResponse(result.wallet),
  };
};

module.exports = {
  placeBet,
  revealMinesTile,
  parseAmount,
};
