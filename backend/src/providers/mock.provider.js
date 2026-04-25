const crypto = require("crypto");

const generateSessionId = () => crypto.randomBytes(12).toString("hex");

const launchGame = async ({ userId, gameId }) => {
  if (!userId || !gameId) {
    throw new Error("Provider launch payload is invalid");
  }

  const sessionId = generateSessionId();

  return {
    launchUrl: `https://example.com/mock-game?session=${sessionId}`,
  };
};

module.exports = {
  launchGame,
};
