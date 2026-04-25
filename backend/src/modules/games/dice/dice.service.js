const { Prisma } = require("@prisma/client");
const coreGameService = require("../../game-core/game.service");
const fairnessService = require("../../game-core/fairness.service");

const HOUSE_EDGE_FACTOR = new Prisma.Decimal("0.99");

const parseTarget = (value) => {
  const target = Number(value);
  if (!Number.isFinite(target) || target < 1 || target > 99) {
    throw new Error("Invalid target");
  }

  return target;
};

const playDice = async ({ userId, amount, target, clientSeed }) => {
  const parsedTarget = parseTarget(target);

  const coreResult = await coreGameService.placeBet({
    userId,
    gameType: "dice",
    amount,
    config: { target: parsedTarget, clientSeed },
    resolver: async ({ amount: parsedAmount, fairness }) => {
      const roll = fairnessService.generateDiceRoll({
        clientSeed: fairness.clientSeed,
        nonce: fairness.nonce,
      });
      const won = roll < parsedTarget;
      const multiplier = 100 / parsedTarget;
      const payout = won
        ? new Prisma.Decimal(parsedAmount)
            .mul(new Prisma.Decimal(multiplier.toFixed(6)))
            .mul(HOUSE_EDGE_FACTOR)
            .toDecimalPlaces(2)
        : new Prisma.Decimal("0");

      return {
        status: won ? "won" : "lost",
        payout,
        result: {
          gameType: "dice",
          roll,
          target: parsedTarget,
          won,
          multiplier: Number(multiplier.toFixed(6)),
        },
      };
    },
  });

  const roll = Number(coreResult?.bet?.result?.roll ?? 0);
  const win = String(coreResult?.bet?.status || "").toLowerCase() === "won";

  return {
    roll,
    win,
    payout: coreResult?.bet?.payout ? String(coreResult.bet.payout) : "0",
    newBalance: coreResult?.wallet?.balance ? String(coreResult.wallet.balance) : "0",
    betId: coreResult?.bet?.id || null,
  };
};

module.exports = {
  playDice,
};
