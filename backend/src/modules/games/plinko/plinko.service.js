const { Prisma } = require("@prisma/client");
const coreGameService = require("../../game-core/game.service");
const fairnessService = require("../../game-core/fairness.service");

const DEFAULT_ROWS = 8;
const PLINKO_MULTIPLIERS = [0.2, 0.5, 0.8, 1, 1.2, 1.5, 2, 3, 5];

const parseRows = (value) => {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_ROWS;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed !== DEFAULT_ROWS) {
    throw new Error(`rows must be ${DEFAULT_ROWS}`);
  }

  return parsed;
};

const playPlinko = async ({ userId, amount, rows, clientSeed }) => {
  const parsedRows = parseRows(rows);

  return coreGameService.placeBet({
    userId,
    gameType: "plinko",
    amount,
    config: { rows: parsedRows, clientSeed },
    resolver: async ({ amount: parsedAmount, fairness }) => {
      const pathData = fairnessService.generatePlinkoPath({
        clientSeed: fairness.clientSeed,
        nonce: fairness.nonce,
        rows: parsedRows,
      });
      const multiplier = PLINKO_MULTIPLIERS[pathData.slot] ?? 0;
      const won = multiplier > 1;
      const payout =
        multiplier > 0
          ? new Prisma.Decimal(parsedAmount)
              .mul(new Prisma.Decimal(multiplier.toFixed(4)))
              .toDecimalPlaces(2)
          : new Prisma.Decimal("0");

      return {
        status: won ? "won" : "lost",
        payout: won ? payout : "0",
        result: {
          gameType: "plinko",
          rows: parsedRows,
          path: pathData.path,
          slot: pathData.slot,
          multiplier,
          won,
        },
      };
    },
  });
};

module.exports = {
  playPlinko,
};
