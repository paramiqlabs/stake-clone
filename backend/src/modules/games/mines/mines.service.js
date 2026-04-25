const coreGameService = require("../../game-core/game.service");
const fairnessService = require("../../game-core/fairness.service");

const DEFAULT_TOTAL_TILES = 25;
const DEFAULT_MINE_COUNT = 3;

const parseMineCount = (value) => {
  if (value === undefined || value === null || value === "") {
    return DEFAULT_MINE_COUNT;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed >= DEFAULT_TOTAL_TILES) {
    throw new Error("mineCount must be an integer between 1 and 24");
  }

  return parsed;
};

const startMines = async ({ userId, amount, mineCount, clientSeed }) => {
  const parsedMineCount = parseMineCount(mineCount);

  return coreGameService.placeBet({
    userId,
    gameType: "mines",
    amount,
    config: {
      mineCount: parsedMineCount,
      totalTiles: DEFAULT_TOTAL_TILES,
      clientSeed,
    },
    resolver: async ({ fairness }) => {
      const mines = fairnessService.generateMines({
        clientSeed: fairness.clientSeed,
        nonce: fairness.nonce,
        mineCount: parsedMineCount,
        totalTiles: DEFAULT_TOTAL_TILES,
      });

      return {
        status: "active",
        payout: "0",
        result: {
          gameType: "mines",
          mineCount: parsedMineCount,
          totalTiles: DEFAULT_TOTAL_TILES,
          mines,
          revealedTiles: [],
          currentMultiplier: 1,
          completed: false,
        },
      };
    },
  });
};

const revealMines = async ({ userId, betId, tileIndex }) =>
  coreGameService.revealMinesTile({
    userId,
    betId,
    tileIndex,
  });

module.exports = {
  startMines,
  revealMines,
};
