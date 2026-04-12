const redis = require("../lib/redis");

const PLAYER_UPDATE_EVENT = "player_count_update";
const SOCKET_ERROR_EVENT = "socket_error";

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
    return await redis.scard(playerCountKey(gameId));
  } catch (error) {
    return 0;
  }
};

const addPlayerToGame = async (gameId, userId) => {
  try {
    await redis.sadd(playerCountKey(gameId), userId);
    return await getPlayerCount(gameId);
  } catch (error) {
    return null;
  }
};

const removePlayerFromGame = async (gameId, userId) => {
  try {
    await redis.srem(playerCountKey(gameId), userId);
    return await getPlayerCount(gameId);
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

const setupGameSocket = (io) => {
  io.on("connection", (socket) => {
    if (!ensureSocketAuthenticated(socket)) {
      return;
    }

    console.log(`[socket] user connected: socket=${socket.id} userId=${socket.user.id}`);
    socket.data.gameId = null;

    socket.on("join_game", async (payload) => {
      if (!ensureSocketAuthenticated(socket)) {
        return;
      }

      const gameId = normalizeGameId(payload?.gameId);
      if (!gameId) {
        socket.emit(SOCKET_ERROR_EVENT, { message: "gameId is required" });
        return;
      }

      if (socket.data.gameId === gameId) {
        await emitPlayerCountUpdate(io, gameId);
        return;
      }

      // Leave current game before joining a new one.
      if (socket.data.gameId) {
        const previousGameId = socket.data.gameId;
        socket.leave(roomName(previousGameId));
        const previousPlayers = await removePlayerFromGame(previousGameId, socket.user.id);
        await emitPlayerCountUpdate(io, previousGameId, previousPlayers);
      }

      socket.join(roomName(gameId));
      socket.data.gameId = gameId;

      const players = await addPlayerToGame(gameId, socket.user.id);
      await emitPlayerCountUpdate(io, gameId, players);
    });

    socket.on("leave_game", async (payload) => {
      if (!ensureSocketAuthenticated(socket)) {
        return;
      }

      const requestedGameId = normalizeGameId(payload?.gameId);
      const gameId = requestedGameId || socket.data.gameId;
      if (!gameId || socket.data.gameId !== gameId) {
        return;
      }

      socket.leave(roomName(gameId));
      socket.data.gameId = null;

      const players = await removePlayerFromGame(gameId, socket.user.id);
      await emitPlayerCountUpdate(io, gameId, players);
    });

    socket.on("disconnect", async () => {
      const gameId = socket.data.gameId;
      if (!gameId) {
        return;
      }

      const players = await removePlayerFromGame(gameId, socket.user.id);
      await emitPlayerCountUpdate(io, gameId, players);
      socket.data.gameId = null;
    });
  });
};

module.exports = {
  setupGameSocket,
};
