const prisma = require("../../lib/prisma");
const redis = require("../../lib/redis");
const { getProvider } = require("../../providers/provider.factory");
const { normalizeCreateGamePayload } = require("./game.model");

const LAUNCH_TYPES = new Set(["iframe", "redirect", "internal"]);
const ACTIVE_GAMES_CACHE_KEY = "games:active";
const ACTIVE_GAMES_TTL_SECONDS = 60;

const parseConfigFromDb = (value) => {
  if (typeof value !== "string" || value.trim() === "") {
    return {};
  }

  try {
    return JSON.parse(value);
  } catch (error) {
    return value;
  }
};

const parseGameId = (id) => {
  const asString = String(id);
  if (!/^\d+$/.test(asString)) {
    throw new Error("Invalid game id");
  }

  return BigInt(asString);
};

const parseUserId = (id) => {
  const asString = String(id || "");
  if (!/^\d+$/.test(asString)) {
    throw new Error("Invalid user id");
  }

  return BigInt(asString);
};

const normalizeLaunchType = (value) => {
  if (typeof value !== "string") {
    return "iframe";
  }

  const normalized = value.trim().toLowerCase();
  return LAUNCH_TYPES.has(normalized) ? normalized : "iframe";
};

const toApiGame = (game) => ({
  id: game.id.toString(),
  name: game.name,
  slug: game.slug,
  provider: game.provider,
  thumbnail: game.thumbnail,
  game_url: game.gameUrl,
  is_active: game.isActive ?? false,
  config: parseConfigFromDb(game.config),
});

const readActiveGamesCache = async () => {
  try {
    const cached = await redis.get(ACTIVE_GAMES_CACHE_KEY);
    if (!cached) {
      return null;
    }

    return JSON.parse(cached);
  } catch (error) {
    return null;
  }
};

const writeActiveGamesCache = async (games) => {
  try {
    await redis.set(
      ACTIVE_GAMES_CACHE_KEY,
      JSON.stringify(games),
      "EX",
      ACTIVE_GAMES_TTL_SECONDS
    );
  } catch (error) {
    // Graceful fallback: skip cache on Redis errors.
  }
};

const invalidateActiveGamesCache = async () => {
  try {
    await redis.del(ACTIVE_GAMES_CACHE_KEY);
  } catch (error) {
    // Graceful fallback: DB remains source of truth.
  }
};

const getActiveGames = async () => {
  const cachedGames = await readActiveGamesCache();
  if (cachedGames) {
    return cachedGames;
  }

  const games = await prisma.game.findMany({
    where: { isActive: true },
    orderBy: { id: "desc" },
  });

  const normalizedGames = games.map(toApiGame);
  await writeActiveGamesCache(normalizedGames);
  return normalizedGames;
};

const createGame = async (payload) => {
  const normalizedPayload = normalizeCreateGamePayload(payload);

  const created = await prisma.game.create({
    data: {
      name: normalizedPayload.name.trim(),
      slug: normalizedPayload.slug.trim(),
      provider: normalizedPayload.provider.trim(),
      thumbnail: normalizedPayload.thumbnail.trim(),
      gameUrl: normalizedPayload.game_url.trim(),
      isActive: normalizedPayload.is_active ?? true,
      config: JSON.stringify(normalizedPayload.config ?? {}),
      launchType: normalizeLaunchType(normalizedPayload.launch_type),
      category: typeof normalizedPayload.category === "string" ? normalizedPayload.category.trim() || "general" : "general",
      isFeatured: false,
      isMaintenance: false,
      sortOrder: 0,
    },
  });

  await invalidateActiveGamesCache();
  return toApiGame(created);
};

const toggleGame = async (id) => {
  const numericId = parseGameId(id);

  const existing = await prisma.game.findUnique({
    where: { id: numericId },
  });

  if (!existing) {
    return null;
  }

  const updated = await prisma.game.update({
    where: { id: numericId },
    data: { isActive: !existing.isActive },
  });

  await invalidateActiveGamesCache();
  return toApiGame(updated);
};

const readProviderSessionId = (launchUrl) => {
  try {
    const url = new URL(launchUrl);
    const sessionId = url.searchParams.get("session");
    if (!sessionId) {
      throw new Error("Provider session is missing");
    }

    return sessionId;
  } catch (error) {
    throw new Error("Invalid launch URL from provider");
  }
};

const launchGame = async ({ gameId, authUserId }) => {
  const userId = parseUserId(authUserId);
  const numericId = parseGameId(gameId);

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    throw new Error("User not found");
  }

  const game = await prisma.game.findUnique({
    where: { id: numericId },
  });

  if (!game) {
    throw new Error("Game not found");
  }

  if (!game.isActive) {
    throw new Error("Game is not available");
  }

  const provider = getProvider(game.provider);
  const launchResult = await provider.launchGame({
    userId: userId.toString(),
    gameId: numericId.toString(),
  });

  const launchUrl = typeof launchResult?.launchUrl === "string" ? launchResult.launchUrl.trim() : "";
  if (!launchUrl) {
    throw new Error("Provider launch failed");
  }

  const providerSessionId = readProviderSessionId(launchUrl);

  await prisma.gameSession.create({
    data: {
      userId,
      gameId: numericId,
      providerSessionId,
      status: "active",
    },
  });

  return {
    launchUrl,
  };
};

module.exports = {
  getActiveGames,
  createGame,
  toggleGame,
  launchGame,
};
