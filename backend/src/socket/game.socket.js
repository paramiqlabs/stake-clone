const redis = require("../lib/redis");

const PLAYER_UPDATE_EVENT = "player_count_update";
const SOCKET_ERROR_EVENT = "socket_error";

const roomName = (gameId) => `game:${gameId}`;
const playerCountKey = (gameId) => `game:${gameId}:players`;

// In-memory dedupe guard: track concurrent socket joins by user per game.
const userPresenceByGame = new Map();

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

const isSocketAuthenticated = (socket) =>
  Boolean(socket?.user?.id && typeof socket.user.role === "string");

const ensureSocketAuthenticated = (socket) => {
  if (isSocketAuthenticated(socket)) {
    return true;
  }

  socket.emit(SOCKET_ERROR_EVENT, { message: "Unauthorized" });
  socket.disconnect(true);
  return false;
};

const getUserGamePresenceCount = (gameId, userId) => {
  const gamePresence = userPresenceByGame.get(gameId);
  if (!gamePresence) {
    return 0;
  }

  return gamePresence.get(userId) || 0;
};

const addUserGamePresence = (gameId, userId) => {
  let gamePresence = userPresenceByGame.get(gameId);
  if (!gamePresence) {
    gamePresence = new Map();
    userPresenceByGame.set(gameId, gamePresence);
  }

  const current = gamePresence.get(userId) || 0;
  const updated = current + 1;
  gamePresence.set(userId, updated);
  return updated;
};

const removeUserGamePresence = (gameId, userId) => {
  const gamePresence = userPresenceByGame.get(gameId);
  if (!gamePresence) {
    return 0;
  }

  const current = gamePresence.get(userId) || 0;
  if (current <= 1) {
    gamePresence.delete(userId);
    if (gamePresence.size === 0) {
      userPresenceByGame.delete(gameId);
    }
    return 0;
  }

  const updated = current - 1;
  gamePresence.set(userId, updated);
  return updated;
};

const setupGameSocket = (io) => {
  io.on("connection", (socket) => {
    if (!ensureSocketAuthenticated(socket)) {
      return;
    }

    console.log(`[socket] user connected: socket=${socket.id} userId=${socket.user.id}`);
    socket.data.joinedGames = new Set();

    socket.on("join_game", async (payload) => {
      if (!ensureSocketAuthenticated(socket)) {
        return;
      }

      const gameId = normalizeGameId(payload?.gameId);
      if (!gameId) {
        socket.emit(SOCKET_ERROR_EVENT, { message: "gameId is required" });
        return;
      }

      if (socket.data.joinedGames.has(gameId)) {
        await emitPlayerCountUpdate(io, gameId);
        return;
      }

      socket.join(roomName(gameId));
      socket.data.joinedGames.add(gameId);

      const presenceCount = addUserGamePresence(gameId, socket.user.id);

      // Duplicate same-user joins should not inflate live player count.
      const players =
        presenceCount === 1
          ? await incrementPlayerCount(gameId)
          : await getPlayerCount(gameId);

      await emitPlayerCountUpdate(io, gameId, players);
    });

    socket.on("leave_game", async (payload) => {
      if (!ensureSocketAuthenticated(socket)) {
        return;
      }

      const gameId = normalizeGameId(payload?.gameId);
      if (!gameId || !socket.data.joinedGames.has(gameId)) {
        return;
      }

      socket.leave(roomName(gameId));
      socket.data.joinedGames.delete(gameId);

      const presenceCount = removeUserGamePresence(gameId, socket.user.id);
      const players =
        presenceCount === 0
          ? await decrementPlayerCount(gameId)
          : await getPlayerCount(gameId);

      await emitPlayerCountUpdate(io, gameId, players);
    });

    socket.on("disconnect", async () => {
      const joinedGames = Array.from(socket.data.joinedGames || []);

      for (const gameId of joinedGames) {
        const presenceCount = removeUserGamePresence(gameId, socket.user.id);
        const players =
          presenceCount === 0
            ? await decrementPlayerCount(gameId)
            : await getPlayerCount(gameId);

        await emitPlayerCountUpdate(io, gameId, players);
      }
    });
  });
};

module.exports = {
  setupGameSocket,
};
