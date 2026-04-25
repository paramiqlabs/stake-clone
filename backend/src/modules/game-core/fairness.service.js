const crypto = require("crypto");

const DEFAULT_CLIENT_SEED = "stake-clone-client";
const FALLBACK_SERVER_SEED = crypto.randomBytes(32).toString("hex");
const SERVER_SEED = String(process.env.FAIRNESS_SERVER_SEED || FALLBACK_SERVER_SEED);
const SERVER_SEED_HASH = crypto.createHash("sha256").update(SERVER_SEED).digest("hex");

const normalizeClientSeed = (clientSeed) => {
  const value = String(clientSeed || "").trim();
  return value || DEFAULT_CLIENT_SEED;
};

const hashAtCursor = ({ clientSeed, nonce, cursor }) =>
  crypto
    .createHmac("sha256", SERVER_SEED)
    .update(`${clientSeed}:${nonce}:${cursor}`)
    .digest("hex");

const toUnitFloat = (hex) => {
  const slice = hex.slice(0, 13);
  const intValue = parseInt(slice, 16);
  const max = 0x1fffffffffffff;
  return intValue / max;
};

const randomAt = ({ clientSeed, nonce, cursor }) =>
  toUnitFloat(hashAtCursor({ clientSeed, nonce, cursor }));

const generateDiceRoll = ({ clientSeed, nonce }) => {
  const value = randomAt({ clientSeed, nonce, cursor: 0 });
  return Math.min(99, Math.floor(value * 100));
};

const generateMines = ({ clientSeed, nonce, mineCount, totalTiles }) => {
  const indexes = Array.from({ length: totalTiles }, (_, i) => i);

  for (let i = indexes.length - 1; i > 0; i -= 1) {
    const random = randomAt({ clientSeed, nonce, cursor: indexes.length - i });
    const j = Math.floor(random * (i + 1));
    [indexes[i], indexes[j]] = [indexes[j], indexes[i]];
  }

  return indexes.slice(0, mineCount).sort((a, b) => a - b);
};

const generatePlinkoPath = ({ clientSeed, nonce, rows }) => {
  const path = [];
  let rightMoves = 0;

  for (let i = 0; i < rows; i += 1) {
    const random = randomAt({ clientSeed, nonce, cursor: i });
    const move = random >= 0.5 ? "R" : "L";
    path.push(move);
    if (move === "R") {
      rightMoves += 1;
    }
  }

  return {
    path,
    slot: rightMoves,
  };
};

const buildFairnessContext = ({ clientSeed, nonce }) => {
  const normalizedClientSeed = normalizeClientSeed(clientSeed);
  return {
    clientSeed: normalizedClientSeed,
    nonce,
    serverSeedHash: SERVER_SEED_HASH,
  };
};

module.exports = {
  buildFairnessContext,
  generateDiceRoll,
  generateMines,
  generatePlinkoPath,
};
