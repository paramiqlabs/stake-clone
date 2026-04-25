const gameService = require("./game.service");

const isBadRequestError = (error) =>
  typeof error?.message === "string" &&
  (error.message.includes("must be") || error.message.includes("Invalid game id"));

const getActiveGames = async (req, res) => {
  try {
    res.set("Cache-Control", "no-store");
    const games = await gameService.getActiveGames();
    return res.status(200).json({ success: true, data: games });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

const createGame = async (req, res) => {
  try {
    const game = await gameService.createGame(req.body);
    return res.status(201).json({ success: true, data: game });
  } catch (error) {
    if (isBadRequestError(error)) {
      return res.status(400).json({ success: false, message: error.message });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

const toggleGame = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedGame = await gameService.toggleGame(id);

    if (!updatedGame) {
      return res.status(404).json({ success: false, message: "Game not found" });
    }

    return res.status(200).json({ success: true, data: updatedGame });
  } catch (error) {
    if (isBadRequestError(error)) {
      return res.status(400).json({ success: false, message: error.message });
    }

    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error",
    });
  }
};

const launchGame = async (req, res) => {
  try {
    const { id } = req.params;
    const launchData = await gameService.launchGame({
      gameId: id,
      authUserId: req.user?.id,
    });
    return res.status(200).json({ success: true, data: launchData });
  } catch (error) {
    const message = error?.message || "Internal server error";

    if (message === "Game not found" || message === "User not found") {
      return res.status(404).json({ success: false, message });
    }

    if (
      message === "Game is not available" ||
      message === "Provider launch failed" ||
      message === "Provider is not supported" ||
      message === "Invalid launch URL from provider" ||
      message === "Invalid user id" ||
      isBadRequestError(error)
    ) {
      return res.status(400).json({ success: false, message });
    }

    return res.status(500).json({ success: false, message });
  }
};

module.exports = {
  getActiveGames,
  createGame,
  toggleGame,
  launchGame,
};
