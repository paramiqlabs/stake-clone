const redis = require("../lib/redis");

const PLAYER_UPDATE_EVENT = "player_count_update";

const roomName = (gameId) => `game:${gameId}`;
const playerCountKey = (gameId) => `game:${gameId}:players`;

const normalizeGameId = (value) => {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = String(value).trim();
  return normalized ? normalized : null;
};

const getPlayerCount = async (gameId) => {
  try {
    const current = await redis.get(playerCountKey(gameId));
    return Number(current || 0);
  } catch (error) {
    return 0;
  }
};

const incrementPlayerCount = async (gameId) => {
  try {
    return await redis.incr(playerCountKey(gameId));
  } catch (error) {
    return null;
  }
};

const decrementPlayerCount = async (gameId) => {
  try {
    const key = playerCountKey(gameId);
    const updated = await redis.decr(key);
    if (updated < 0) {
      await redis.set(key, 0);
      return 0;
    }

    return updated;
  } catch (error) {
    return null;
  }
};

const emitPlayerCountUpdate = async (io, gameId, countFromOp = null) => {
  const players = typeof countFromOp === "number" ? countFromOp : await getPlayerCount(gameId);
  io.to(roomName(gameId)).emit(PLAYER_UPDATE_EVENT, { gameId, players });
};

const setupGameSocket = (io) => {
  io.on("connection", (socket) => {
    console.log(`[socket] user connected: ${socket.id}`);
    socket.data.joinedGames = new Set();

    socket.on("join_game", async (payload) => {
      const gameId = normalizeGameId(payload?.gameId);
      if (!gameId) {
        return;
      }

      if (socket.data.joinedGames.has(gameId)) {
        await emitPlayerCountUpdate(io, gameId);
        return;
      }

      socket.join(roomName(gameId));
      socket.data.joinedGames.add(gameId);

      const players = await incrementPlayerCount(gameId);
      await emitPlayerCountUpdate(io, gameId, players);
    });

    socket.on("leave_game", async (payload) => {
      const gameId = normalizeGameId(payload?.gameId);
      if (!gameId || !socket.data.joinedGames.has(gameId)) {
        return;
      }

      socket.leave(roomName(gameId));
      socket.data.joinedGames.delete(gameId);

      const players = await decrementPlayerCount(gameId);
      await emitPlayerCountUpdate(io, gameId, players);
    });

    socket.on("disconnect", async () => {
      const joinedGames = Array.from(socket.data.joinedGames || []);

      for (const gameId of joinedGames) {
        const players = await decrementPlayerCount(gameId);
        await emitPlayerCountUpdate(io, gameId, players);
      }
    });
  });
};

module.exports = {
  setupGameSocket,
};
